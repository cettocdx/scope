/**
 * The scan contract shared by the app and the API.
 *
 * A scan is two calls: `/api/identify` answers "what is this?" in a second or
 * two, then `/api/prices` answers "where can I buy it, cheapest and safest?"
 * across the US, Europe and Turkey. The app renders the identity first and
 * fills prices in as they land.
 */

export const CATEGORIES = [
  "Electronics",
  "Fashion",
  "Footwear",
  "Bags",
  "Watch",
  "Jewelry",
  "Beauty",
  "Home",
  "Appliance",
  "Tool",
  "Toy",
  "Sports",
  "Collectible",
  "Vehicle",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ProductIdentity {
  /** Full, shop-ready product name, e.g. "Apple AirPods Pro 2 (USB-C)". */
  name: string;
  brand: string | null;
  model: string | null;
  /** Variant details that change the price: size, storage, colour… */
  variant: string | null;
  category: Category;
  /** 0–100: how sure the model is about the exact product. */
  confidence: number;
  /** The query used to find offers (most specific first). */
  searchQuery: string;
  /** Broader fallbacks if the specific query finds nothing. */
  altQueries: string[];
  /** Tokens an offer title should contain to count as the same product. */
  mustHave: string[];
  /** Other products it could be, when unsure. */
  alternatives: string[];
  /** Age-restricted goods (vape, alcohol, weapons…): links are hidden. */
  regulated: boolean;
  /** A UPC/EAN read from the item, when present. */
  barcode: string | null;
  /**
   * The model's own retail guess in USD. Used only on the server to drop
   * accessories that match the query; never shown as a price.
   */
  estimateUSD: number | null;
}

export interface IdentifyResponse {
  identity: ProductIdentity;
  /** Server-side time for the identification, in ms. */
  tookMs: number;
}

/** The three markets SCOPE compares. */
export const MARKETS = ["US", "EU", "TR"] as const;
export type Market = (typeof MARKETS)[number];

export type TrustTier = "official" | "major" | "marketplace" | "unknown";

export interface Offer {
  id: string;
  store: string;
  /** Store website host when known, e.g. "bestbuy.com". */
  domain: string | null;
  title: string | null;
  url: string;
  /** Price in the store's own currency. */
  price: number;
  currency: string;
  /** Same price converted to USD with live FX, for comparison. */
  priceUSD: number;
  /** Country code the offer was found in (US, DE, FR, IT, ES, NL, UK, TR). */
  country: string;
  market: Market;
  trust: {
    /** 0–100. */
    score: number;
    tier: TrustTier;
    /** Short, human reasons, e.g. "Official Apple store", "4.7★ · 2.1k reviews". */
    reasons: string[];
  };
  rating: number | null;
  reviews: number | null;
  delivery: string | null;
  thumbnail: string | null;
  /** Far below the going price: possible scam, counterfeit or wrong item. */
  suspicious: boolean;
}

export interface MarketSummary {
  market: Market;
  offers: Offer[];
  /** Lowest trustworthy price in this market, USD. */
  lowestUSD: number | null;
  /** Google Shopping search for this market, always available. */
  searchUrl: string;
}

export interface PriceReport {
  query: string;
  markets: MarketSummary[];
  picks: {
    cheapest: Offer | null;
    safest: Offer | null;
    /** Best balance of price and trust. */
    recommended: Offer | null;
  };
  /** Typical new price across all trustworthy offers, USD. */
  range: { min: number; median: number; max: number } | null;
  sourceCount: number;
  /** ISO time the prices were fetched. */
  pricedAt: string;
  /** False when the price search is not configured (no SERPAPI_KEY). */
  live: boolean;
}

export interface PricesRequest {
  query: string;
  altQueries?: string[];
  mustHave?: string[];
  brand?: string | null;
  barcode?: string | null;
  estimateUSD?: number | null;
}
