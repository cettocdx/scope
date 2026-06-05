# SCOPE — AI-Powered Asset Scanner

SCOPE is a mobile app for scanning, identifying, and tracking valuable assets
(luxury fashion, electronics, watches, and more). Point your camera at an item
and SCOPE uses AI to identify it, pull real multi-region market prices, value it
with outlier-aware statistics, and track it in a synced portfolio with financial
analytics.

## Features

- **Camera Scanning** — Capture items with the device camera.
- **AI Analysis** — Google Gemini identifies the item and produces a structured
  "Product DNA" (brand, model, variant, condition, confidence scores), augmented
  by Ximilar (fashion attributes) and Clarifai (general vision).
- **Multi-Region Price Comparison** — SerpAPI fetches real prices across the US,
  Turkey, and Germany (EU), normalized to USD.
- **Outlier-Aware Valuation** — IQR-based outlier detection produces a clean
  min / median / max price range.
- **Portfolio Management** — Track assets with cross-device sync (device-scoped).
- **Analytics Dashboard** — Portfolio metrics, best/worst performers, category
  breakdown, and AI recommendations.

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Frontend         | Expo React Native + React Navigation               |
| Backend          | Express.js (TypeScript, run via `tsx`)             |
| Database         | PostgreSQL with Drizzle ORM                        |
| AI / Vision      | Google Gemini (`@google/genai`), Ximilar, Clarifai |
| Price Data       | SerpAPI (Google Shopping, multi-region)            |
| State Management | TanStack React Query                               |
| Testing          | Vitest                                             |

## Architecture

The repo is a single workspace with three top-level source areas:

```
client/    Expo React Native app
├── components/   Reusable UI components
├── constants/    Theme, colors, spacing
├── lib/          Query client, API utilities
├── navigation/   React Navigation setup
├── screens/      App screens
├── services/     Business logic (portfolioService)
└── types/        TypeScript types

server/    Express API
├── db.ts         Database connection (requires DATABASE_URL)
├── index.ts      Express app setup
├── routes.ts     API routes + valuation logic
├── serpapi.ts    SerpAPI multi-region price search + price parsing
├── ximilar.ts    Ximilar fashion analysis
├── clarifai.ts   Clarifai vision analysis
├── storage.ts    Database operations (Drizzle)
└── __tests__/    Vitest unit tests

shared/    Code shared between client and server
└── schema.ts     Drizzle schema + Zod validation
```

The Expo dev server runs on port **8081** and the Express API on port **5000**.

## Getting Started

### Prerequisites

- **Node.js 20**
- **PostgreSQL** (a reachable instance and a connection string)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in the values:

```bash
cp .env.example .env
```

See [Environment Variables](#environment-variables) below for what each value
does. At minimum you need `DATABASE_URL`; the AI/price providers degrade
gracefully when their keys are absent (the app falls back to AI-estimated
pricing rather than fabricating data).

### 3. Push the database schema

```bash
npm run db:push
```

### 4. Run the app (Expo + Express)

```bash
npm run all:dev
```

This starts both processes:

- **Expo** dev server on port `8081`
- **Express** API on port `5000`

You can also run them individually with `npm run expo:dev` and
`npm run server:dev`.

## Environment Variables

Configure these in `.env` (see `.env.example`):

| Variable                          | Required | Description                                                                                                         |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | Yes      | PostgreSQL connection string (used by `drizzle.config.ts` & `server/db.ts`).                                        |
| `AI_INTEGRATIONS_GEMINI_API_KEY`  | Yes\*    | Google Gemini API key for AI identification (`server/routes.ts`).                                                   |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | No       | Optional custom Gemini proxy/base URL. May be left blank.                                                           |
| `SERPAPI_KEY`                     | No       | SerpAPI key for multi-region real price data (`server/serpapi.ts`). Without it, pricing falls back to AI estimates. |
| `XIMILAR_API_KEY`                 | No       | Ximilar Fashion AI key (category/color/material) (`server/ximilar.ts`).                                             |
| `CLARIFAI_API_KEY`                | No       | Clarifai general vision key (`server/clarifai.ts`).                                                                 |
| `SESSION_SECRET`                  | No       | Session key (reserved for future auth).                                                                             |
| `EXPO_PUBLIC_DOMAIN`              | Yes      | Domain the mobile client uses to reach the backend (e.g. `localhost:5000`) (`client/lib/query-client.ts`).          |

\* Required for the AI analysis endpoint to function; the server boots without it.

## Testing

Unit tests are written with [Vitest](https://vitest.dev/) and live in
`server/__tests__/`. They cover the pure functions behind valuation and price
parsing (IQR outlier detection, currency conversion, multi-format price parsing).

```bash
npm test         # run once
npm run test:watch  # watch mode
```

## Available Scripts

| Script                 | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run all:dev`      | Run Expo (8081) and Express (5000) together. |
| `npm run expo:dev`     | Run the Expo dev server only.                |
| `npm run server:dev`   | Run the Express API only.                    |
| `npm run db:push`      | Push the Drizzle schema to the database.     |
| `npm run lint`         | Lint with Expo ESLint config.                |
| `npm run check:format` | Check formatting with Prettier.              |
| `npm run check:types`  | Type-check with `tsc --noEmit`.              |
| `npm test`             | Run the Vitest suite.                        |

## Continuous Integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request
under Node 20: `npm ci`, then lint, format check, type check (currently
non-blocking), and tests.

## API Endpoints

- `POST /api/analyze` — Analyze an image with Gemini AI (+ Ximilar/Clarifai).
- `POST /api/valuate` — Calculate valuation with outlier detection.
- `GET  /api/fx?base=USD&quote=TRY` — Get a currency exchange rate.
- `GET  /api/portfolio/:deviceId` — Get a device's portfolio.
- `POST /api/portfolio/:deviceId` — Add/update a portfolio asset.
- `PUT  /api/portfolio/:deviceId/:assetId` — Update an asset.
- `DELETE /api/portfolio/:deviceId/:assetId` — Remove an asset.
- `POST /api/portfolio/:deviceId/sync` — Sync assets across devices.
