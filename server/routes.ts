import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";
import { insertPortfolioAssetSchema } from "@shared/schema";

const FORENSIC_ANALYSIS_PROMPT = `
ROLE: Elite Forensic Asset Authenticator & Global Market Analyst.
MISSION: Identify the object and perform a BROAD SPECTRUM PRICE ANALYSIS across multiple retailers.

PROTOCOL (EXECUTE IN ORDER):
1. [IDENTIFICATION]: 
   - Identify the EXACT model, generation, and variant.
   - Return a "itemName" that is PRECISE but SEARCH-FRIENDLY.

2. [MULTI-RETAILER PRICE SEARCH]:
   - Estimate the current market pricing based on your knowledge.
   - CHECK PRICES at: Amazon, Best Buy, Walmart, eBay, Official Brand Store.
   - Provide realistic price estimates for each retailer.

3. [DATA SYNTHESIS]:
   - Compile a "deals" list (3-5 distinct retailers).
   - "isBestDeal": Mark the lowest price.
   - "estimatedPrice": Weighted average of findings.

OUTPUT FORMAT (JSON ONLY, no markdown):
{
  "itemName": "String",
  "category": "String (e.g. Electronics, Fashion, Collectibles, Art, Jewelry, etc.)",
  "estimatedPrice": Number,
  "currency": "USD",
  "trendPercentage": Number (between -15 and +25),
  "confidenceScore": Number (between 70 and 99),
  "investmentRating": "BUY" | "SELL" | "HOLD",
  "deals": [
    {
      "storeName": "String",
      "price": Number,
      "currency": "USD",
      "url": "String (search URL for the product)",
      "region": "US",
      "isBestDeal": Boolean
    }
  ]
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

      res.json({
        ...data,
        currency: "USD",
      });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
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
