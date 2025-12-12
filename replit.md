# SCOPE - AI-Powered Asset Scanner

## Overview
SCOPE is a mobile app for scanning, identifying, and tracking valuable assets. It uses Gemini AI for product identification and provides multi-retailer price comparison, portfolio management with database sync, and financial analytics.

## Tech Stack
- **Frontend**: Expo React Native with React Navigation
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini (via @google/genai) + Ximilar Fashion AI
- **Price Data**: SerpAPI for multi-region real-time pricing
- **State Management**: TanStack React Query

## Project Structure
```
client/
├── components/       # Reusable UI components
├── constants/        # Theme, colors, spacing
├── lib/              # Query client, API utilities
├── navigation/       # React Navigation setup
├── screens/          # App screens
├── services/         # Business logic (portfolioService)
└── types/            # TypeScript types

server/
├── db.ts             # Database connection
├── index.ts          # Express app setup
├── routes.ts         # API routes
├── serpapi.ts        # SerpAPI multi-region price search
├── storage.ts        # Database operations
└── templates/        # HTML templates

shared/
└── schema.ts         # Drizzle schema definitions
```

## Key Features
1. **Camera Scanning**: Capture items using device camera
2. **AI Analysis**: Gemini AI identifies items and provides valuations
3. **Price Comparison**: Multi-retailer price data
4. **Portfolio Management**: Track assets with sync across devices
5. **Analytics Dashboard**: Portfolio metrics and AI recommendations
6. **Share Feature**: Export asset reports as markdown

## Database Schema
- **users**: id, username, password
- **portfolioAssets**: id, deviceId, assetData (JSON), createdAt, updatedAt

## API Endpoints
- `GET /api/portfolio?deviceId=xxx` - Get user's portfolio
- `POST /api/portfolio` - Add/update portfolio asset
- `DELETE /api/portfolio/:id` - Remove asset from portfolio
- `POST /api/analyze` - Analyze image with Gemini AI
- `GET /api/fx?base=USD&quote=TRY` - Get currency exchange rate
- `POST /api/valuate` - Calculate valuation with outlier detection

## Recent Changes (Dec 2024)
- Added Analytics screen with portfolio metrics, best/worst performers, category breakdown, and AI recommendations
- Implemented database sync for multi-device support with client-generated IDs
- Fixed ID synchronization between client and server using onConflictDoUpdate (upsert)
- Added share functionality for asset reports
- Added promotional content generation for marketing
- Fixed PayloadTooLargeError by increasing body limit to 50mb
- ROI display in Vault header with trend indicator
- Real portfolio value history in charts aggregated from asset history arrays
- Added analytics button to Vault screen header
- Fixed Gemini model name (gemini-2.5-flash) for valid API compatibility
- Added image validation and mime type detection for camera captures
- Enhanced error handling in analyze endpoint with webp support
- Added SerpAPI integration for real-time multi-region price comparison
- Implemented multi-region price search (USA, Turkey, Europe/Germany)
- Added region-grouped price display in ResultScreen with color-coded sections
- Currency conversion to USD for unified price comparison

### Product DNA System (Dec 12, 2024)
- Implemented ProductDNA structure for precise product identification and matching
- DNA includes: title, category, brand, model, variant (size/color/material/capacity), condition
- Confidence scoring: visual, OCR, barcode, overall weighted average
- AI generates 5-10 searchQueries from most specific to generic for marketplace search
- mustHaveTokens ensure offer matching accuracy (e.g. "45mm", "Series 9", "GPS")
- SerpAPI now uses DNA searchQueries instead of generic itemName for better price matching
- Enhanced Gemini prompt with DNA output format and examples (Apple Watch, Prada Wallet)

### Valuation & UX Features (Dec 12, 2024)
- Added Confirm & Refine screen with variant selectors (size, color, material) and condition picker
- Implemented valuation endpoint with min/median/max calculation using IQR outlier detection
- Added FX endpoint for USD/TRY/EUR currency conversion
- Updated Result screen to show price range (min/median/max) with outlier badges
- Added AI Rating explanation sheet with "Why?" button showing rating factors
- Updated navigation flow: Scanner → Review → Confirm (optional) → Analyzing → Result
- ReviewScreen now offers Quick Analyze or Confirm & Refine options
- Outlier deals marked with yellow badges and crossed-out prices
- Enhanced types with Condition, Country, Currency, PriceRange, AssetAttributes, ProductDNA

### AI Optimization (Dec 11, 2024)
- Enhanced Gemini AI prompt for luxury brand identification accuracy
  - Added specific visual identifiers for Prada, Bottega Veneta, Gucci, LV, Chanel, Hermes
  - Added confidence scoring (50-99) with visual evidence requirements
  - Prevents brand fabrication/guessing with strict rules
- Added region-specific store allowlists:
  - Turkey: Trendyol, Hepsiburada, Beymen, Boyner, Vakko, etc.
  - USA: Amazon, Nordstrom, Saks, Neiman Marcus, etc.
  - Europe: Zalando, Mytheresa, Breuninger, etc.
- Implemented store filtering to only show real stores per region
- Added blocked store list (Il Duomo, Bobo, Luxe Cheshire, etc.)
- Global luxury platforms (Farfetch, Net-a-Porter, SSENSE) allowed in all regions
- Better rate limit error handling (429 errors)

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session secret key
- `SERPAPI_KEY`: SerpAPI key for real-time price searches
- `XIMILAR_API_KEY`: Ximilar Fashion AI for product recognition
- `CLARIFAI_API_KEY`: Clarifai for general image recognition and concepts

## Running the App
- Dev server: `npm run all:dev`
- Expo on port 8081, Express on port 5000
