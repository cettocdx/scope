import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage, type OwnerKey } from "./storage";
import { insertPortfolioAssetSchema, type Deal } from "@shared/schema";
import {
  verifyAppleToken,
  verifyGoogleToken,
  issueSession,
  optionalAuth,
  requireAuth,
} from "./auth";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { applyLiveRates, EXCHANGE_RATES } from "./serpapi";
import { track, captureError } from "./telemetry";
import { scheduleFxRefresh } from "./fx";
import { activeProvider, AiNotConfiguredError } from "./ai";
import { identifyProduct } from "./identify";
import { findPrices, resolveOfferLink } from "./pricing";
import type { IdentifyResponse, VisualMatchesResponse } from "@shared/scan";
import { findVisualMatches } from "./lens";
import {
  heldImage,
  imageHostAvailable,
  publishTempImage,
  type PublishedImage,
} from "./image-host";

const identifyRequestSchema = z.object({
  image: z.string().min(1, "image is required"),
  barcode: z.string().max(64).optional(),
  // A user correction ("it's the 256GB one") re-runs identification with a hint.
  hint: z.string().max(140).optional(),
});

const visualMatchesSchema = z.object({
  image: z.string().min(1, "image is required"),
  homeMarket: z.enum(["US", "EU", "TR"]).nullable().optional(),
});

const offerLinkSchema = z.object({
  token: z.string().min(10).max(4000),
  store: z.string().min(1).max(160),
});

const pricesRequestSchema = z.object({
  query: z.string().trim().min(2).max(160),
  altQueries: z.array(z.string().max(160)).max(3).optional(),
  mustHave: z.array(z.string().max(60)).max(4).optional(),
  brand: z.string().max(60).nullable().optional(),
  model: z.string().max(80).nullable().optional(),
  barcode: z.string().max(64).nullable().optional(),
  estimateUSD: z.number().positive().nullable().optional(),
  homeMarket: z.enum(["US", "EU", "TR"]).nullable().optional(),
});

const offerSchema = z
  .object({
    price: z.number(),
    currency: z.string(),
  })
  .passthrough();

const valuateRequestSchema = z.object({
  offers: z.array(offerSchema),
  displayCurrency: z.string().optional(),
});

// Clients persist dateAdded as an ISO string, but the timestamp column's schema
// expects a Date — coerce it so cloud sync writes are not rejected.
const portfolioWriteSchema = insertPortfolioAssetSchema.extend({
  dateAdded: z.coerce.date().optional(),
});

const syncRequestSchema = z.object({
  assets: z.array(portfolioWriteSchema.partial({ deviceId: true })),
});

export const FX_RATES: Record<string, number> = {
  USD_TRY: 34.5,
  USD_EUR: 0.92,
  EUR_USD: 1.09,
  TRY_USD: 0.029,
  EUR_TRY: 37.5,
  TRY_EUR: 0.027,
};

/**
 * Detect the real image type from a decoded buffer by inspecting its magic
 * bytes. Returns the canonical type or null if the buffer is not a supported
 * image. This is intentionally permissive: it only rejects data that clearly
 * is not a JPEG/PNG/WEBP image.
 */
export function detectImageType(
  buffer: Buffer,
): "jpeg" | "png" | "webp" | null {
  if (!buffer || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return "webp";
  }

  return null;
}

/**
 * Normalize a date-like value (Date, ISO string, or null/undefined) into a
 * numeric epoch timestamp for comparison. Returns null when the value is
 * absent or unparseable.
 */
export function normalizeDateValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const time = new Date(value as string | number | Date).getTime();
  return Number.isNaN(time) ? null : time;
}

interface SyncMatchable {
  id?: string | null;
  itemName: string;
  dateAdded?: Date | string | null;
}

/**
 * Find the existing asset that a sync candidate should update, if any.
 * Matching is id-based first (exact id), then falls back to itemName plus a
 * normalized dateAdded comparison (Date vs string safe). Returns undefined for
 * a create. Pure and testable; does not touch storage.
 */
export function findSyncMatch<T extends SyncMatchable>(
  existing: T[],
  candidate: SyncMatchable,
): T | undefined {
  if (candidate.id) {
    const byId = existing.find((e) => e.id === candidate.id);
    if (byId) return byId;
  }

  const candidateTime = normalizeDateValue(candidate.dateAdded);
  return existing.find((e) => {
    if (e.itemName !== candidate.itemName) return false;
    return normalizeDateValue(e.dateAdded) === candidateTime;
  });
}

export function convertToUSD(amount: number, currency: string): number {
  if (currency === "USD" || currency === "$") return amount;
  if (currency === "TRY" || currency === "TL" || currency === "₺") {
    return amount * (FX_RATES["TRY_USD"] || 0.029);
  }
  if (currency === "EUR" || currency === "€") {
    return amount * (FX_RATES["EUR_USD"] || 1.09);
  }
  return amount;
}

/**
 * Accepted input for valuation: only `price` and `currency` are required; any
 * other Deal fields may be present and are preserved/augmented on output.
 */
type ValuationInput = Pick<Deal, "price" | "currency"> & Partial<Deal>;

interface ValuationResult {
  priceRange: { min: number; median: number; max: number; currency: string };
  outlierCount: number;
  /** Number of real (non-outlier) offers the price range is built from. */
  sourceCount: number;
  processedDeals: Deal[];
}

/**
 * Narrow an unknown thrown value into a safe { message, status } shape so we
 * never access properties on an untyped `any`. Mirrors the pattern used by the
 * central error handler in index.ts.
 */
function getErrorInfo(e: unknown): { message: string; status?: number } {
  if (e && typeof e === "object") {
    const err = e as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
    };
    const message = typeof err.message === "string" ? err.message : String(e);
    const rawStatus = err.status ?? err.statusCode;
    const status = typeof rawStatus === "number" ? rawStatus : undefined;
    return { message, status };
  }
  return { message: String(e) };
}

export function calculateValuation(
  deals: ValuationInput[],
  displayCurrency: string = "USD",
): ValuationResult {
  if (!deals || deals.length === 0) {
    return {
      priceRange: { min: 0, median: 0, max: 0, currency: displayCurrency },
      outlierCount: 0,
      sourceCount: 0,
      processedDeals: [],
    };
  }

  const pricesInUSD = deals.map((d) => ({
    ...d,
    priceUSD: convertToUSD(d.price, d.currency),
  }));

  const sortedPrices = pricesInUSD
    .map((d) => d.priceUSD)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (sortedPrices.length === 0) {
    return {
      priceRange: { min: 0, median: 0, max: 0, currency: displayCurrency },
      outlierCount: 0,
      sourceCount: 0,
      // Inputs are full Deals in the real flow; price/currency-only objects only
      // occur in unit tests where the extra fields are not asserted.
      processedDeals: deals as Deal[],
    };
  }

  const q1Index = Math.floor(sortedPrices.length * 0.25);
  const q3Index = Math.floor(sortedPrices.length * 0.75);
  const q1 = sortedPrices[q1Index] || sortedPrices[0];
  const q3 = sortedPrices[q3Index] || sortedPrices[sortedPrices.length - 1];
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  let outlierCount = 0;
  const processedDeals = pricesInUSD.map((deal) => {
    const isOutlier = deal.priceUSD < lowerBound || deal.priceUSD > upperBound;
    if (isOutlier) outlierCount++;
    return {
      ...deal,
      isOutlier,
      qualityScore: isOutlier ? 30 : 80,
    };
  });

  const nonOutlierPrices = sortedPrices.filter(
    (p) => p >= lowerBound && p <= upperBound,
  );
  const pricesToUse =
    nonOutlierPrices.length > 0 ? nonOutlierPrices : sortedPrices;

  const min = Math.round(pricesToUse[0]);
  const max = Math.round(pricesToUse[pricesToUse.length - 1]);
  const medianIndex = Math.floor(pricesToUse.length / 2);
  const median =
    pricesToUse.length % 2 === 0
      ? Math.round(
          (pricesToUse[medianIndex - 1] + pricesToUse[medianIndex]) / 2,
        )
      : Math.round(pricesToUse[medianIndex]);

  return {
    priceRange: { min, median, max, currency: displayCurrency },
    outlierCount,
    sourceCount: pricesToUse.length,
    processedDeals: processedDeals as Deal[],
  };
}

/** Validate a scan photo (data URI or bare base64) by its real bytes. */
function decodeScanImage(
  image: string,
):
  | { base64: string; buffer: Buffer; type: "jpeg" | "png" | "webp" }
  | { error: string; status: number } {
  const base64 = image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  if (base64.length < 100) return { error: "Invalid image data", status: 400 };
  const MAX_DECODED_BYTES = 12 * 1024 * 1024;
  if (Math.floor((base64.length * 3) / 4) > MAX_DECODED_BYTES) {
    return { error: "Image too large", status: 413 };
  }
  const buffer = Buffer.from(base64, "base64");
  const type = detectImageType(buffer);
  if (!type)
    return { error: "Invalid or unsupported image format", status: 400 };
  return { base64, buffer, type };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Keep currency conversion honest: refresh live FX into both rate tables
  // (this module's FX_RATES and serpapi's EXCHANGE_RATES) on boot + every 6h.
  scheduleFxRefresh((usdPerUnit) => {
    if (usdPerUnit.TRY) {
      FX_RATES.TRY_USD = usdPerUnit.TRY;
      FX_RATES.USD_TRY = 1 / usdPerUnit.TRY;
    }
    if (usdPerUnit.EUR) {
      FX_RATES.EUR_USD = usdPerUnit.EUR;
      FX_RATES.USD_EUR = 1 / usdPerUnit.EUR;
    }
    if (usdPerUnit.TRY && usdPerUnit.EUR) {
      FX_RATES.EUR_TRY = usdPerUnit.EUR / usdPerUnit.TRY;
      FX_RATES.TRY_EUR = usdPerUnit.TRY / usdPerUnit.EUR;
    }
    applyLiveRates(usdPerUnit);
  });

  // -------------------------------------------------------------------------
  // Scan, step 1: what is this? Fast identification from one photo.
  // -------------------------------------------------------------------------
  app.post("/api/identify", async (req, res) => {
    const started = Date.now();
    const parsed = identifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: fromZodError(parsed.error).toString() });
    }
    const { image, barcode, hint } = parsed.data;

    if (!activeProvider()) {
      return res.status(503).json({
        error:
          "AI is not configured. Set OPENROUTER_API_KEY (or GEMINI_API_KEY) in .env.",
        code: "AI_NOT_CONFIGURED",
      });
    }

    const img = decodeScanImage(image);
    if ("error" in img) {
      return res.status(img.status).json({ error: img.error });
    }
    const { base64: base64Data, type: detectedType } = img;

    // Only numeric product codes (UPC/EAN) identify a product; QR URLs do not.
    const productCode =
      barcode && /^\d{8,14}$/.test(barcode.trim()) ? barcode.trim() : null;

    try {
      const { identity, model, provider, secondLook } = await identifyProduct(
        `image/${detectedType}`,
        base64Data,
        { barcode: productCode, hint: hint ?? null },
      );
      const tookMs = Date.now() - started;
      track("scan_identified", {
        category: identity.category,
        confidence: identity.confidence,
        regulated: identity.regulated,
        barcode: Boolean(productCode),
        hinted: Boolean(hint),
        kind: identity.kind,
        model,
        provider,
        secondLook,
        durationMs: tookMs,
      });
      const body: IdentifyResponse = { identity, tookMs };
      res.json(body);
    } catch (error: unknown) {
      captureError(error, { route: "/api/identify" });
      const { message, status } = getErrorInfo(error);
      if (error instanceof AiNotConfiguredError) {
        return res
          .status(503)
          .json({ error: message, code: "AI_NOT_CONFIGURED" });
      }
      if (status === 429 || /429|RESOURCE_EXHAUSTED/.test(message)) {
        return res
          .status(429)
          .json({ error: "Too many requests. Please try again in a moment." });
      }
      if (status === 401 || status === 403) {
        return res
          .status(502)
          .json({ error: "The AI key was rejected. Check it in .env." });
      }
      res
        .status(502)
        .json({ error: "Could not identify the item. Please try again." });
    }
  });

  // -------------------------------------------------------------------------
  // Scan, in parallel with identify: the same-looking item in shops (Google
  // Lens). Finds the exact T-shirt when the brand shows but the model doesn't.
  // -------------------------------------------------------------------------
  app.post("/api/visual-matches", async (req, res) => {
    const started = Date.now();
    const parsed = visualMatchesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: fromZodError(parsed.error).toString() });
    }
    if (!process.env.SERPAPI_KEY || !imageHostAvailable()) {
      const off: VisualMatchesResponse = {
        available: false,
        matches: [],
        tookMs: 0,
      };
      return res.json(off);
    }
    const img = decodeScanImage(parsed.data.image);
    if ("error" in img) {
      return res.status(img.status).json({ error: img.error });
    }
    let published: PublishedImage | null = null;
    try {
      published = await publishTempImage(img.buffer, `image/${img.type}`);
      const matches = published
        ? await findVisualMatches(published.url, parsed.data.homeMarket ?? "US")
        : [];
      const body: VisualMatchesResponse = {
        available: Boolean(published),
        matches,
        tookMs: Date.now() - started,
      };
      track("scan_visual_matches", {
        count: matches.length,
        withPrice: matches.filter((m) => m.price !== null).length,
        durationMs: body.tookMs,
      });
      res.json(body);
    } catch (error: unknown) {
      captureError(error, { route: "/api/visual-matches" });
      res.json({ available: true, matches: [], tookMs: Date.now() - started });
    } finally {
      await published?.remove();
    }
  });

  // A scan photo held for a few minutes so Google Lens can fetch it (only when
  // PUBLIC_BASE_URL is set). The id is 144 random bits and expires quickly.
  app.get("/api/tmp-image/:file", (req, res) => {
    const id = req.params.file.replace(/\.[a-z]+$/i, "");
    const img = heldImage(id);
    if (!img) return res.status(404).end();
    res.setHeader("Content-Type", img.mime);
    res.setHeader("Cache-Control", "no-store");
    res.end(img.data);
  });

  // -------------------------------------------------------------------------
  // Scan, step 2: where can I buy it new — cheapest and safest, US/EU/TR.
  // -------------------------------------------------------------------------
  app.post("/api/prices", async (req, res) => {
    const started = Date.now();
    const parsed = pricesRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: fromZodError(parsed.error).toString() });
    }
    try {
      const report = await findPrices(parsed.data);
      track("scan_priced", {
        live: report.live,
        sourceCount: report.sourceCount,
        marketsWithOffers: report.markets.filter((m) => m.offers.length > 0)
          .length,
        hasRecommended: Boolean(report.picks.recommended),
        durationMs: Date.now() - started,
      });
      res.json(report);
    } catch (error: unknown) {
      captureError(error, { route: "/api/prices" });
      res.status(502).json({ error: "Price search failed. Please try again." });
    }
  });
  // Turns a tapped offer into the seller's own page (one lookup per product,
  // cached), so "Buy" lands on the store instead of a Google results page.
  app.post("/api/offer-link", async (req, res) => {
    const parsed = offerLinkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: fromZodError(parsed.error).toString() });
    }
    try {
      const link = await resolveOfferLink(parsed.data.token, parsed.data.store);
      res.json(link ?? { url: null, details: [] });
    } catch (error: unknown) {
      captureError(error, { route: "/api/offer-link" });
      res.json({ url: null, details: [] });
    }
  });

  // USD value of one unit of each currency, so the app can show prices in the
  // user's currency with the same live rates the server compared them with.
  app.get("/api/rates", (_req, res) => {
    res.json({
      usdPerUnit: { ...EXCHANGE_RATES },
      updatedAt: new Date().toISOString(),
    });
  });

  app.get("/api/fx", (req, res) => {
    const { base = "USD", quote = "TRY" } = req.query;
    const key = `${base}_${quote}`;
    const rate = FX_RATES[key as string] || 1;

    res.json({
      base,
      quote,
      rate,
      updatedAt: new Date().toISOString(),
    });
  });

  app.post("/api/valuate", (req, res) => {
    try {
      const parsed = valuateRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: fromZodError(parsed.error).toString() });
      }
      const { offers, displayCurrency = "USD" } = parsed.data;

      const result = calculateValuation(offers, displayCurrency);

      res.json({
        marketValue: result.priceRange.median,
        ...result.priceRange,
        cleanedOffers: result.processedDeals.filter((d: Deal) => !d.isOutlier),
        outliers: result.processedDeals.filter((d: Deal) => d.isOutlier),
        outlierCount: result.outlierCount,
      });
    } catch (error: unknown) {
      console.error("Valuation error:", error);
      res.status(500).json({ error: "Valuation failed" });
    }
  });

  // -------------------------------------------------------------------------
  // Authentication — Sign in with Apple / Google. Verifies the provider's
  // identity token, finds-or-creates the account, and returns a SCOPE session.
  // -------------------------------------------------------------------------

  const authBodySchema = z.object({
    idToken: z.string().min(1),
    // Apple only returns the name on first authorization; the client forwards
    // it so we can persist a display name.
    displayName: z.string().max(120).optional(),
    // Optional: a device id whose anonymous assets should be claimed on sign-in.
    deviceId: z.string().max(128).optional(),
  });

  async function handleProviderAuth(
    provider: "apple" | "google",
    req: import("express").Request,
    res: import("express").Response,
  ) {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: "Accounts are not configured" });
    }
    const parsed = authBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: fromZodError(parsed.error).toString() });
    }
    const { idToken, displayName, deviceId } = parsed.data;

    let identity;
    try {
      identity =
        provider === "apple"
          ? await verifyAppleToken(idToken)
          : await verifyGoogleToken(idToken);
    } catch (e) {
      console.error(`${provider} token verification failed:`, e);
      return res.status(401).json({ error: "Invalid sign-in token" });
    }

    const user = await storage.findOrCreateUser({
      provider: identity.provider,
      providerUserId: identity.providerUserId,
      email: identity.email ?? null,
      displayName: displayName ?? null,
    });

    // Merge: re-home this device's anonymous assets onto the account.
    let claimed = 0;
    if (deviceId) {
      try {
        claimed = await storage.claimDeviceAssets(deviceId, user.id);
      } catch (e) {
        console.error("Device asset claim failed:", e);
      }
    }

    const token = await issueSession(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isPro: user.isPro,
        proExpiresAt: user.proExpiresAt,
      },
      claimed,
    });
  }

  app.post("/api/auth/apple", (req, res) =>
    handleProviderAuth("apple", req, res),
  );
  app.post("/api/auth/google", (req, res) =>
    handleProviderAuth("google", req, res),
  );

  // Current account + entitlement. Used by the client to refresh Pro status.
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "Account not found" });
      await storage.touchUser(user.id);
      const pro =
        user.isPro && (!user.proExpiresAt || user.proExpiresAt > new Date());
      res.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isPro: pro,
        proExpiresAt: user.proExpiresAt,
      });
    } catch (e) {
      console.error("auth/me error:", e);
      res.status(500).json({ error: "Failed to load account" });
    }
  });

  // -------------------------------------------------------------------------
  // RevenueCat webhook — keeps `isPro` in sync with the App Store subscription.
  // Configure the shared secret as `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
  // in the RevenueCat dashboard.
  // -------------------------------------------------------------------------
  app.post("/api/revenuecat/webhook", async (req, res) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (secret) {
      const auth = req.header("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
    try {
      const event = req.body?.event ?? {};
      const type: string = event.type ?? "";
      // app_user_id is set to the SCOPE user id by the client (logIn).
      const userId: string | undefined = event.app_user_id;
      const expiresMs: number | undefined = event.expiration_at_ms;
      const proExpiresAt = expiresMs ? new Date(expiresMs) : null;

      const ACTIVE = [
        "INITIAL_PURCHASE",
        "RENEWAL",
        "UNCANCELLATION",
        "PRODUCT_CHANGE",
        "SUBSCRIPTION_EXTENDED",
      ];
      const INACTIVE = [
        "EXPIRATION",
        "CANCELLATION",
        "BILLING_ISSUE",
        "SUBSCRIPTION_PAUSED",
      ];

      if (userId && process.env.DATABASE_URL) {
        if (ACTIVE.includes(type)) {
          await storage.setPro({ userId, isPro: true, proExpiresAt });
        } else if (INACTIVE.includes(type)) {
          await storage.setPro({ userId, isPro: false, proExpiresAt });
        }
      }
      res.json({ ok: true });
    } catch (e) {
      console.error("RevenueCat webhook error:", e);
      res.status(200).json({ ok: false }); // 200 so RC does not hammer retries
    }
  });

  // -------------------------------------------------------------------------
  // Portfolio (Vault). Owner is the account (userId) when authenticated, else
  // the device (anonymous). optionalAuth populates req.userId from the Bearer
  // token; the path :deviceId is the anonymous fallback owner.
  // -------------------------------------------------------------------------

  // Cloud portfolio sync needs a database. When DATABASE_URL is not set, return
  // a clean 503 instead of letting each query throw a 500 — the client treats
  // this as "offline" and keeps the local (device) portfolio intact.
  app.use("/api/portfolio", (_req, res, next) => {
    if (!process.env.DATABASE_URL) {
      return res.status(503).json({ error: "Cloud sync is not configured" });
    }
    next();
  });

  // The owner key: the signed-in account if present, otherwise the device.
  const ownerOf = (
    req: import("express").Request,
    deviceId: string,
  ): OwnerKey => (req.userId ? { userId: req.userId } : { deviceId });

  app.get("/api/portfolio/:deviceId", optionalAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const assets = await storage.getPortfolioAssets(ownerOf(req, deviceId));
      res.json(assets);
    } catch (error: unknown) {
      console.error("Portfolio fetch error:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio/:deviceId", optionalAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const owner = ownerOf(req, deviceId);

      const parsed = portfolioWriteSchema.safeParse({ ...req.body, deviceId });
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: fromZodError(parsed.error).toString() });
      }
      const assetData = parsed.data;

      if (assetData.id) {
        // Ownership-scoped lookup: a record under another owner returns
        // undefined and is never touched (no takeover).
        const existing = await storage.getPortfolioAsset(assetData.id, owner);
        if (existing) {
          const updated = await storage.updatePortfolioAsset(
            assetData.id,
            owner,
            {
              ...assetData,
              deviceId,
              userId: req.userId ?? null,
            },
          );
          return res.json(updated);
        }
      }

      // No matching record owned by this owner. Drop any client id so a create
      // cannot overwrite another owner's asset via id conflict.
      const { id: _ignoredId, ...createData } = assetData;
      const asset = await storage.upsertPortfolioAsset({
        ...createData,
        deviceId,
        userId: req.userId ?? null,
        dateAdded: req.body.dateAdded
          ? new Date(req.body.dateAdded)
          : new Date(),
      });

      res.json(asset);
    } catch (error: unknown) {
      console.error("Portfolio create error:", error);
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.put(
    "/api/portfolio/:deviceId/:assetId",
    optionalAuth,
    async (req, res) => {
      try {
        const { deviceId, assetId } = req.params;
        if (!deviceId) {
          return res.status(400).json({ error: "Device ID required" });
        }
        const owner = ownerOf(req, deviceId);

        const parsed = portfolioWriteSchema.partial().safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ error: fromZodError(parsed.error).toString() });
        }
        // deviceId/userId are owned by the server, never let the body override them.
        const { deviceId: _d, userId: _u, id: _id, ...updates } = parsed.data;

        const asset = await storage.updatePortfolioAsset(
          assetId,
          owner,
          updates,
        );
        if (!asset) {
          return res.status(404).json({ error: "Asset not found" });
        }

        res.json(asset);
      } catch (error: unknown) {
        console.error("Portfolio update error:", error);
        res.status(500).json({ error: "Failed to update asset" });
      }
    },
  );

  app.delete(
    "/api/portfolio/:deviceId/:assetId",
    optionalAuth,
    async (req, res) => {
      try {
        const { deviceId, assetId } = req.params;
        const deleted = await storage.deletePortfolioAsset(
          assetId,
          ownerOf(req, deviceId),
        );
        if (!deleted) {
          return res.status(404).json({ error: "Asset not found" });
        }
        res.json({ success: true });
      } catch (error: unknown) {
        console.error("Portfolio delete error:", error);
        res.status(500).json({ error: "Failed to delete asset" });
      }
    },
  );

  app.post("/api/portfolio/:deviceId/sync", optionalAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      if (!deviceId) {
        return res.status(400).json({ error: "Device ID required" });
      }
      const owner = ownerOf(req, deviceId);

      const parsed = syncRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: fromZodError(parsed.error).toString() });
      }
      const { assets } = parsed.data;

      // Fetch the owner's assets once (avoids an N+1 query per sync item) and
      // match in memory. Matching is id-first, then itemName + normalized date.
      const existing = await storage.getPortfolioAssets(owner);

      const syncedAssets = [];
      for (const asset of assets) {
        const match = findSyncMatch(existing, asset);

        if (match) {
          const updated = await storage.updatePortfolioAsset(match.id, owner, {
            ...asset,
            deviceId,
            userId: req.userId ?? null,
          });
          if (updated) syncedAssets.push(updated);
        } else {
          const created = await storage.upsertPortfolioAsset({
            ...asset,
            deviceId,
            userId: req.userId ?? null,
            dateAdded: asset.dateAdded ? new Date(asset.dateAdded) : new Date(),
          });
          syncedAssets.push(created);
        }
      }

      res.json(syncedAssets);
    } catch (error: unknown) {
      console.error("Portfolio sync error:", error);
      res.status(500).json({ error: "Failed to sync portfolio" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
