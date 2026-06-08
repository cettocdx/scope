/**
 * Live FX rates with graceful fallback.
 *
 * Fetches USD-based rates from a free, key-less endpoint and lets callers apply
 * them into their existing rate tables (which double as the fallback when the
 * network is unavailable). Rates are refreshed on boot and every few hours, so
 * the multi-region price comparison stops silently drifting on hardcoded values.
 */
const FX_API = "https://open.er-api.com/v6/latest/USD";
const REFRESH_MS = 6 * 60 * 60 * 1000; // 6h

interface ErApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

/**
 * Returns a map of currency code → USD value of 1 unit (e.g. TRY → 0.029).
 * null on any failure so callers keep their fallback table.
 */
export async function fetchUsdPerUnit(): Promise<Record<string, number> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(FX_API, { signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
    if (!res.ok) return null;

    const json = (await res.json()) as ErApiResponse;
    if (json.result !== "success" || !json.rates) return null;

    const out: Record<string, number> = {};
    for (const [currency, rate] of Object.entries(json.rates)) {
      // API gives USD → currency; we want currency → USD = 1 / rate.
      if (typeof rate === "number" && rate > 0) out[currency] = 1 / rate;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Refresh now and on an interval, handing each successful result to `apply`
 * (which writes the rates into the caller's table). Best-effort and silent on
 * failure. The interval is unref'd so it never keeps the process alive.
 */
export function scheduleFxRefresh(
  apply: (usdPerUnit: Record<string, number>) => void,
): void {
  const run = async () => {
    const rates = await fetchUsdPerUnit();
    if (rates) {
      apply(rates);
      console.log("[fx] live exchange rates refreshed");
    } else {
      console.warn("[fx] live rate fetch failed, keeping fallback rates");
    }
  };
  void run();
  const timer = setInterval(() => void run(), REFRESH_MS);
  timer.unref?.();
}
