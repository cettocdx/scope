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

/**
 * product: a specific brand/model; generic: buyable but unbranded;
 * not_for_sale: animals, people, places, served food… (no price search).
 */
export type IdentityKind = "product" | "generic" | "not_for_sale";

export interface ProductIdentity {
  kind: IdentityKind;
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
  /** Other buyable things seen in the same photo. */
  others: string[];
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
  /** Lets the server look up the seller's own page (POST /api/offer-link). */
  resolveToken: string | null;
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
    /** Best balance of price and trust — from the user's own market when it has a trustworthy offer. */
    recommended: Offer | null;
    /** True when `recommended` comes from the user's own market. */
    recommendedIsLocal: boolean;
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
  /** The user's own market: its trustworthy offers are recommended first. */
  homeMarket?: Market | null;
}

/** A page Google Lens found showing the same-looking item, usually a shop. */
export interface VisualMatch {
  title: string;
  store: string;
  url: string;
  thumbnail: string | null;
  /** In the shop's currency, when Lens shows a price. */
  price: number | null;
  currency: string | null;
  priceUSD: number | null;
  inStock: boolean | null;
}

export interface VisualMatchesResponse {
  /** False when visual matching is not configured on the server. */
  available: boolean;
  matches: VisualMatch[];
  tookMs: number;
}
