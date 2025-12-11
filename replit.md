# SCOPE - AI-Powered Asset Scanner

## Overview
SCOPE is a mobile app for scanning, identifying, and tracking valuable assets. It uses Gemini AI for product identification and provides multi-retailer price comparison, portfolio management with database sync, and financial analytics.

## Tech Stack
- **Frontend**: Expo React Native with React Navigation
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini (via @google/genai)
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

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session secret key

## Running the App
- Dev server: `npm run all:dev`
- Expo on port 8081, Express on port 5000
