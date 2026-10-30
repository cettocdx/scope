import type { Offer, PriceReport, ProductIdentity } from "@shared/scan";

export type { Offer, PriceReport, ProductIdentity };

/** The slim offer shape the cloud stores (portfolio_assets.deals). */
export interface StoredDeal {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  region: string;
}

/**
 * A saved scan. The cloud row keeps the portable fields (name, category, best
 * price, offers); the full identity and price report live on the device.
 */
export interface SavedItem {
  id: string;
  itemName: string;
  category: string;
  /** Recommended price in USD at save time (0 when no live price). */
  estimatedPrice: number;
  currency: string;
  purchasePrice: number;
  trendPercentage: number;
  confidenceScore: number;
  investmentRating: string;
  isAuthentic: boolean;
  history: number[];
  deals?: StoredDeal[];
  dateAdded: string;
  imageUri?: string;
  thumbnailUri?: string;
  /** Legacy inline image for items saved before images moved to files. */
  imageBase64?: string;
  identity?: ProductIdentity;
  report?: PriceReport;
}

/** Kept for the sync layer, which predates the rename. */
export type PortfolioAsset = SavedItem;
