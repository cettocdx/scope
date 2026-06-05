import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { insertPortfolioAssetSchema, type Deal } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { searchPricesMultiRegion } from "./serpapi";

const analyzeRequestSchema = z.object({
  image: z.string().min(1, "image is required"),
  refinements: z.any().optional(),
});

const offerSchema = z.object({
  price: z.number(),
  currency: z.string(),
}).passthrough();

const valuateRequestSchema = z.object({
  offers: z.array(offerSchema),
  displayCurrency: z.string().optional(),
});

const syncRequestSchema = z.object({
  assets: z.array(insertPortfolioAssetSchema.partial({ deviceId: true })),
});
import { analyzeWithXimilar, type XimilarAnalysisResult } from "./ximilar";
import { analyzeWithClarifai, type ClarifaiAnalysisResult } from "./clarifai";

export const FX_RATES: Record<string, number> = {
  USD_TRY: 34.50,
  USD_EUR: 0.92,
  EUR_USD: 1.09,
  TRY_USD: 0.029,
  EUR_TRY: 37.50,
  TRY_EUR: 0.027,
};

/**
 * Detect the real image type from a decoded buffer by inspecting its magic
 * bytes. Returns the canonical type or null if the buffer is not a supported
 * image. This is intentionally permissive: it only rejects data that clearly
 * is not a JPEG/PNG/WEBP image.
 */
export function detectImageType(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

/**
 * Normalize a date-like value (Date, ISO string, or null/undefined) into a
 * numeric epoch timestamp for comparison. Returns null when the value is
 * absent or unparseable.
 */
export function normalizeDateValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const time = new Date(value as string | number | Date).getTime();
  return Number.isNaN(time) ? null : time;
}

interface SyncMatchable {
  id?: string | null;
  itemName: string;
  dateAdded?: Date | string | null;
}

/**
 * Find the existing asset that a sync candidate should update, if any.
 * Matching is id-based first (exact id), then falls back to itemName plus a
 * normalized dateAdded comparison (Date vs string safe). Returns undefined for
 * a create. Pure and testable; does not touch storage.
 */
export function findSyncMatch<T extends SyncMatchable>(
  existing: T[],
  candidate: SyncMatchable,
): T | undefined {
  if (candidate.id) {
    const byId = existing.find((e) => e.id === candidate.id);
    if (byId) return byId;
  }

  const candidateTime = normalizeDateValue(candidate.dateAdded);
  return existing.find((e) => {
    if (e.itemName !== candidate.itemName) return false;
    return normalizeDateValue(e.dateAdded) === candidateTime;
  });
}

export function convertToUSD(amount: number, currency: string): number {
  if (currency === "USD" || currency === "$") return amount;
  if (currency === "TRY" || currency === "TL" || currency === "₺") {
    return amount * (FX_RATES["TRY_USD"] || 0.029);
  }
  if (currency === "EUR" || currency === "€") {
    return amount * (FX_RATES["EUR_USD"] || 1.09);
  }
  return amount;
}

/**
 * Accepted input for valuation: only `price` and `currency` are required; any
 * other Deal fields may be present and are preserved/augmented on output.
 */
type ValuationInput = Pick<Deal, "price" | "currency"> & Partial<Deal>;

interface ValuationResult {
  priceRange: { min: number; median: number; max: number; currency: string };
  outlierCount: number;
  processedDeals: Deal[];
}

/**
 * Narrow an unknown thrown value into a safe { message, status } shape so we
 * never access properties on an untyped `any`. Mirrors the pattern used by the
 * central error handler in index.ts.
 */
function getErrorInfo(e: unknown): { message: string; status?: number } {
  if (e && typeof e === "object") {
    const err = e as { message?: unknown; status?: unknown; statusCode?: unknown };
    const message = typeof err.message === "string" ? err.message : String(e);
    const rawStatus = err.status ?? err.statusCode;
    const status = typeof rawStatus === "number" ? rawStatus : undefined;
    return { message, status };
  }
  return { message: String(e) };
}

export function calculateValuation(deals: ValuationInput[], displayCurrency: string = "USD"): ValuationResult {
  if (!deals || deals.length === 0) {
    return {
      priceRange: { min: 0, median: 0, max: 0, currency: displayCurrency },
      outlierCount: 0,
      processedDeals: [],
    };
  }

  const pricesInUSD = deals.map(d => ({
    ...d,
    priceUSD: convertToUSD(d.price, d.currency),
  }));

  const sortedPrices = pricesInUSD
    .map(d => d.priceUSD)
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (sortedPrices.length === 0) {
    return {
      priceRange: { min: 0, median: 0, max: 0, currency: displayCurrency },
      outlierCount: 0,
      // Inputs are full Deals in the real flow; price/currency-only objects only
      // occur in unit tests where the extra fields are not asserted.
      processedDeals: deals as Deal[],
    };
  }

  const q1Index = Math.floor(sortedPrices.length * 0.25);
  const q3Index = Math.floor(sortedPrices.length * 0.75);
  const q1 = sortedPrices[q1Index] || sortedPrices[0];
  const q3 = sortedPrices[q3Index] || sortedPrices[sortedPrices.length - 1];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  let outlierCount = 0;
  const processedDeals = pricesInUSD.map(deal => {
    const isOutlier = deal.priceUSD < lowerBound || deal.priceUSD > upperBound;
    if (isOutlier) outlierCount++;
    return {
      ...deal,
      isOutlier,
      qualityScore: isOutlier ? 30 : 80,
    };
  });

  const nonOutlierPrices = sortedPrices.filter(p => p >= lowerBound && p <= upperBound);
  const pricesToUse = nonOutlierPrices.length > 0 ? nonOutlierPrices : sortedPrices;

  const min = Math.round(pricesToUse[0]);
  const max = Math.round(pricesToUse[pricesToUse.length - 1]);
  const medianIndex = Math.floor(pricesToUse.length / 2);
  const median = pricesToUse.length % 2 === 0
    ? Math.round((pricesToUse[medianIndex - 1] + pricesToUse[medianIndex]) / 2)
    : Math.round(pricesToUse[medianIndex]);

  return {
    priceRange: { min, median, max, currency: displayCurrency },
    outlierCount,
    processedDeals: processedDeals as Deal[],
  };
}

const FORENSIC_ANALYSIS_PROMPT = `
ROLE: Expert Luxury Product Authenticator & Brand Identification Specialist.

CRITICAL RULES:
1. NEVER FABRICATE BRANDS. Only identify what you can see evidence for.
2. If brand is truly unclear after all analysis, say "Unknown Brand" with your best description.

IDENTIFICATION METHODS (USE ALL THAT APPLY):

METHOD 1 - LOGO/TEXT DETECTION (Highest confidence):
- Search for visible logos, brand text, stamps, engravings
- Look for: metal plaques, embossed text, printed labels, hang tags
- Check: tongue of shoes, interior lining, hardware, zippers, buckles, soles

METHOD 2 - COMPREHENSIVE FASHION BRAND DATABASE:

=== LUXURY TIER (€1000+) ===
PRADA: Triangle metal logo, "PRADA MILANO" text, Monolith chunky soles, Re-Nylon fabric, silver/gunmetal hardware, clean minimalist design
BOTTEGA VENETA: Intrecciato woven leather (signature), NO visible logos ever, muted earth tones (brown, green, cream), Cassette/Padded bags, Tire/Lug boots
GUCCI: GG monogram, green-red-green web stripe, Horsebit hardware, Flora prints, Dionysus/Jackie bags, rhinestone GG
LOUIS VUITTON: LV monogram canvas, Damier (Ebene/Azur), brass hardware, red edge painting, Speedy/Neverfull/Alma bags
CHANEL: Quilted leather, CC turnlock, chain straps with leather weave, beige/black/white, Classic Flap/Boy bags, tweed fabric
HERMES: Birkin/Kelly/Constance shapes, Palladium/Gold hardware, hand-stitched saddle stitch, Clemence/Togo/Epsom leather, H buckle belts
DIOR: Cannage quilting, CD logo, Oblique monogram, Saddle/Lady Dior/Book Tote bags, J'Adior accessories
FENDI: FF Zucca monogram, Baguette/Peekaboo bags, yellow/brown colors, Fendi Roma text, monster eyes
BALENCIAGA: Oversized silhouettes, Track/Triple S chunky sneakers, City/Hourglass bags, distressed aesthetics, gothic fonts
CELINE: Triomphe monogram, minimal clean design, gold hardware, Belt/Luggage/Trio bags, Phoebe Philo era minimalism
LOEWE: Anagram logo, Puzzle/Hammock bags, soft leather, craft-focused design, basket weave
BURBERRY: Nova check plaid, TB monogram, trench coats, beige/red/black check pattern
GIVENCHY: 4G logo, Antigona bags, star motifs, gothic streetwear aesthetic
VERSACE: Medusa head logo, baroque prints, gold hardware, bold colors, Greek key pattern

=== PREMIUM TIER (€500-1000) ===
SAINT LAURENT: YSL logo, Loulou/Kate bags, gold hardware, rock-and-roll aesthetic, pointed toes, Le 5 à 7 bag
VALENTINO: Rockstud pyramid studs, V logo, red/pink colors, Roman Stud bags, lace details
ALEXANDER MCQUEEN: Skull motifs, oversized sneakers, dramatic silhouettes, Knuckle clutch
MIU MIU: (Prada's sister) playful feminine design, matelassé quilting, crystal embellishments, retro aesthetics
AMIRI: Distressed denim, bandana prints, guitar strap motifs, LA streetwear luxury
TOM FORD: TF logo, sleek minimalism, black/gold, oversized sunglasses
JACQUEMUS: Le Chiquito micro bags, La Montagne collection, French Riviera aesthetic, oversized hats
THE ROW: Ultra-minimal, no logos, exceptional fabrics, quiet luxury, Margaux/Park bags
LORO PIANA: Cashmere excellence, minimal branding, earth tones, "Summer Walk" loafers, discrete LP logo

=== FOOTWEAR SPECIALISTS ===
CHRISTIAN LOUBOUTIN: Signature red lacquered soles (100% identifier), slim stilettos, So Kate/Pigalle styles
JIMMY CHOO: Crystal embellishments, pointed toes, JC logo, glamorous evening wear
MANOLO BLAHNIK: Elegant silhouettes, silk/satin, Hangisi jeweled buckle, Sex and the City fame
GIANVITO ROSSI: Clean lines, PVC elements, Plexi heels, Italian craftsmanship
AQUAZZURA: Tassel details, Wild Thing fringed sandals, pointed toes
ROGER VIVIER: Trompette buckle (rectangular), elegant classic design, Viv' bags
STUART WEITZMAN: 5050 over-knee boots, stretch suede, comfortable glamour
SALVATORE FERRAGAMO: Vara bow, Gancini hardware, loafers, Italian craftsmanship

=== SNEAKER/STREETWEAR ===
NIKE: Swoosh logo, Air Jordan wings, Dunk silhouette, Air Force 1 shape
ADIDAS: Three stripes, Trefoil logo, Yeezy (Boost/Foam), Stan Smith, Superstar shell toe
NEW BALANCE: "N" logo, 550/990/2002R models, dad shoe aesthetic
CONVERSE: All Star logo, Chuck Taylor, star ankle patch
VANS: Side stripe, Old Skool, Sk8-Hi checkerboard
GOLDEN GOOSE: Intentional distressing, star logo on side, handwritten effects, Superstar/Ball Star
COMMON PROJECTS: Gold serial number on heel, minimalist design, Achilles model
OFF-WHITE: Diagonal stripes, zip ties, quotation marks, industrial design, Virgil Abloh
FEAR OF GOD: Essentials line, oversized fits, neutral colors, minimal branding

=== CONTEMPORARY/ACCESSIBLE LUXURY (€200-500) ===
MARC JACOBS: Snapshot camera bag, Tote Bag, playful design, bold colors
COACH: C monogram, Tabby bag, Pillow Tabby, American heritage
KATE SPADE: Spade logo, playful feminine design, Sam bag, bright colors
MICHAEL KORS: MK monogram, Jet Set bags, accessible luxury, gold hardware
TORY BURCH: Double-T logo, Miller sandals, Kira bag, preppy American style
FURLA: Metropolis bag, Italian craftsmanship, colorful leather, affordable luxury
LONGCHAMP: Le Pliage foldable bags, nylon with leather handles, French heritage
MCM: Visetos monogram (cognac color with logo pattern), studded details, backpacks
MULBERRY: Bayswater/Alexa bags, postman lock, British heritage, thick leather

=== TURKISH/REGIONAL BRANDS ===
BEYMEN: Turkish luxury retailer
VAKKO: Turkish fashion house, silk scarves
NETWORK: Turkish contemporary fashion
IPEKYOL: Turkish women's fashion
DAMAT/TWEEN: Turkish men's suiting

=== BOOT IDENTIFICATION GUIDE ===
Combat boots with chunky soles:
- Monolith sole (thick rectangular) = PRADA
- Tire/Lug sole (wavy tread) = BOTTEGA VENETA
- Track sole (complex layers) = BALENCIAGA
- Tread sole (hiking-style) = ALEXANDER MCQUEEN

Chelsea boots:
- Intrecciato leather = BOTTEGA VENETA
- Chain detail = GIVENCHY
- Pointed toe + harness = SAINT LAURENT

Ankle boots with heel:
- Red sole = LOUBOUTIN (100% certain)
- Rockstud = VALENTINO
- Cassandra logo = SAINT LAURENT

METHOD 3 - CONSTRUCTION ANALYSIS (For logo-less items):
Check these details to identify quality/brand:
- STITCHING: Count per inch, evenness, thread color, saddle stitch vs machine
- HARDWARE: Metal type (brass, palladium, silver), weight, engravings on zippers
- LEATHER: Grain pattern, softness, edge finishing, glazing
- SOLE: Material, shape, stitching method (Blake, Goodyear welt)
- SILHOUETTE: Distinctive shapes unique to brands
- COLOR: Signature colors (Hermes orange, Tiffany blue, Louboutin red)

METHOD 4 - PRODUCT TYPE CLUES:
- Combat boots with chunky soles → Prada Monolith, Bottega Lug, Balenciaga
- Woven leather anything → Bottega Veneta
- Red bottom heels → Christian Louboutin
- Quilted bag with chain → Chanel, Saint Laurent
- Studded items → Valentino Rockstud

CONFIDENCE SCORING:
- 90-99: Logo/brand text clearly visible and readable
- 75-89: No logo but DISTINCTIVE signature design elements visible
- 60-74: Style matches brand aesthetic but could be similar brand
- 50-59: Generic luxury item, brand uncertain
- Below 50: Use "Unknown Brand" and describe the item generically

WHEN UNCERTAIN (confidence < 70):
Set "needsUserInput": true and "requestedDetails": explain what would help (e.g., "photo of interior label", "view of the sole", "close-up of hardware")

OUTPUT FORMAT (JSON ONLY, no markdown):
{
  "itemName": "Brand Name + Product Type + Model (if known)",
  "brand": "Exact brand name or 'Unknown Brand'",
  "model": "Specific model name if identifiable",
  "brandConfidence": Number (50-99),
  "visualEvidence": ["List ALL visual cues found"],
  "identificationMethod": "logo" | "signature_design" | "construction" | "style_match",
  "category": "Fashion" | "Electronics" | "Watch" | "Jewelry" | "Footwear" | "Bags" | "Accessories" | "Other",
  "estimatedPrice": Number in USD,
  "currency": "USD",
  "trendPercentage": Number (-15 to +25),
  "confidenceScore": Number (50-99),
  "investmentRating": "BUY" | "SELL" | "HOLD",
  "alternativeBrands": ["Other possible brands if uncertain"],
  "needsUserInput": Boolean (true if confidence < 70),
  "requestedDetails": "What additional info would help identification",
  "deals": [],
  "dna": {
    "title": "Full precise product name e.g. 'Apple Watch Series 9 45mm GPS Midnight Aluminum'",
    "category": "Electronics" | "Fashion" | "Watch" | "Jewelry" | "Footwear" | "Bags" | "Accessories" | "Other",
    "brand": "Brand name",
    "model": "Model/series name",
    "variant": {
      "size": "Size if visible (e.g. 45mm, M, 42)",
      "color": "Color name (e.g. Midnight, Black, Cream)",
      "material": "Material (e.g. Aluminum, Leather, Canvas)",
      "capacity": "Storage if applicable (e.g. 256GB)",
      "connectivity": "If applicable (e.g. GPS, Cellular)"
    },
    "condition": "NEW" | "USED" | "LIKE_NEW",
    "confidence": {
      "visual": Number (0-100) - confidence from visual analysis,
      "ocr": Number (0-100) - confidence from text/logo detection,
      "barcode": Number (0-100) - 0 if no barcode visible,
      "overall": Number (0-100) - weighted average
    },
    "searchQueries": [
      "Generate 5-10 marketplace search queries from most specific to generic",
      "Example: 'Apple Watch Series 9 45mm GPS Midnight Aluminum'",
      "Example: 'Apple Watch Series 9 45mm GPS'",
      "Example: 'Apple Watch Series 9 45mm'",
      "Example: 'Apple Watch Series 9'"
    ],
    "mustHaveTokens": ["Critical tokens that MUST appear in matching offers", "e.g. '45mm', 'Series 9', 'GPS'"]
  }
}

EXAMPLE - Apple Watch:
{
  "itemName": "Apple Watch Series 9 45mm GPS",
  "brand": "Apple",
  "model": "Series 9",
  "brandConfidence": 95,
  "visualEvidence": ["Apple logo on crown", "Series 9 display", "45mm case size visible", "GPS model (no cellular antenna)"],
  "identificationMethod": "logo",
  "category": "Electronics",
  "estimatedPrice": 429,
  "currency": "USD",
  "trendPercentage": -2,
  "confidenceScore": 95,
  "investmentRating": "HOLD",
  "alternativeBrands": [],
  "needsUserInput": false,
  "requestedDetails": "",
  "deals": [],
  "dna": {
    "title": "Apple Watch Series 9 45mm GPS Midnight Aluminum",
    "category": "Electronics",
    "brand": "Apple",
    "model": "Series 9",
    "variant": {"size": "45mm", "color": "Midnight", "material": "Aluminum", "connectivity": "GPS"},
    "condition": "LIKE_NEW",
    "confidence": {"visual": 95, "ocr": 90, "barcode": 0, "overall": 92},
    "searchQueries": [
      "Apple Watch Series 9 45mm GPS Midnight Aluminum",
      "Apple Watch Series 9 45mm GPS Midnight",
      "Apple Watch Series 9 45mm GPS",
      "Apple Watch Series 9 45mm",
      "Apple Watch Series 9"
    ],
    "mustHaveTokens": ["Apple Watch", "Series 9", "45mm", "GPS"]
  }
}

EXAMPLE - Luxury Fashion:
{
  "itemName": "Prada Saffiano Leather Wallet",
  "brand": "Prada",
  "model": "Saffiano",
  "brandConfidence": 88,
  "visualEvidence": ["Triangle Prada logo", "Saffiano cross-hatch leather texture", "Gold hardware", "PRADA MILANO text"],
  "identificationMethod": "logo",
  "category": "Fashion",
  "estimatedPrice": 650,
  "currency": "USD",
  "trendPercentage": 5,
  "confidenceScore": 88,
  "investmentRating": "HOLD",
  "alternativeBrands": [],
  "needsUserInput": false,
  "requestedDetails": "",
  "deals": [],
  "dna": {
    "title": "Prada Saffiano Leather Bifold Wallet Black",
    "category": "Fashion",
    "brand": "Prada",
    "model": "Saffiano Bifold",
    "variant": {"color": "Black", "material": "Saffiano Leather"},
    "condition": "LIKE_NEW",
    "confidence": {"visual": 88, "ocr": 85, "barcode": 0, "overall": 87},
    "searchQueries": [
      "Prada Saffiano Leather Bifold Wallet Black",
      "Prada Saffiano Leather Wallet Black",
      "Prada Saffiano Wallet",
      "Prada Leather Wallet",
      "Prada Wallet"
    ],
    "mustHaveTokens": ["Prada", "Saffiano", "Wallet"]
  }
}
`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const { image, refinements } = parsed.data;

      // Log refinements if provided
      if (refinements) {
        console.log("User refinements received:", refinements);
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      const base64Data = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

      // Validate base64 data
      if (!base64Data || base64Data.length < 100) {
        console.error("Invalid image data - too short:", base64Data.substring(0, 50));
        return res.status(400).json({ error: "Invalid image data" });
      }

      // Reject oversized payloads before decoding the whole thing. base64 is
      // ~33% larger than the decoded bytes, so cap the decoded size at ~12MB.
      const MAX_DECODED_BYTES = 12 * 1024 * 1024;
      // Approx decoded size: every 4 base64 chars encode 3 bytes.
      const approxDecodedBytes = Math.floor((base64Data.length * 3) / 4);
      if (approxDecodedBytes > MAX_DECODED_BYTES) {
        console.error("Image too large:", approxDecodedBytes, "bytes (approx)");
        return res.status(413).json({ error: "Image too large" });
      }

      // Decode and verify the real image type from its magic bytes. This is far
      // stronger than the previous prefix regex and catches non-image payloads.
      const imageBuffer = Buffer.from(base64Data, "base64");
      if (imageBuffer.length > MAX_DECODED_BYTES) {
        console.error("Image too large after decode:", imageBuffer.length, "bytes");
        return res.status(413).json({ error: "Image too large" });
      }

      const detectedType = detectImageType(imageBuffer);
      if (!detectedType) {
        console.error("Invalid or unsupported image format");
        return res.status(400).json({ error: "Invalid or unsupported image format" });
      }

      // Use the type detected from the actual bytes, not the (spoofable) prefix.
      const mimeType = `image/${detectedType}`;

      console.log(`Processing image: ${mimeType}, size: ${base64Data.length} chars`);

      // The Gemini SDK does not accept an abort signal, so guard it against
      // hanging by racing the call against a timeout that rejects after 20s.
      const geminiTimeoutMs = 20000;
      const geminiTimeout = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Gemini request timed out after ${geminiTimeoutMs}ms`)),
          geminiTimeoutMs,
        );
      });

      const [ximilarResult, clarifaiResult, geminiResponse] = await Promise.all([
        analyzeWithXimilar(base64Data).catch(err => {
          console.error("Ximilar analysis failed:", err);
          return null as XimilarAnalysisResult | null;
        }),
        analyzeWithClarifai(base64Data).catch(err => {
          console.error("Clarifai analysis failed:", err);
          return null as ClarifaiAnalysisResult | null;
        }),
        Promise.race([
          ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                  { text: FORENSIC_ANALYSIS_PROMPT },
                ],
              },
            ],
          }),
          geminiTimeout,
        ])
      ]);

      if (ximilarResult?.success) {
        console.log("Ximilar analysis:", {
          category: ximilarResult.category,
          subcategory: ximilarResult.subcategory,
          color: ximilarResult.color,
          material: ximilarResult.material,
          style: ximilarResult.style,
          tags: ximilarResult.tags.slice(0, 10)
        });
      }

      if (clarifaiResult?.success) {
        console.log("Clarifai analysis:", {
          topCategory: clarifaiResult.topCategory,
          conceptsCount: clarifaiResult.concepts.length,
          suggestedBrands: clarifaiResult.suggestedBrands,
          colors: clarifaiResult.colors,
          materials: clarifaiResult.materials
        });
      }

      const text = geminiResponse.text;
      if (!text) {
        // Upstream AI returned an empty body — treat as a bad gateway response.
        return res.status(502).json({ error: "No response from AI" });
      }

      const cleanJson = text.replace(/```json|```/g, "").trim();

      let data;
      try {
        data = JSON.parse(cleanJson);
      } catch (e) {
        console.error("JSON Parse Error. Output preview:", cleanJson.slice(0, 200));
        // The upstream AI produced output we cannot parse — a bad gateway, not a
        // server fault on our side.
        return res.status(502).json({ error: "Failed to parse AI response" });
      }

      if (!data.visualEvidence) {
        data.visualEvidence = [];
      }

      if (ximilarResult?.success) {
        data.ximilarData = {
          category: ximilarResult.category,
          subcategory: ximilarResult.subcategory,
          color: ximilarResult.color,
          material: ximilarResult.material,
          style: ximilarResult.style,
          pattern: ximilarResult.pattern,
          gender: ximilarResult.gender,
          tags: ximilarResult.tags,
          confidence: ximilarResult.confidence
        };
        
        if (ximilarResult.color) {
          data.visualEvidence.push(`Ximilar Color: ${ximilarResult.color}`);
        }
        if (ximilarResult.material) {
          data.visualEvidence.push(`Ximilar Material: ${ximilarResult.material}`);
        }
        if (ximilarResult.pattern) {
          data.visualEvidence.push(`Ximilar Pattern: ${ximilarResult.pattern}`);
        }
        if (ximilarResult.subcategory) {
          data.visualEvidence.push(`Ximilar Type: ${ximilarResult.subcategory}`);
        }
      }

      if (clarifaiResult?.success) {
        data.clarifaiData = {
          topCategory: clarifaiResult.topCategory,
          concepts: clarifaiResult.concepts.slice(0, 20),
          suggestedBrands: clarifaiResult.suggestedBrands,
          colors: clarifaiResult.colors,
          materials: clarifaiResult.materials,
          styles: clarifaiResult.styles
        };
        
        if (clarifaiResult.suggestedBrands.length > 0 && data.brand === "Unknown Brand") {
          data.alternativeBrands = [...new Set([...(data.alternativeBrands || []), ...clarifaiResult.suggestedBrands])];
        }
        
        clarifaiResult.colors.forEach(color => {
          if (!data.visualEvidence.some((e: string) => e.toLowerCase().includes(color))) {
            data.visualEvidence.push(`Clarifai Color: ${color}`);
          }
        });
        
        clarifaiResult.materials.forEach(material => {
          if (!data.visualEvidence.some((e: string) => e.toLowerCase().includes(material))) {
            data.visualEvidence.push(`Clarifai Material: ${material}`);
          }
        });
      }

      if (data.deals && data.deals.length > 0) {
        const cleanItemName = data.itemName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const encodedItem = encodeURIComponent(cleanItemName);

        data.deals = data.deals.map((deal: Deal) => {
          if (deal.url && deal.url.startsWith("http")) {
            return deal;
          }

          const storeLower = deal.storeName.toLowerCase();
          let searchUrl = "";

          if (storeLower.includes("amazon")) {
            searchUrl = `https://www.amazon.com/s?k=${encodedItem}`;
          } else if (storeLower.includes("walmart")) {
            searchUrl = `https://www.walmart.com/search?q=${encodedItem}`;
          } else if (storeLower.includes("ebay")) {
            searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedItem}`;
          } else if (storeLower.includes("best buy") || storeLower.includes("bestbuy")) {
            searchUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedItem}`;
          } else if (storeLower.includes("target")) {
            searchUrl = `https://www.target.com/s?searchTerm=${encodedItem}`;
          } else {
            searchUrl = `https://www.google.com/search?tbm=shop&q=${encodedItem}+${encodeURIComponent(deal.storeName)}`;
          }

          return { ...deal, url: searchUrl };
        });
      }

      try {
        // Use DNA searchQueries for precise marketplace matching
        let searchQueries: string[] = [];
        
        if (data.dna?.searchQueries && data.dna.searchQueries.length > 0) {
          // Use AI-generated search queries from DNA
          searchQueries = data.dna.searchQueries.slice(0, 3); // Use top 3 queries
          console.log("Using DNA searchQueries:", searchQueries);
        } else {
          // Fallback: Build query from itemName + refinements
          let searchQuery = data.itemName;
          if (refinements) {
            const parts = [data.itemName];
            if (refinements.condition && refinements.condition !== 'any') {
              parts.push(refinements.condition);
            }
            if (refinements.attributes?.color) {
              parts.push(refinements.attributes.color);
            }
            if (refinements.attributes?.size) {
              parts.push(refinements.attributes.size);
            }
            if (refinements.attributes?.material) {
              parts.push(refinements.attributes.material);
            }
            searchQuery = parts.join(' ');
          }
          searchQueries = [searchQuery];
        }
        
        // Use the most specific query first
        const primaryQuery = searchQueries[0];
        console.log(`Fetching SerpAPI prices for: ${primaryQuery}`);
        const serpResults = await searchPricesMultiRegion(primaryQuery, ["US", "TR", "DE"]);
        
        if (serpResults.length > 0) {
          data.deals = serpResults;
          
          const usPrices = serpResults.filter(r => r.region === "US").map(r => r.price);
          if (usPrices.length > 0) {
            data.estimatedPrice = Math.round(usPrices.reduce((a, b) => a + b, 0) / usPrices.length);
          }
        }
      } catch (serpError) {
        console.error("SerpAPI error, using AI estimates:", serpError);
      }

      if (!data.deals || data.deals.length === 0) {
        const encodedItem = encodeURIComponent(data.itemName);
        data.deals = [
          {
            storeName: "Amazon",
            price: data.estimatedPrice,
            currency: "USD",
            url: `https://www.amazon.com/s?k=${encodedItem}`,
            isBestDeal: true,
            region: "US",
          },
          {
            storeName: "eBay",
            price: Math.round(data.estimatedPrice * 0.95),
            currency: "USD",
            url: `https://www.ebay.com/sch/i.html?_nkw=${encodedItem}`,
            isBestDeal: false,
            region: "US",
          },
          {
            storeName: "Google Shopping",
            price: Math.round(data.estimatedPrice * 1.02),
            currency: "USD",
            url: `https://www.google.com/search?tbm=shop&q=${encodedItem}`,
            isBestDeal: false,
            region: "GLOBAL",
          },
        ];
      }

      const regionSummary = {
        US: data.deals.filter((d: Deal) => d.region === "US"),
        TR: data.deals.filter((d: Deal) => d.region === "TR"),
        DE: data.deals.filter((d: Deal) => d.region === "DE"),
      };

      const valuationResult = calculateValuation(data.deals, "USD");
      
      res.json({
        ...data,
        currency: "USD",
        regionSummary,
        searchRegions: ["US", "TR", "DE"],
        priceRange: valuationResult.priceRange,
        outlierCount: valuationResult.outlierCount,
        deals: valuationResult.processedDeals,
        appliedRefinements: refinements || null,
      });
    } catch (error: unknown) {
      console.error("Gemini Analysis Error:", error);

      const { message, status } = getErrorInfo(error);

      if (status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({
          error: "Too many requests. Please wait a moment and try again.",
          isRateLimit: true
        });
      }

      // Distinguish upstream (Gemini) failures from our own faults. A timeout on
      // the Gemini call or a 5xx/upstream status maps to 502 (bad gateway); we
      // never leak the internal detail to the client.
      const isUpstreamTimeout = message.includes("Gemini request timed out");
      const isUpstreamStatus = typeof status === "number" && status >= 500;
      if (isUpstreamTimeout || isUpstreamStatus) {
        return res.status(502).json({ error: "Analysis failed" });
      }

      res.status(500).json({ error: "Analysis failed" });
    }
  });

  app.get("/api/fx", (req, res) => {
    const { base = "USD", quote = "TRY" } = req.query;
    const key = `${base}_${quote}`;
    const rate = FX_RATES[key as string] || 1;
    
    res.json({
      base,
      quote,
      rate,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post("/api/valuate", (req, res) => {
    try {
      const parsed = valuateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const { offers, displayCurrency = "USD" } = parsed.data;

      const result = calculateValuation(offers, displayCurrency);
      
      res.json({
        marketValue: result.priceRange.median,
        ...result.priceRange,
        cleanedOffers: result.processedDeals.filter((d: Deal) => !d.isOutlier),
        outliers: result.processedDeals.filter((d: Deal) => d.isOutlier),
        outlierCount: result.outlierCount,
      });
    } catch (error: unknown) {
      console.error("Valuation error:", error);
      res.status(500).json({ error: "Valuation failed" });
    }
  });

  app.get("/api/portfolio/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const assets = await storage.getPortfolioAssets(deviceId);
      res.json(assets);
    } catch (error: unknown) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      // deviceId is set by the server from the path, so it may be absent in the body.
      const parsed = insertPortfolioAssetSchema.safeParse({ ...req.body, deviceId });
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const assetData = parsed.data;

      if (assetData.id) {
        // Lookup is device-scoped. If a record exists for this id under another
        // device, this returns undefined and we never touch it (no takeover).
        const existing = await storage.getPortfolioAsset(assetData.id, deviceId);
        if (existing) {
          // Ownership check (defensive): the scoped lookup already guarantees
          // ownership, but reject explicitly if it ever mismatches.
          if (existing.deviceId !== deviceId) {
            return res.status(403).json({ error: "Forbidden" });
          }
          const updated = await storage.updatePortfolioAsset(assetData.id, deviceId, {
            ...assetData,
            deviceId,
          });
          return res.json(updated);
        }
      }

      // No matching record owned by this device. Drop any client-supplied id so a
      // create cannot overwrite (take over) another device's asset via id conflict.
      const { id: _ignoredId, ...createData } = assetData;
      const asset = await storage.createPortfolioAsset({
        ...createData,
        deviceId,
        dateAdded: req.body.dateAdded ? new Date(req.body.dateAdded) : new Date(),
      });

      res.json(asset);
    } catch (error: unknown) {
      console.error("Portfolio create error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.put("/api/portfolio/:deviceId/:assetId", async (req, res) => {
    try {
      const { deviceId, assetId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const parsed = insertPortfolioAssetSchema
        .partial()
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      // deviceId is owned by the path, never let the body override it.
      const { deviceId: _ignoredDeviceId, id: _ignoredId, ...updates } = parsed.data;

      const asset = await storage.updatePortfolioAsset(assetId, deviceId, updates);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json(asset);
    } catch (error: unknown) {
      console.error("Portfolio update error:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  app.delete("/api/portfolio/:deviceId/:assetId", async (req, res) => {
    try {
      const { deviceId, assetId } = req.params;

      const deleted = await storage.deletePortfolioAsset(assetId, deviceId);
      if (!deleted) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Portfolio delete error:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  app.post("/api/portfolio/:deviceId/sync", async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }

      const parsed = syncRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const { assets } = parsed.data;

      // Fetch the device's assets once (avoids an N+1 query per sync item) and
      // match in memory. Matching is id-first, then itemName + normalized date,
      // which is Date-vs-string safe (the previous strict === always failed and
      // created duplicates).
      const existing = await storage.getPortfolioAssets(deviceId);

      const syncedAssets = [];
      for (const asset of assets) {
        const match = findSyncMatch(existing, asset);

        if (match) {
          const updated = await storage.updatePortfolioAsset(match.id, deviceId, { ...asset, deviceId });
          if (updated) syncedAssets.push(updated);
        } else {
          const created = await storage.createPortfolioAsset({
            ...asset,
            deviceId,
            dateAdded: asset.dateAdded ? new Date(asset.dateAdded) : new Date(),
          });
          syncedAssets.push(created);
        }
      }

      res.json(syncedAssets);
    } catch (error: unknown) {
      console.error("Portfolio sync error:", error);
      res.status(500).json({ error: "Failed to sync portfolio" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
