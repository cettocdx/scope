export interface ProductDeal {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  isBestDeal: boolean;
  region: 'US' | 'EU' | 'JP' | 'TR' | 'CN' | 'GLOBAL';
}

export interface AssetData {
  itemName: string;
  estimatedPrice: number;
  currency: string;
  trendPercentage: number;
  confidenceScore: number;
  category: string;
  investmentRating: 'BUY' | 'SELL' | 'HOLD';
  deals?: ProductDeal[];
  searchLinks?: string[];
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

export enum AppState {
  HOME = 'HOME',
  VAULT = 'VAULT',
  ASSET_DETAIL = 'ASSET_DETAIL',
  SCANNING = 'SCANNING',
  REVIEW = 'REVIEW',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}
