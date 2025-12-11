import { GoogleGenAI } from "@google/genai";
import { AssetData } from "../types";

// Safe API Key access for Web/Native
const getApiKey = () => {
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.API_KEY || '';
        }
        return '';
    } catch (e) {
        return '';
    }
};

const getAiClient = () => new GoogleGenAI({ apiKey: getApiKey() });

// STRICT FORENSIC PROMPT
const FORENSIC_ANALYSIS_PROMPT = `
ROLE: Elite Forensic Asset Authenticator & Global Market Analyst.
MISSION: Identify the object and perform a BROAD SPECTRUM PRICE ANALYSIS across multiple retailers.

PROTOCOL (EXECUTE IN ORDER):
1. [IDENTIFICATION]: 
   - Identify the EXACT model, generation, and variant.
   - **CRITICAL**: Return a "itemName" that is PRECISE but SEARCH-FRIENDLY.

2. [MULTI-RETAILER PRICE SEARCH]:
   - USE 'googleSearch' to find current pricing.
   - CHECK PRICES at: Amazon, Best Buy, Walmart, eBay, Official Brand Store.
   - IF specific product pages are found in search tools, use those URLs.
   - IF NOT, estimate the price based on general market data for that retailer, but leave the URL empty (the system will generate a search link).

3. [DATA SYNTHESIS]:
   - Compile a "deals" list (3-5 distinct retailers).
   - "isBestDeal": Mark the lowest price.
   - "estimatedPrice": Weighted average of findings.

OUTPUT FORMAT (JSON ONLY):
{
  "itemName": "String",
  "category": "String",
  "estimatedPrice": Number,
  "currency": "USD",
  "trendPercentage": Number,
  "confidenceScore": Number,
  "investmentRating": "BUY" | "SELL" | "HOLD",
  "deals": [
    {
      "storeName": "String",
      "price": Number,
      "currency": "USD",
      "url": "String",
      "region": "US",
      "isBestDeal": Boolean
    }
  ]
}
`;

export const analyzeImage = async (images: string[]): Promise<AssetData> => {
  try {
    const ai = getAiClient();
    
    // In React Native/Expo, images often come as base64 without the prefix, or with it.
    // We clean it just in case.
    const imageParts = images.map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.replace(/^data:image\/(png|jpeg|jpg);base64,/, '')
      }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: {
        parts: [
          ...imageParts,
          { text: FORENSIC_ANALYSIS_PROMPT }
        ]
      },
      config: {
        temperature: 0.0,
        topK: 1, 
        topP: 0.1,
        tools: [{ googleSearch: {} }], 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const cleanJson = text.replace(/```json|```/g, '').trim();
    
    let data: AssetData;
    try {
      data = JSON.parse(cleanJson) as AssetData;
    } catch (e) {
      console.error("JSON Parse Error", text);
      throw new Error("Failed to parse market data.");
    }

    // Grounding & Fallback Logic
    const groundingLinks: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          groundingLinks.push(chunk.web.uri);
        }
      });
    }

    if (data.deals && data.deals.length > 0) {
        data.deals = data.deals.map((deal) => {
            const cleanItemName = data.itemName.replace(/[^a-zA-Z0-9 ]/g, '').trim();
            const encodedItem = encodeURIComponent(cleanItemName);
            const storeLower = deal.storeName.toLowerCase();

            // 1. Exact Match Grounding
            const isGroundingUrl = groundingLinks.includes(deal.url);
            if (isGroundingUrl && deal.url.startsWith('http')) return deal;

            // 2. Fuzzy Match Grounding
            const matchedGroundingLink = groundingLinks.find(link => {
                const linkLower = link.toLowerCase();
                const storeSimple = storeLower.replace(/[^a-z0-9]/g, '');
                return linkLower.includes(storeSimple);
            });

            if (matchedGroundingLink) {
                return { ...deal, url: matchedGroundingLink };
            }

            // 3. Smart Fallback Deep Links
            let searchUrl = '';
            if (storeLower.includes('amazon')) {
                searchUrl = `https://www.amazon.com/s?k=${encodedItem}`;
            } else if (storeLower.includes('walmart')) {
                searchUrl = `https://www.walmart.com/search?q=${encodedItem}`;
            } else if (storeLower.includes('ebay')) {
                searchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodedItem}`;
            } else if (storeLower.includes('best buy') || storeLower.includes('bestbuy')) {
                searchUrl = `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedItem}`;
            } else if (storeLower.includes('target')) {
                searchUrl = `https://www.target.com/s?searchTerm=${encodedItem}`;
            } else {
                searchUrl = `https://www.google.com/search?tbm=shop&q=${encodedItem}+${encodeURIComponent(deal.storeName)}`;
            }

            return { ...deal, url: searchUrl };
        });
    }

    // Fallback if no deals found
    if (!data.deals || data.deals.length === 0) {
        data.deals = groundingLinks.slice(0, 5).map((link, idx) => ({
            storeName: new URL(link).hostname.replace('www.', '').split('.')[0].toUpperCase(),
            price: data.estimatedPrice, 
            currency: "USD",
            url: link,
            isBestDeal: idx === 0,
            region: 'GLOBAL'
        }));
    }

    return {
      ...data,
      currency: "USD",
      searchLinks: groundingLinks
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const generateAssetVideo = async (base64Image: string, promptContext: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic macro product shot of ${promptContext}. Dark void, rim lighting. 8k highly detailed.`, 
      image: {
        imageBytes: base64Data,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '9:16'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned");

    return `${downloadLink}&key=${getApiKey()}`;

  } catch (e: any) {
    throw e;
  }
};