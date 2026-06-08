export type Condition = 'NEW' | 'USED' | 'LIKE_NEW';
export type Country = 'USA' | 'TURKEY' | 'EUROPE';
export type Currency = 'USD' | 'TRY' | 'EUR';
export type ProductCategory = 'Electronics' | 'Fashion' | 'Watch' | 'Jewelry' | 'Footwear' | 'Bags' | 'Accessories' | 'Other';

export interface ProductDNA {
  title: string;
  category: ProductCategory;
  brand?: string;
  model?: string;
  variant?: Record<string, string>;
  identifiers?: {
    gtin?: string;
    sku?: string;
    serial?: string;
  };
  condition: Condition;
  confidence: {
    visual: number;
    ocr: number;
    barcode: number;
    overall: number;
  };
  searchQueries: string[];
  mustHaveTokens: string[];
  imageHash?: string;
}

export interface ProductDeal {
  storeName: string;
  price: number;
  originalPrice?: number;
  currency: string;
  url: string;
  isBestDeal: boolean;
  region: 'US' | 'EU' | 'JP' | 'TR' | 'CN' | 'GLOBAL' | 'DE' | 'UK' | 'FR' | 'NL' | 'ES' | 'IT' | 'AE';
  condition?: Condition;
  isOutlier?: boolean;
  /** True when this is a "search on X" link rather than a real priced offer. */
  isSearchLink?: boolean;
  qualityScore?: number;
}

export interface PriceRange {
  min: number;
  median: number;
  max: number;
  currency: string;
}

export interface AssetAttributes {
  size?: string;
  color?: string;
  material?: string;
  model?: string;
  series?: string;
  year?: string;
}

export interface AssetData {
  itemName: string;
  estimatedPrice: number;
  /** True only when at least one real marketplace offer was found. */
  priceFound?: boolean;
  currency: string;
  trendPercentage: number;
  confidenceScore: number;
  category: string;
  /** True for age-restricted / legally controlled goods (vape, alcohol, weapons…). */
  regulatedCategory?: boolean;
  investmentRating: 'BUY' | 'SELL' | 'HOLD';
  ratingReason?: string;
  deals?: ProductDeal[];
  searchLinks?: string[];
  priceRange?: PriceRange;
  /** How many real offers backed the price (trust signal). */
  sourceCount?: number;
  /** When the price was computed (ISO), or null if no real price. */
  pricedAt?: string | null;
  condition?: Condition;
  country?: Country;
  attributes?: AssetAttributes;
  outlierCount?: number;
  dna?: ProductDNA;
  brand?: string;
  model?: string;
}

export interface PortfolioAsset extends AssetData {
  id: string;
  dateAdded: string;
  purchasePrice: number;
  isAuthentic: boolean;
  history: number[];
  /** Persisted full image on the device filesystem (file:// uri). */
  imageUri?: string;
  /** Small resized image for list rendering (file:// uri). */
  thumbnailUri?: string;
  /**
   * Legacy inline image (data: URI). Kept only as a fallback for assets stored
   * before the filesystem migration; new assets use imageUri/thumbnailUri.
   */
  imageBase64?: string;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface FXRate {
  base: Currency;
  quote: Currency;
  rate: number;
  updatedAt: string;
}

export interface VariantOption {
  label: string;
  value: string;
}

export interface CategoryVariants {
  sizes?: VariantOption[];
  colors?: VariantOption[];
  materials?: VariantOption[];
  models?: VariantOption[];
}
