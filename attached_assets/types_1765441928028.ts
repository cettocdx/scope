
export interface ProductDeal {
  storeName: string;
  price: number;
  currency: string; // "USD", "EUR", "TRY", "JPY", "CNY"
  url: string;
  isBestDeal: boolean;
  region: 'US' | 'EU' | 'JP' | 'TR' | 'CN' | 'GLOBAL'; // New field for flags
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
  ASSET_DETAIL = 'ASSET_DETAIL', 
  SCANNING = 'SCANNING', 
  CAPTURING = 'CAPTURING', 
  REVIEW = 'REVIEW', 
  ANALYZING = 'ANALYZING', 
  RESULT = 'RESULT', 
  ERROR = 'ERROR'
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
