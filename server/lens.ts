import { convertToUSD, extractPrice, fetchWithTimeout } from "./serpapi";
import { affiliateUrl } from "./affiliate";
import type { Market, VisualMatch } from "@shared/scan";
import type { Fetcher } from "./pricing";

/**
 * Google Lens visual matching (via SerpAPI): pages that show the same-looking
 * item, mostly shops with a direct product link. This is what finds "that exact
 * T-shirt" when the brand is visible but the model name is not.
 */

const LOCALE: Record<Market, { country: string; hl: string }> = {
  US: { country: "us", hl: "en" },
  EU: { country: "de", hl: "en" },
  TR: { country: "tr", hl: "tr" },
};

/** Sources that are not somewhere to buy it new. */
const SKIP_SOURCES =
  /ebay|wallapop|vinted|depop|poshmark|mercari|letgo|sahibinden|dolap|gittigidiyor|kleinanzeigen|leboncoin|subito|craigslist|facebook|instagram|pinterest|tiktok|youtube|reddit|wikipedia|x\.com|twitter/i;

interface LensMatch {
  title?: string;
  link?: string;
  source?: string;
  thumbnail?: string;
  price?: { value?: string; extracted_value?: number; currency?: string };
  in_stock?: boolean;
}

const defaultFetcher: Fetcher = (url) => fetchWithTimeout(url, {}, 15_000);

export function toVisualMatches(raw: LensMatch[], limit = 12): VisualMatch[] {
  const seen = new Set<string>();
  const out: VisualMatch[] = [];
  for (const m of raw) {
    if (!m.link || !m.title || !m.source) continue;
    if (SKIP_SOURCES.test(m.source) || SKIP_SOURCES.test(m.link)) continue;
    const key = m.link.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);

    let price: number | null = null;
    let currency: string | null = null;
    if (m.price?.value) {
      const parsed = extractPrice(m.price.value);
      price =
        typeof m.price.extracted_value === "number" &&
        m.price.extracted_value > 0
          ? m.price.extracted_value
          : parsed.value || null;
      currency = price ? parsed.currency : null;
    }
    out.push({
      title: m.title.trim(),
      store: m.source.trim(),
      url: affiliateUrl(m.link),
      thumbnail: m.thumbnail ?? null,
      price,
      currency,
      priceUSD:
        price && currency
          ? Math.round(convertToUSD(price, currency) * 100) / 100
          : null,
      inStock: typeof m.in_stock === "boolean" ? m.in_stock : null,
    });
  }
  // Pages with a price are shops; show them first.
  return out
    .sort((a, b) => Number(b.price !== null) - Number(a.price !== null))
    .slice(0, limit);
}

export async function findVisualMatches(
  imageUrl: string,
  market: Market,
  fetcher: Fetcher = defaultFetcher,
): Promise<VisualMatch[]> {
  if (!process.env.SERPAPI_KEY) return [];
  const loc = LOCALE[market];
  const params = new URLSearchParams({
    api_key: process.env.SERPAPI_KEY,
    engine: "google_lens",
    url: imageUrl,
    country: loc.country,
    hl: loc.hl,
  });
  try {
    const res = await fetcher(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as { visual_matches?: LensMatch[] };
    return toVisualMatches(data.visual_matches ?? []);
  } catch {
    return [];
  }
}
