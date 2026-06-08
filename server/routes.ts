import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { insertPortfolioAssetSchema, type Deal } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { searchPricesMultiRegion, applyLiveRates } from "./serpapi";
import { trackScan, captureError } from "./telemetry";
import { scheduleFxRefresh } from "./fx";
import { affiliateUrl, affiliateEnabled } from "./affiliate";

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
  /** Number of real (non-outlier) offers the price range is built from. */
  sourceCount: number;
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
      sourceCount: 0,
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
      sourceCount: 0,
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
    sourceCount: pricesToUse.length,
    processedDeals: processedDeals as Deal[],
  };
}

/**
 * Price-less "search on X" links shown when no real marketplace offer was found.
 * These let the user look the item up themselves without us inventing a price.
 */
function buildSearchLinks(itemName: string): Deal[] {
  const q = encodeURIComponent(itemName.replace(/[^a-zA-Z0-9 ]/g, "").trim());
  return [
    {
      storeName: "Google Shopping",
      price: 0,
      currency: "USD",
      url: `https://www.google.com/search?tbm=shop&q=${q}`,
      region: "US",
      isSearchLink: true,
    },
    {
      storeName: "Amazon",
      price: 0,
      currency: "USD",
      url: `https://www.amazon.com/s?k=${q}`,
      region: "US",
      isSearchLink: true,
    },
    {
      storeName: "eBay",
      price: 0,
      currency: "USD",
      url: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
      region: "US",
      isSearchLink: true,
    },
    {
      storeName: "Trendyol",
      price: 0,
      currency: "USD",
      url: `https://www.trendyol.com/sr?q=${q}`,
      region: "TR",
      isSearchLink: true,
    },
  ];
}

const FORENSIC_ANALYSIS_PROMPT = `
ROLE: Universal Product Identification & Resale Valuation Expert.
You identify ANY physical object a user photographs — electronics, vehicles, fashion,
bags, footwear, watches, jewelry, appliances, tools, collectibles, toys, beauty, or
anything else — and prepare precise marketplace search queries to find its real price.

CORE RULES:
1. NEVER FABRICATE. Identify only what the image supports. For generic or unbranded
   objects, describe them accurately ("Unknown Brand") instead of forcing a luxury brand.
2. READ EVERY VISIBLE TEXT first: model numbers, serial labels, logos, stamps, badges,
   on-screen text, license/spec plates. A printed model/serial number is the strongest clue.
3. BE SPECIFIC: the end goal is a search query precise enough to match the EXACT product
   (right brand, model, size/storage/variant) on a shopping site.

STEP 1 — CLASSIFY THE BROAD CATEGORY (pick the best fit):
Electronics | Vehicle | Fashion | Bags | Footwear | Watch | Jewelry | Appliance | Tool | Collectible | Beauty | Home | Other

STEP 2 — IDENTIFY USING THE METHOD THAT FITS THE CATEGORY:

>> ELECTRONICS (phones, laptops, tablets, e-cigarettes/vapes, TV remotes, TVs, monitors,
   headphones/earbuds, cameras, game consoles, smart devices, chargers/accessories):
   - Read the model name/number on the body, screen, sticker or box (e.g. "iPhone 15 Pro",
     model "A2848", "Galaxy S24 Ultra", "PlayStation 5", "Vaporesso XROS 3", "Logitech MX").
   - Brand from logo + design language. Capture every spec that changes price:
     storage (128/256/512GB/1TB), screen size (13"/15"/65"), RAM, color, connectivity
     (Wi-Fi / Cellular / 5G), generation/model year, edition.
   - Vapes/e-cigs: brand (Elf Bar, Vaporesso, Geekvape, SMOK, Lost Mary...), model, puff
     count / pod capacity, nicotine strength if printed, disposable vs refillable.
   - Remotes & accessories: name the host device (brand + which TV / set-top / console).

>> VEHICLE (cars, motorcycles, scooters, bicycles):
   - Make + model + body type + approximate year range + trim/engine if badges are visible
     (e.g. "BMW 320i F30 Sedan 2015-2018", "Honda CBR 250R", "Yamaha NMAX 125").
   - Use badges, grille/emblem, head/tail-light shape, wheel design, body lines.

>> FASHION / BAGS / FOOTWEAR — use the brand knowledge in the DATABASE below. For
   non-luxury / high-street items (Zara, H&M, Nike basics, no-name), identify the brand
   from the label and describe garment type, material, color and size precisely.

>> WATCH / JEWELRY: brand, model/reference, case size, material (steel/gold), movement
   clues, dial color, bracelet type. Read any reference number on the caseback.

>> APPLIANCE / HOME / TOOL / BEAUTY / COLLECTIBLE / TOY / OTHER:
   - Brand + model + key specs from labels (wattage, capacity, size, volume).
   - Collectibles/toys: line/character, edition, year, scale (e.g. "LEGO 75192", "Funko Pop").
   - Beauty: brand + exact product name + size/shade (e.g. "Dyson Airwrap Complete").

LOGO/TEXT DETECTION applies to every category: inspect plaques, embossed text, printed
labels, hang tags, screens, engravings, zippers, buckles, soles, casebacks, spec stickers.

FASHION / BAGS / FOOTWEAR BRAND DATABASE (use only when the item is fashion-related):

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

PRICE-FAIRNESS RATING (investmentRating) — this is a RESALE PRICE signal, NOT
financial advice. Judge how the item's typical asking/retail price compares to its
fair market value:
- "BUY"  = priced clearly BELOW typical retail / good deal for a buyer
- "SELL" = priced ABOVE typical retail / overpriced (sells fast for a seller)
- "HOLD" = around fair retail
Never imply guaranteed returns or investment outcomes.

REGULATED ITEMS — set "regulatedCategory": true when the item is an age-restricted
or legally controlled good: e-cigarettes/vapes/nicotine, tobacco, alcohol, firearms/
weapons/ammunition, or adult products. Otherwise false. (We still identify and price
these, but hide purchase links and apply an age notice.)

OUTPUT FORMAT (JSON ONLY, no markdown):
{
  "itemName": "Brand Name + Product Type + Model (if known)",
  "brand": "Exact brand name or 'Unknown Brand'",
  "model": "Specific model name if identifiable",
  "brandConfidence": Number (50-99),
  "visualEvidence": ["List ALL visual cues found"],
  "identificationMethod": "logo" | "signature_design" | "construction" | "style_match",
  "category": "Electronics" | "Vehicle" | "Fashion" | "Bags" | "Footwear" | "Watch" | "Jewelry" | "Appliance" | "Tool" | "Collectible" | "Beauty" | "Home" | "Other",
  "regulatedCategory": Boolean,
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
    "category": "Electronics" | "Vehicle" | "Fashion" | "Bags" | "Footwear" | "Watch" | "Jewelry" | "Appliance" | "Tool" | "Collectible" | "Beauty" | "Home" | "Other",
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

EXAMPLE - Electronics (e-cigarette / vape):
{
  "itemName": "Vaporesso XROS 3 Pod Kit",
  "brand": "Vaporesso",
  "model": "XROS 3",
  "brandConfidence": 90,
  "visualEvidence": ["VAPORESSO text on body", "XROS 3 model name", "1000mAh pod kit form factor", "side fill pod"],
  "identificationMethod": "logo",
  "category": "Electronics",
  "estimatedPrice": 25,
  "currency": "USD",
  "trendPercentage": 0,
  "confidenceScore": 90,
  "investmentRating": "HOLD",
  "alternativeBrands": [],
  "needsUserInput": false,
  "requestedDetails": "",
  "deals": [],
  "dna": {
    "title": "Vaporesso XROS 3 Pod Kit 1000mAh Black",
    "category": "Electronics",
    "brand": "Vaporesso",
    "model": "XROS 3",
    "variant": {"color": "Black", "capacity": "1000mAh"},
    "condition": "NEW",
    "confidence": {"visual": 90, "ocr": 92, "barcode": 0, "overall": 90},
    "searchQueries": [
      "Vaporesso XROS 3 Pod Kit 1000mAh",
      "Vaporesso XROS 3 Pod Kit",
      "Vaporesso XROS 3",
      "Vaporesso XROS pod kit"
    ],
    "mustHaveTokens": ["Vaporesso", "XROS 3"]
  }
}

EXAMPLE - Generic / unbranded object (do NOT force a luxury brand):
{
  "itemName": "Stainless Steel Insulated Water Bottle",
  "brand": "Unknown Brand",
  "model": "",
  "brandConfidence": 50,
  "visualEvidence": ["Double-wall steel body", "no visible logo", "screw cap with loop"],
  "identificationMethod": "style_match",
  "category": "Home",
  "estimatedPrice": 15,
  "currency": "USD",
  "trendPercentage": 0,
  "confidenceScore": 55,
  "investmentRating": "HOLD",
  "alternativeBrands": [],
  "needsUserInput": true,
  "requestedDetails": "A close-up of any logo or text on the base or cap would confirm the brand",
  "deals": [],
  "dna": {
    "title": "Stainless Steel Insulated Water Bottle 750ml",
    "category": "Home",
    "brand": "Unknown Brand",
    "model": "",
    "variant": {"capacity": "750ml", "material": "Stainless Steel"},
    "condition": "USED",
    "confidence": {"visual": 60, "ocr": 0, "barcode": 0, "overall": 45},
    "searchQueries": [
      "stainless steel insulated water bottle 750ml",
      "double wall steel water bottle",
      "insulated water bottle"
    ],
    "mustHaveTokens": ["water bottle"]
  }
}
`;

// Fallback chain: if the primary model is overloaded (503), try the next one.
// Different models have separate capacity pools, so this dramatically improves
// reliability on the free tier.
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];

/**
 * Calls Gemini guarded by a per-attempt timeout. On transient upstream failures
 * (503 overloaded / 429 rate limit) it falls through to the next model, and runs
 * two full passes over the model list before giving up.
 */
async function generateWithRetry(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string,
) {
  const timeoutMs = 20000;
  const rounds = 2;
  let lastErr: unknown;

  for (let round = 0; round < rounds; round++) {
    for (const model of GEMINI_MODELS) {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)),
            timeoutMs,
          ),
        );
        const response = await Promise.race([
          ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { mimeType, data: base64Data } },
                  { text: FORENSIC_ANALYSIS_PROMPT },
                ],
              },
            ],
          }),
          timeout,
        ]);
        // Return the model that actually answered for telemetry.
        return { response, model };
      } catch (err) {
        lastErr = err;
        const e = err as { status?: number; message?: string };
        const transient =
          e?.status === 503 ||
          e?.status === 429 ||
          /\b(503|429|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/i.test(
            e?.message || "",
          );
        if (transient) {
          console.warn(`Gemini model ${model} unavailable, trying next...`);
          continue;
        }
        throw err; // non-transient (bad request, auth) → fail fast
      }
    }
    await new Promise((r) => setTimeout(r, 700 * (round + 1)));
  }
  throw lastErr;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Keep currency conversion honest: refresh live FX into both rate tables
  // (this module's FX_RATES and serpapi's EXCHANGE_RATES) on boot + every 6h.
  scheduleFxRefresh((usdPerUnit) => {
    if (usdPerUnit.TRY) {
      FX_RATES.TRY_USD = usdPerUnit.TRY;
      FX_RATES.USD_TRY = 1 / usdPerUnit.TRY;
    }
    if (usdPerUnit.EUR) {
      FX_RATES.EUR_USD = usdPerUnit.EUR;
      FX_RATES.USD_EUR = 1 / usdPerUnit.EUR;
    }
    if (usdPerUnit.TRY && usdPerUnit.EUR) {
      FX_RATES.EUR_TRY = usdPerUnit.EUR / usdPerUnit.TRY;
      FX_RATES.TRY_EUR = usdPerUnit.TRY / usdPerUnit.EUR;
    }
    applyLiveRates(usdPerUnit);
  });

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

      // Accept the standard GEMINI_API_KEY (Google AI Studio) or the
      // Replit-specific AI_INTEGRATIONS_GEMINI_API_KEY.
      const geminiApiKey =
        process.env.GEMINI_API_KEY ||
        process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

      if (!geminiApiKey) {
        return res.status(503).json({
          error:
            "AI is not configured. Set GEMINI_API_KEY in your .env (free key: https://aistudio.google.com/apikey).",
        });
      }

      const geminiBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        // Only override the endpoint for a custom proxy (e.g. Replit AI
        // Integrations); otherwise use the default Gemini API so a plain
        // Google AI Studio key works out of the box.
        ...(geminiBaseUrl
          ? { httpOptions: { apiVersion: "", baseUrl: geminiBaseUrl } }
          : {}),
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

      const startTime = Date.now();
      const [ximilarResult, clarifaiResult, gen] = await Promise.all([
        analyzeWithXimilar(base64Data).catch(err => {
          console.error("Ximilar analysis failed:", err);
          return null as XimilarAnalysisResult | null;
        }),
        analyzeWithClarifai(base64Data).catch(err => {
          console.error("Clarifai analysis failed:", err);
          return null as ClarifaiAnalysisResult | null;
        }),
        // Gemini free tier intermittently returns 503 (overloaded); retry with backoff.
        generateWithRetry(ai, mimeType, base64Data),
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

      const geminiResponse = gen.response;
      const modelUsed = gen.model;
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

      // Regulated-item safety net: trust the model's flag, but also catch it via
      // keywords so age-restricted goods never slip through without the gate.
      const REGULATED_RE =
        /\b(vape|vaping|e-?cig|e-?cigarette|nicotine|tobacco|cigarette|juul|elf ?bar|cigar|hookah|shisha|alcohol|whisk|vodka|beer|wine|liquor|rak[iı]|firearm|pistol|rifle|gun|ammo|ammunition)\b/i;
      data.regulatedCategory =
        Boolean(data.regulatedCategory) ||
        REGULATED_RE.test(data.itemName || "") ||
        REGULATED_RE.test(data.brand || "") ||
        REGULATED_RE.test(data.category || "");

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

      // Becomes true only if a real, plausible marketplace offer is found.
      let priceFound = false;

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
        
        // Build a region-neutral query: drop locale-specific noise (e.g. a
        // "Turkish Keyboard" layout) that would only match offers in one country,
        // so every region can return results.
        const primaryQuery =
          (searchQueries[0] || data.itemName || "")
            .replace(
              /\b(turkish|english|us|uk|arabic|german|french|spanish|italian|dutch|international)[\s-]+keyboard\b/gi,
              "",
            )
            .replace(/\bklavye\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim() || searchQueries[0];
        console.log(`Fetching SerpAPI prices for: ${primaryQuery}`);
        const serpResults = await searchPricesMultiRegion(primaryQuery, [
          "US", "TR", "UK", "FR", "NL", "ES", "IT", "AE",
        ]);
        
        if (serpResults.length > 0) {
          const aiEstimate = data.estimatedPrice;
          // Drop offers that are wildly off the AI's own estimate — these are
          // almost always accessories / parts (stickers, cases, cables) that
          // match the query but aren't the actual product. Keep a generous band.
          const plausible =
            typeof aiEstimate === "number" && aiEstimate > 0
              ? serpResults.filter(
                  (r) => r.price >= aiEstimate * 0.35 && r.price <= aiEstimate * 3,
                )
              : serpResults;

          // Trust threshold: require at least MIN_SOURCES independent real
          // offers before we present a "real price". A lone offer is too easy
          // to be wrong, so a single result falls through to search links.
          const MIN_SOURCES = 2;
          if (plausible.length >= MIN_SOURCES) {
            data.deals = plausible;
            priceFound = true;

            // Median (robust to outliers). Prefer US offers; otherwise use all
            // plausible offers across regions.
            const usOffers = plausible.filter((r) => r.region === "US");
            const prices = (usOffers.length ? usOffers : plausible)
              .map((r) => r.price)
              .sort((a, b) => a - b);
            if (prices.length > 0) {
              const mid = Math.floor(prices.length / 2);
              data.estimatedPrice = Math.round(
                prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2,
              );
            }
          }
        }
      } catch (serpError) {
        console.error("SerpAPI error:", serpError);
      }

      let priceRange = { min: 0, median: 0, max: 0, currency: "USD" };
      let outlierCount = 0;
      let sourceCount = 0;
      let finalDeals: Deal[];

      if (priceFound && data.deals && data.deals.length > 0) {
        const valuationResult = calculateValuation(data.deals, "USD");
        finalDeals = valuationResult.processedDeals;
        priceRange = valuationResult.priceRange;
        outlierCount = valuationResult.outlierCount;
        sourceCount = valuationResult.sourceCount;
      } else {
        // No real marketplace offer was found. Per product policy we show ONLY
        // real prices, so we never fabricate a value: drop the AI estimate and
        // hand back "search on X" links (price-less) for the user to look it up.
        data.estimatedPrice = 0;
        finalDeals = buildSearchLinks(data.itemName);
      }

      // Append affiliate tags to real purchase links (no-op until configured).
      finalDeals = finalDeals.map((d) =>
        d.isSearchLink ? d : { ...d, url: affiliateUrl(d.url) },
      );

      const regionSummary: Record<string, Deal[]> = {};
      for (const rc of ["US", "TR", "UK", "FR", "NL", "ES", "IT", "AE"]) {
        regionSummary[rc] = finalDeals.filter((d: Deal) => d.region === rc);
      }

      // The core product event: cost + accuracy + north-star signal per scan.
      const realRegions = new Set(
        finalDeals.filter((d) => !d.isSearchLink).map((d) => d.region),
      );
      trackScan({
        category: data.category,
        model: modelUsed,
        confidenceScore: data.confidenceScore,
        brandConfidence: data.brandConfidence,
        priceFound,
        realOfferCount: priceFound ? data.deals?.length || 0 : 0,
        regionsQueried: 8,
        regionsWithOffers: realRegions.size,
        needsUserInput: data.needsUserInput,
        refinementsApplied: !!refinements,
        regulated: Boolean(data.regulatedCategory),
        durationMs: Date.now() - startTime,
      });

      res.json({
        ...data,
        currency: "USD",
        priceFound,
        regionSummary,
        searchRegions: ["US", "TR", "UK", "FR", "NL", "ES", "IT", "AE"],
        priceRange,
        outlierCount,
        sourceCount,
        pricedAt: priceFound ? new Date().toISOString() : null,
        affiliate: affiliateEnabled(),
        deals: finalDeals,
        appliedRefinements: refinements || null,
      });
    } catch (error: unknown) {
      console.error("Gemini Analysis Error:", error);
      captureError(error, { route: "/api/analyze" });

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
