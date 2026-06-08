/**
 * Lightweight, provider-optional telemetry.
 *
 * Every event is emitted as a structured `[scope-telemetry]` JSON line (so it is
 * greppable / shippable from any log drain). If POSTHOG_KEY is set, the same
 * event is also forwarded to PostHog's HTTP capture endpoint — no SDK/dependency
 * required. This lets us answer the core questions (how often is a real price
 * found, what does a scan cost, how accurate is recognition) without committing
 * to a vendor yet.
 */

const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://app.posthog.com";

type Props = Record<string, unknown>;

async function sendToPostHog(event: string, props: Props): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: key,
        event,
        // distinct_id keeps PostHog happy; we use the device when available.
        distinct_id: (props.deviceId as string) || "anonymous",
        properties: props,
      }),
    }).finally(() => clearTimeout(timer));
  } catch (e) {
    // Telemetry must never break a request.
    console.error("[scope-telemetry] PostHog send failed:", e);
  }
}

/** Fire-and-forget: record a product event. */
export function track(event: string, props: Props = {}): void {
  const payload = { event, ts: new Date().toISOString(), ...props };
  console.log(`[scope-telemetry] ${JSON.stringify(payload)}`);
  void sendToPostHog(event, props);
}

export interface ScanEvent {
  category?: string;
  /** Which Gemini model actually produced the answer (fallback chain). */
  model?: string;
  confidenceScore?: number;
  brandConfidence?: number;
  /** True when at least one real marketplace offer backed the price. */
  priceFound: boolean;
  /** Count of plausible real offers after filtering. */
  realOfferCount: number;
  /** How many regions we queried on SerpAPI (cost proxy). */
  regionsQueried: number;
  /** Distinct regions that returned at least one offer. */
  regionsWithOffers: number;
  needsUserInput?: boolean;
  refinementsApplied: boolean;
  regulated?: boolean;
  durationMs: number;
}

/**
 * The single most important event: one scan through /api/analyze. Powers the
 * north-star (Weekly Trusted Scans), unit-cost tracking, and accuracy.
 */
export function trackScan(e: ScanEvent): void {
  track("scan_completed", { ...e });
}

/** Sentry-ready error capture. Structured now; wire a DSN/SDK later. */
export function captureError(err: unknown, context: Props = {}): void {
  const e = err as { message?: string; status?: number; stack?: string };
  track("error", {
    message: e?.message || String(err),
    status: e?.status,
    ...context,
  });
}
