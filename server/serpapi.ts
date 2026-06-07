interface SerpApiResult {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  region: string;
  isBestDeal: boolean;
  thumbnail?: string;
  originalPrice?: number;
  originalCurrency?: string;
}

/**
 * Minimal shape of a single entry in SerpAPI's `shopping_results` array. Only
 * the fields we actually read are declared; everything is optional because the
 * upstream payload is untrusted and may omit any of them.
 */
interface SerpShoppingResult {
  source?: string;
  seller?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  thumbnail?: string;
}

/** Minimal shape of the SerpAPI search response we consume. */
interface SerpApiResponse {
  shopping_results?: SerpShoppingResult[];
}

interface RegionConfig {
  code: string;
  name: string;
  domain: string;
  currency: string;
  gl: string;
  hl: string;
}

// Wraps fetch with an AbortController-based timeout so external calls can never
// hang indefinitely. On timeout the request is aborted and the call rejects
// (an AbortError), which existing try/catch fallbacks treat as a normal failure.
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 9000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
  FR: { code: "FR", name: "France", domain: "google.fr", currency: "EUR", gl: "fr", hl: "fr" },
  NL: { code: "NL", name: "Netherlands", domain: "google.nl", currency: "EUR", gl: "nl", hl: "nl" },
  ES: { code: "ES", name: "Spain", domain: "google.es", currency: "EUR", gl: "es", hl: "es" },
  IT: { code: "IT", name: "Italy", domain: "google.it", currency: "EUR", gl: "it", hl: "it" },
  AE: { code: "AE", name: "Dubai (UAE)", domain: "google.ae", currency: "AED", gl: "ae", hl: "en" },
};

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  TRY: 0.029,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.272,
};

// Curated list of REAL stores that exist in each region
const REGION_STORE_ALLOWLIST: Record<string, string[]> = {
  US: [
    "amazon", "walmart", "ebay", "target", "best buy", "nordstrom", "neiman marcus",
    "saks", "bloomingdales", "macys", "nike", "adidas", "footlocker", "zappos",
    "farfetch", "ssense", "net-a-porter", "matches", "shopbop", "revolve",
    "stockx", "goat", "grailed", "poshmark", "therealreal", "vestiaire",
    "gucci", "prada", "louis vuitton", "chanel", "dior", "fendi", "versace",
    "cettire", "mytheresa", "24s", "luisaviaroma", "bergdorf", "barneys"
  ],
  TR: [
    "trendyol", "hepsiburada", "n11", "gittigidiyor", "amazon.com.tr", "morhipo",
    "boyner", "vakko", "beymen", "network", "ipekyol", "koton", "mango", "zara",
    "lcwaikiki", "defacto", "derimod", "hotiç", "flo", "yargici", "machka",
    "sarar", "damat", "kiğılı", "columbia", "skechers", "nike.com.tr",
    "prada.com", "gucci.com", "louis vuitton", "farfetch.com"
  ],
  DE: [
    "amazon.de", "zalando", "aboutyou", "otto", "breuninger", "mytheresa",
    "fashionette", "ludwig beck", "engelhorn", "kadewe", "galeria", "peek & cloppenburg",
    "douglas", "christ", "footlocker.de", "snipes", "nike.de", "adidas.de",
    "farfetch", "net-a-porter", "matchesfashion", "ssense", "luisaviaroma",
    "gucci.com", "prada.com", "louis vuitton", "dior.com", "fendi.com",
    "cettire", "vestiaire collective", "rebelle"
  ],
  UK: [
    "amazon.co.uk", "selfridges", "harrods", "harvey nichols", "liberty",
    "net-a-porter", "matchesfashion", "farfetch", "browns", "ssense",
    "john lewis", "asos", "very", "next", "flannels", "end clothing",
    "footlocker.co.uk", "jd sports", "nike.co.uk", "adidas.co.uk"
  ]
};

// Store validation: block known fake/scam stores, otherwise accept. We favor
// broad multi-region coverage (8 countries); the downstream price-sanity filter
// (vs the AI estimate) removes mispriced/irrelevant offers, so a strict
// per-region allowlist is no longer needed to keep results clean.
function isValidStoreForRegion(storeName: string, region: string): boolean {
  const lowerStore = storeName.toLowerCase();
  if (!lowerStore.trim()) return false;

  const blockedStores = ["il duomo", "bobo", "luxe cheshire", "cheshire oaks", "bobobo"];
  if (blockedStores.some((b) => lowerStore.includes(b))) return false;

  // Curated known-good stores are always accepted (kept as a positive signal).
  const allowlist = REGION_STORE_ALLOWLIST[region] || [];
  if (allowlist.some((a) => lowerStore.includes(a.toLowerCase()))) return true;

  // Any other non-blocked store is accepted for coverage.
  return true;
}

// Normalize store name for better matching
function normalizeStoreName(storeName: string): string {
  return storeName
    .replace(/\.(com|de|co\.uk|com\.tr|fr|it|es)/gi, "")
    .replace(/[^a-zA-Z0-9\s&]/g, "")
    .trim();
}

function convertToUSD(price: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] || 1;
  return Math.round(price * rate * 100) / 100;
}

export function extractPrice(priceStr: string): { value: number; currency: string } {
  let currency = "USD";
  if (priceStr.includes("₺") || priceStr.includes("TL") || priceStr.includes("TRY")) {
    currency = "TRY";
  } else if (priceStr.includes("€") || priceStr.includes("EUR")) {
    currency = "EUR";
  } else if (priceStr.includes("£") || priceStr.includes("GBP")) {
    currency = "GBP";
  } else if (priceStr.includes("AED") || priceStr.includes("د.إ") || priceStr.includes("DH")) {
    currency = "AED";
  }

  let cleaned = priceStr.replace(/[^\d.,]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Both separators present: the LAST one to appear is the decimal separator,
    // the other is the thousands separator. e.g. "1.234,56" -> 1234.56,
    // "1,234.56" -> 1234.56.
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only commas. A single comma followed by EXACTLY 2 digits is a decimal
    // separator (e.g. "19,99" -> 19.99); anything else (3+ trailing digits or
    // multiple groups) is a thousands separator (e.g. "1,299" -> 1299,
    // "1,234,567" -> 1234567).
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasDot) {
    // Only dots. A single dot followed by EXACTLY 2 digits is a decimal
    // separator (e.g. "19.99" -> 19.99); a single dot followed by 3 digits is a
    // thousands separator (e.g. "1.234" -> 1234); multiple dots are thousands
    // separators (e.g. "1.234.567" -> 1234567).
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length === 2) {
      // keep as-is, it is already a valid decimal
    } else {
      cleaned = cleaned.replace(/\./g, "");
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
    // No API key: do NOT fabricate prices. Return empty so callers fall back to
    // AI-estimated pricing instead of made-up numbers.
    console.warn("SERPAPI_KEY not configured, returning no results");
    return [];
  }

  async function fetchRegion(regionCode: string): Promise<SerpApiResult[]> {
    const region = REGIONS[regionCode];
    if (!region) return [];

    try {
      const params = new URLSearchParams({
        api_key: apiKey as string,
        engine: "google_shopping",
        q: query,
        gl: region.gl,
        hl: region.hl,
        num: "5",
      });

      const response = await fetchWithTimeout(`https://serpapi.com/search?${params}`);
      
      if (!response.ok) {
        console.error(`SerpAPI error for ${regionCode}:`, response.status);
        return [];
      }

      const data = (await response.json()) as SerpApiResponse;

      if (data.shopping_results && Array.isArray(data.shopping_results)) {
        // Filter and process results - only include stores valid for this region
        const validResults = data.shopping_results
          .filter((item: SerpShoppingResult) => {
            const storeName = item.source || item.seller || "";
            // Check if store is valid for this region
            return isValidStoreForRegion(storeName, regionCode);
          })
          .slice(0, 3);

        // If no valid stores found, skip this region. We never fabricate prices.
        if (validResults.length === 0) {
          console.log(`No valid stores found for ${regionCode}, skipping`);
          return [];
        }

        const regionResults = validResults.map((item: SerpShoppingResult) => {
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
          const normalizedStore = normalizeStoreName(item.source || item.seller || "Store");

          return {
            storeName: normalizedStore,
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

        return regionResults;
      }
      return [];
    } catch (error) {
      console.error(`SerpAPI search error for ${regionCode}:`, error);
      return [];
    }
  }

  // Query all regions in parallel so total latency ~= the slowest region,
  // not the sum of all of them.
  const settled = await Promise.allSettled(regions.map(fetchRegion));
  const allResults: SerpApiResult[] = settled.flatMap((s) =>
    s.status === "fulfilled" ? s.value : [],
  );

  if (allResults.length > 0) {
    const minPrice = Math.min(...allResults.map(r => r.price));
    allResults.forEach(r => {
      r.isBestDeal = r.price === minPrice;
    });
  }

  return allResults;
}

export { REGIONS, EXCHANGE_RATES, convertToUSD };
