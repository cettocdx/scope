/**
 * Shared price helpers: fetch with a timeout, currency parsing and USD
 * conversion with live FX (see fx.ts). Searching lives in pricing.ts.
 */

// Wraps fetch with an AbortController-based timeout so external calls can never
// hang indefinitely. On timeout the request is aborted and the call rejects
// (an AbortError), which existing try/catch fallbacks treat as a normal failure.
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 9000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1,
  TRY: 0.029,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.272,
  CNY: 0.14,
};

function convertToUSD(price: number, currency: string): number {
  const rate = EXCHANGE_RATES[currency] || 1;
  return Math.round(price * rate * 100) / 100;
}

/** Overlay live currency→USD rates onto the fallback table (in place). */
export function applyLiveRates(usdPerUnit: Record<string, number>): void {
  for (const currency of Object.keys(EXCHANGE_RATES)) {
    if (currency === "USD") continue;
    const live = usdPerUnit[currency];
    if (typeof live === "number" && live > 0) EXCHANGE_RATES[currency] = live;
  }
}

export function extractPrice(priceStr: string): {
  value: number;
  currency: string;
} {
  let currency = "USD";
  if (
    priceStr.includes("₺") ||
    priceStr.includes("TL") ||
    priceStr.includes("TRY")
  ) {
    currency = "TRY";
  } else if (priceStr.includes("€") || priceStr.includes("EUR")) {
    currency = "EUR";
  } else if (priceStr.includes("£") || priceStr.includes("GBP")) {
    currency = "GBP";
  } else if (
    priceStr.includes("AED") ||
    priceStr.includes("د.إ") ||
    priceStr.includes("DH")
  ) {
    currency = "AED";
  }

  let cleaned = priceStr.replace(/[^\d.,]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Both separators present: the LAST one to appear is the decimal separator,
    // the other is the thousands separator. e.g. "1.234,56" -> 1234.56,
    // "1,234.56" -> 1234.56.
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only commas. A single comma followed by EXACTLY 2 digits is a decimal
    // separator (e.g. "19,99" -> 19.99); anything else (3+ trailing digits or
    // multiple groups) is a thousands separator (e.g. "1,299" -> 1299,
    // "1,234,567" -> 1234567).
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasDot) {
    // Only dots. A single dot followed by EXACTLY 2 digits is a decimal
    // separator (e.g. "19.99" -> 19.99); a single dot followed by 3 digits is a
    // thousands separator (e.g. "1.234" -> 1234); multiple dots are thousands
    // separators (e.g. "1.234.567" -> 1234567).
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length === 2) {
      // keep as-is, it is already a valid decimal
    } else {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const value = parseFloat(cleaned) || 0;
  return { value, currency };
}

export { EXCHANGE_RATES, convertToUSD };
