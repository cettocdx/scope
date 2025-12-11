import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { insertPortfolioAssetSchema } from "@shared/schema";
import { searchPricesMultiRegion } from "./serpapi";

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

METHOD 2 - SIGNATURE DESIGN ELEMENTS (When no logo visible):
- PRADA: Triangle logo, chunky Monolith soles, nylon with leather trim, silver hardware
- BOTTEGA VENETA: Intrecciato woven leather, NO visible logos, muted earth tones
- GUCCI: GG monogram, green-red-green web stripe, horsebit hardware, flora prints
- LOUIS VUITTON: LV monogram canvas, Damier pattern, brass hardware, red edge painting
- CHANEL: Quilted leather, CC turnlock, chain straps, beige/black combo
- HERMES: Distinctive Birkin/Kelly shapes, Palladium hardware, hand-stitched saddle stitch
- BALENCIAGA: Oversized silhouettes, Track/Triple S chunky soles, distressed aesthetics
- SAINT LAURENT: YSL logo, pointed toes, rock-and-roll aesthetic, gold hardware
- VALENTINO: Rockstud pyramid studs, red soles on some styles
- CHRISTIAN LOUBOUTIN: Signature red soles (lacquered), slim stilettos
- JIMMY CHOO: Crystal embellishments, sleek pointed toes, JC logo

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
  "brandConfidence": Number (50-99),
  "visualEvidence": ["List ALL visual cues found"],
  "identificationMethod": "logo" | "signature_design" | "construction" | "style_match",
  "category": "Fashion/Electronics/Jewelry/Collectibles/Art",
  "estimatedPrice": Number in USD,
  "currency": "USD",
  "trendPercentage": Number (-15 to +25),
  "confidenceScore": Number (50-99),
  "investmentRating": "BUY" | "SELL" | "HOLD",
  "alternativeBrands": ["Other possible brands if uncertain"],
  "needsUserInput": Boolean (true if confidence < 70),
  "requestedDetails": "What additional info would help identification",
  "deals": []
}

EXAMPLE - Boot WITHOUT visible logo but with signature design:
{
  "itemName": "Bottega Veneta Lug Boots",
  "brand": "Bottega Veneta",
  "brandConfidence": 82,
  "visualEvidence": ["Intrecciato woven leather pattern", "No visible branding", "Chunky lug sole", "Muted brown color"],
  "identificationMethod": "signature_design",
  "category": "Fashion",
  "estimatedPrice": 1450,
  "currency": "USD",
  "trendPercentage": 8,
  "confidenceScore": 80,
  "investmentRating": "HOLD",
  "alternativeBrands": [],
  "needsUserInput": false,
  "requestedDetails": "",
  "deals": []
}

EXAMPLE - Unknown brand item:
{
  "itemName": "Black Leather Combat Boots",
  "brand": "Unknown Brand",
  "brandConfidence": 45,
  "visualEvidence": ["Black leather upper", "Lace-up design", "Rubber sole", "No visible logos or distinctive patterns"],
  "identificationMethod": "style_match",
  "category": "Fashion",
  "estimatedPrice": 200,
  "currency": "USD",
  "trendPercentage": 0,
  "confidenceScore": 45,
  "investmentRating": "HOLD",
  "alternativeBrands": ["Dr. Martens", "Timberland", "Steve Madden"],
  "needsUserInput": true,
  "requestedDetails": "Please provide a photo of the interior label or sole for brand identification",
  "deals": []
}
`;

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image provided" });
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

      // Check if it's valid base64
      const base64Regex = /^[A-Za-z0-9+/=]+$/;
      if (!base64Regex.test(base64Data.substring(0, 100))) {
        console.error("Invalid base64 format");
        return res.status(400).json({ error: "Invalid image format" });
      }

      const mimeType = image.includes("data:image/png") ? "image/png" 
        : image.includes("data:image/webp") ? "image/webp" 
        : "image/jpeg";

      console.log(`Processing image: ${mimeType}, size: ${base64Data.length} chars`);

      const response = await ai.models.generateContent({
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
      });

      const text = response.text;
      if (!text) {
        return res.status(500).json({ error: "No response from AI" });
      }

      const cleanJson = text.replace(/```json|```/g, "").trim();
      
      let data;
      try {
        data = JSON.parse(cleanJson);
      } catch (e) {
        console.error("JSON Parse Error:", text);
        return res.status(500).json({ error: "Failed to parse market data" });
      }

      if (data.deals && data.deals.length > 0) {
        const cleanItemName = data.itemName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const encodedItem = encodeURIComponent(cleanItemName);

        data.deals = data.deals.map((deal: any) => {
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
        console.log(`Fetching SerpAPI prices for: ${data.itemName}`);
        const serpResults = await searchPricesMultiRegion(data.itemName, ["US", "TR", "DE"]);
        
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
        US: data.deals.filter((d: any) => d.region === "US"),
        TR: data.deals.filter((d: any) => d.region === "TR"),
        DE: data.deals.filter((d: any) => d.region === "DE"),
      };

      res.json({
        ...data,
        currency: "USD",
        regionSummary,
        searchRegions: ["US", "TR", "DE"],
      });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      
      if (error.status === 429 || error.message?.includes("429") || error.message?.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({ 
          error: "Too many requests. Please wait a moment and try again.",
          isRateLimit: true 
        });
      }
      
      res.status(500).json({ error: error.message || "Analysis failed" });
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
    } catch (error: any) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const assetData = req.body;

      if (!deviceId || !assetData) {
        return res.status(400).json({ error: "Device ID and asset data required" });
      }

      if (assetData.id) {
        const existing = await storage.getPortfolioAsset(assetData.id);
        if (existing) {
          const updated = await storage.updatePortfolioAsset(assetData.id, {
            ...assetData,
            deviceId,
          });
          return res.json(updated);
        }
      }

      const asset = await storage.createPortfolioAsset({
        ...assetData,
        deviceId,
        dateAdded: assetData.dateAdded ? new Date(assetData.dateAdded) : new Date(),
      });

      res.json(asset);
    } catch (error: any) {
      console.error("Portfolio create error:", error);
      res.status(500).json({ error: error.message || "Failed to create asset" });
    }
  });

  app.put("/api/portfolio/:deviceId/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      const updates = req.body;

      const asset = await storage.updatePortfolioAsset(assetId, updates);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json(asset);
    } catch (error: any) {
      console.error("Portfolio update error:", error);
      res.status(500).json({ error: error.message || "Failed to update asset" });
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
    } catch (error: any) {
      console.error("Portfolio delete error:", error);
      res.status(500).json({ error: error.message || "Failed to delete asset" });
    }
  });

  app.post("/api/portfolio/:deviceId/sync", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { assets } = req.body;

      if (!deviceId || !Array.isArray(assets)) {
        return res.status(400).json({ error: "Device ID and assets array required" });
      }

      const syncedAssets = [];
      for (const asset of assets) {
        const existing = await storage.getPortfolioAssets(deviceId);
        const match = existing.find(e => e.itemName === asset.itemName && e.dateAdded === asset.dateAdded);
        
        if (match) {
          const updated = await storage.updatePortfolioAsset(match.id, asset);
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
    } catch (error: any) {
      console.error("Portfolio sync error:", error);
      res.status(500).json({ error: error.message || "Failed to sync portfolio" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
