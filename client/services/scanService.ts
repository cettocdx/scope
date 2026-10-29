import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { t } from "@/lib/i18n";
import type {
  IdentifyResponse,
  Market,
  VisualMatchesResponse,
  PriceReport,
  PricesRequest,
  ProductIdentity,
} from "@shared/scan";

const IDENTIFY_TIMEOUT_MS = 35_000;
const PRICES_TIMEOUT_MS = 40_000;

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * POST with one quiet retry when the request never reached the server (a
 * dropped connection on mobile data) or the server answered 502/503/504.
 */
async function post<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  try {
    return await postOnce<T>(path, body, timeoutMs);
  } catch (e) {
    const retryable =
      e instanceof ScanError &&
      (e.status === null ||
        e.status === 502 ||
        e.status === 503 ||
        e.status === 504) &&
      !/timed out/i.test(e.message);
    if (!retryable) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return postOnce<T>(path, body, timeoutMs);
  }
}

async function postOnce<T>(
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      new URL(path, getApiUrl()).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ScanError(
      /timed out/i.test(msg) ? msg : t("Server can't be reached"),
      null,
    );
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | undefined;
    try {
      const j = (await res.json()) as { error?: string; code?: string };
      if (j.error) message = j.error;
      code = j.code;
    } catch {
      // keep the status message
    }
    if (code === "AI_NOT_CONFIGURED")
      message = t("AI isn't set up on the server yet.");
    throw new ScanError(message, res.status, code);
  }
  return (await res.json()) as T;
}

export function identify(
  imageBase64: string,
  opts: { barcode?: string | null; hint?: string | null } = {},
): Promise<IdentifyResponse> {
  return post<IdentifyResponse>(
    "/api/identify",
    {
      image: imageBase64,
      barcode: opts.barcode || undefined,
      hint: opts.hint || undefined,
    },
    IDENTIFY_TIMEOUT_MS,
  );
}

export function pricesRequestFor(
  identity: ProductIdentity,
  homeMarket: Market,
): PricesRequest {
  return {
    homeMarket,
    query: identity.searchQuery,
    altQueries: identity.altQueries,
    mustHave: identity.mustHave,
    brand: identity.brand,
    model: identity.model,
    barcode: identity.barcode,
    estimateUSD: identity.estimateUSD,
  };
}

export function fetchPrices(req: PricesRequest): Promise<PriceReport> {
  return post<PriceReport>("/api/prices", req, PRICES_TIMEOUT_MS);
}

/** A manual correction: the typed name becomes the identity and the query. */
export function identityFromName(
  name: string,
  base?: ProductIdentity | null,
): ProductIdentity {
  const clean = name.replace(/\s+/g, " ").trim();
  return {
    kind: "product",
    name: clean,
    brand: null,
    model: null,
    variant: null,
    category: base?.category ?? "Other",
    confidence: 100,
    searchQuery: clean,
    altQueries: [],
    mustHave: [],
    alternatives: [],
    others: [],
    regulated: base?.regulated ?? false,
    barcode: null,
    estimateUSD: null,
  };
}

/** Short headline for a product: "Sony WH-1000XM5" rather than the full listing name. */
export function titleFor(identity: ProductIdentity): string {
  const { brand, model, name } = identity;
  if (!model) return name;
  if (!brand) return model;
  return model.toLowerCase().includes(brand.toLowerCase())
    ? model
    : `${brand} ${model}`;
}

/** The seller's own page for an offer, or null to keep the Google Shopping link. */
export async function resolveOfferLink(
  token: string,
  store: string,
): Promise<string | null> {
  try {
    const r = await post<{ url: string | null }>(
      "/api/offer-link",
      { token, store },
      8_000,
    );
    return r.url;
  } catch {
    return null;
  }
}

/** Shops showing the same-looking item (Google Lens). Empty when not set up. */
export async function visualMatches(
  imageBase64: string,
  homeMarket: Market,
): Promise<VisualMatchesResponse> {
  try {
    return await post<VisualMatchesResponse>(
      "/api/visual-matches",
      { image: imageBase64, homeMarket },
      30_000,
    );
  } catch {
    return { available: false, matches: [], tookMs: 0 };
  }
}

/** "Not right?" corrections, so we learn which products get misread. Fire and forget. */
export function sendFeedback(args: {
  wrong: string;
  right: string;
  category?: string | null;
  confidence?: number | null;
  source?: "photo" | "saved" | "history" | "typed";
}): void {
  post("/api/feedback", args, 8_000).catch(() => {});
}

/** Crash reports from the error boundary. Fire and forget. */
export function reportClientError(args: {
  message: string;
  stack?: string;
  screen?: string;
}): void {
  post(
    "/api/client-error",
    {
      ...args,
      message: args.message.slice(0, 500),
      stack: args.stack?.slice(0, 4000),
      version: Constants.expoConfig?.version,
    },
    8_000,
  ).catch(() => {});
}
