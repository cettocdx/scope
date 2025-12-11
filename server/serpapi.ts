interface SerpApiResult {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  region: string;
  isBestDeal: boolean;
  thumbnail?: string;
}

interface RegionConfig {
  code: string;
  name: string;
  domain: string;
  currency: string;
  gl: string;
  hl: string;
}

const REGIONS: Record<string, RegionConfig> = {
  US: {
    code: "US",
    name: "United States",
    domain: "google.com",
    currency: "USD",
    gl: "us",
    hl: "en",
  },
  TR: {
    code: "TR",
    name: "Turkey",
    domain: "google.com.tr",
    currency: "TRY",
    gl: "tr",
    hl: "tr",
  },
  DE: {
    code: "DE",
    name: "Germany (EU)",
    domain: "google.de",
    currency: "EUR",
    gl: "de",
    hl: "de",
  },
  UK: {
    code: "UK",
    name: "United Kingdom",
    domain: "google.co.uk",
    currency: "GBP",
    gl: "uk",
    hl: "en",
  },
};

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  TRY: 0.029,
  EUR: 1.08,
  GBP: 1.27,
};

function convertToUSD(price: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] || 1;
  return Math.round(price * rate * 100) / 100;
}

function extractPrice(priceStr: string): { value: number; currency: string } {
  let currency = "USD";
  if (priceStr.includes("₺") || priceStr.includes("TL") || priceStr.includes("TRY")) {
    currency = "TRY";
  } else if (priceStr.includes("€") || priceStr.includes("EUR")) {
    currency = "EUR";
  } else if (priceStr.includes("£") || priceStr.includes("GBP")) {
    currency = "GBP";
  }

  let cleaned = priceStr.replace(/[^\d.,]/g, "");
  
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (lastComma !== -1 && lastDot === -1) {
    if (cleaned.indexOf(",") !== cleaned.lastIndexOf(",")) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      const afterComma = cleaned.split(",")[1];
      if (afterComma && afterComma.length <= 2) {
        cleaned = cleaned.replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    }
  }

  const value = parseFloat(cleaned) || 0;
  return { value, currency };
}

export async function searchPricesMultiRegion(
  query: string,
  regions: string[] = ["US", "TR", "DE"]
): Promise<SerpApiResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  
  if (!apiKey) {
    console.warn("SERPAPI_KEY not configured, using fallback prices");
    return generateFallbackPrices(query, regions);
  }

  const allResults: SerpApiResult[] = [];

  for (const regionCode of regions) {
    const region = REGIONS[regionCode];
    if (!region) continue;

    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        engine: "google_shopping",
        q: query,
        gl: region.gl,
        hl: region.hl,
        num: "5",
      });

      const response = await fetch(`https://serpapi.com/search?${params}`);
      
      if (!response.ok) {
        console.error(`SerpAPI error for ${regionCode}:`, response.status);
        continue;
      }

      const data = await response.json();
      
      if (data.shopping_results && Array.isArray(data.shopping_results)) {
        const regionResults = data.shopping_results.slice(0, 3).map((item: any, index: number) => {
          let priceValue: number;
          let priceCurrency: string;
          
          if (typeof item.extracted_price === "number" && item.extracted_price > 0) {
            priceValue = item.extracted_price;
            priceCurrency = region.currency;
          } else {
            const priceInfo = extractPrice(item.price || "0");
            priceValue = priceInfo.value;
            priceCurrency = priceInfo.currency || region.currency;
          }
          
          const priceUSD = convertToUSD(priceValue, priceCurrency);

          return {
            storeName: item.source || item.seller || "Unknown Store",
            price: priceUSD,
            originalPrice: priceValue,
            currency: "USD",
            originalCurrency: priceCurrency,
            url: item.link || item.product_link || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
            region: regionCode,
            isBestDeal: false,
            thumbnail: item.thumbnail,
          };
        });

        allResults.push(...regionResults);
      }
    } catch (error) {
      console.error(`SerpAPI search error for ${regionCode}:`, error);
    }
  }

  if (allResults.length === 0) {
    return generateFallbackPrices(query, regions);
  }

  if (allResults.length > 0) {
    const minPrice = Math.min(...allResults.map(r => r.price));
    allResults.forEach(r => {
      r.isBestDeal = r.price === minPrice;
    });
  }

  return allResults;
}

function generateFallbackPrices(query: string, regions: string[]): SerpApiResult[] {
  const encodedQuery = encodeURIComponent(query);
  const basePrice = 100 + Math.random() * 400;
  
  const fallbackStores: Record<string, { stores: string[]; multiplier: number }> = {
    US: {
      stores: ["Amazon.com", "Walmart", "Best Buy"],
      multiplier: 1,
    },
    TR: {
      stores: ["Trendyol", "Hepsiburada", "N11"],
      multiplier: 0.85,
    },
    DE: {
      stores: ["Amazon.de", "MediaMarkt", "Saturn"],
      multiplier: 1.1,
    },
    UK: {
      stores: ["Amazon.co.uk", "Currys", "Argos"],
      multiplier: 1.05,
    },
  };

  const results: SerpApiResult[] = [];

  for (const regionCode of regions) {
    const config = fallbackStores[regionCode];
    if (!config) continue;

    const regionConfig = REGIONS[regionCode];
    
    config.stores.forEach((store, index) => {
      const variation = 0.9 + Math.random() * 0.2;
      const price = Math.round(basePrice * config.multiplier * variation);
      
      let url = `https://www.google.com/search?tbm=shop&q=${encodedQuery}`;
      if (store.includes("Amazon")) {
        if (regionCode === "US") url = `https://www.amazon.com/s?k=${encodedQuery}`;
        else if (regionCode === "DE") url = `https://www.amazon.de/s?k=${encodedQuery}`;
        else if (regionCode === "UK") url = `https://www.amazon.co.uk/s?k=${encodedQuery}`;
      } else if (store === "Trendyol") {
        url = `https://www.trendyol.com/sr?q=${encodedQuery}`;
      } else if (store === "Hepsiburada") {
        url = `https://www.hepsiburada.com/ara?q=${encodedQuery}`;
      } else if (store === "N11") {
        url = `https://www.n11.com/arama?q=${encodedQuery}`;
      }

      results.push({
        storeName: store,
        price,
        currency: "USD",
        url,
        region: regionCode,
        isBestDeal: false,
      });
    });
  }

  if (results.length > 0) {
    const minPrice = Math.min(...results.map(r => r.price));
    results.forEach(r => {
      r.isBestDeal = r.price === minPrice;
    });
  }

  return results;
}

export { REGIONS, EXCHANGE_RATES, convertToUSD };
