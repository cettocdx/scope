export type Condition = 'NEW' | 'USED' | 'LIKE_NEW';
export type Country = 'USA' | 'TURKEY' | 'EUROPE';
export type Currency = 'USD' | 'TRY' | 'EUR';

export interface ProductDeal {
  storeName: string;
  price: number;
  originalPrice?: number;
  currency: string;
  url: string;
  isBestDeal: boolean;
  region: 'US' | 'EU' | 'JP' | 'TR' | 'CN' | 'GLOBAL' | 'DE';
  condition?: Condition;
  isOutlier?: boolean;
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
  currency: string;
  trendPercentage: number;
  confidenceScore: number;
  category: string;
  investmentRating: 'BUY' | 'SELL' | 'HOLD';
  ratingReason?: string;
  deals?: ProductDeal[];
  searchLinks?: string[];
  priceRange?: PriceRange;
  condition?: Condition;
  country?: Country;
  attributes?: AssetAttributes;
  outlierCount?: number;
}

export interface PortfolioAsset extends AssetData {
  id: string;
  dateAdded: string;
  purchasePrice: number;
  isAuthentic: boolean;
  history: number[];
  imageBase64: string;
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

export enum AppState {
  HOME = 'HOME',
  VAULT = 'VAULT',
  ASSET_DETAIL = 'ASSET_DETAIL',
  SCANNING = 'SCANNING',
  REVIEW = 'REVIEW',
  CONFIRM = 'CONFIRM',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
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
