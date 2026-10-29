import { convertToUSD, extractPrice, fetchWithTimeout } from "./serpapi";
import { affiliateUrl } from "./affiliate";
import type {
  Market,
  MarketSummary,
  Offer,
  PriceReport,
  PricesRequest,
  TrustTier,
} from "@shared/scan";

/**
 * Where can you buy it new, cheapest and safest?
 *
 * Every country is queried on Google Shopping (via SerpAPI) at the same time,
 * offers are filtered down to the same product, scored for seller trust, and
 * grouped into the three markets the app shows: US, Europe and Turkey.
 */

interface CountryConfig {
  code: string;
  market: Market;
  gl: string;
  hl: string;
  domain: string;
  currency: string;
}

export const COUNTRIES: Record<string, CountryConfig> = {
  US: {
    code: "US",
    market: "US",
    gl: "us",
    hl: "en",
    domain: "google.com",
    currency: "USD",
  },
  DE: {
    code: "DE",
    market: "EU",
    gl: "de",
    hl: "de",
    domain: "google.de",
    currency: "EUR",
  },
  FR: {
    code: "FR",
    market: "EU",
    gl: "fr",
    hl: "fr",
    domain: "google.fr",
    currency: "EUR",
  },
  IT: {
    code: "IT",
    market: "EU",
    gl: "it",
    hl: "it",
    domain: "google.it",
    currency: "EUR",
  },
  ES: {
    code: "ES",
    market: "EU",
    gl: "es",
    hl: "es",
    domain: "google.es",
    currency: "EUR",
  },
  NL: {
    code: "NL",
    market: "EU",
    gl: "nl",
    hl: "nl",
    domain: "google.nl",
    currency: "EUR",
  },
  UK: {
    code: "UK",
    market: "EU",
    gl: "uk",
    hl: "en",
    domain: "google.co.uk",
    currency: "GBP",
  },
  TR: {
    code: "TR",
    market: "TR",
    gl: "tr",
    hl: "tr",
    domain: "google.com.tr",
    currency: "TRY",
  },
};

const DEFAULT_COUNTRIES = ["US", "DE", "FR", "IT", "ES", "UK", "TR"];

/** Countries to query. Override with PRICE_COUNTRIES="US,DE,TR" to cut cost. */
export function activeCountries(): string[] {
  const raw = process.env.PRICE_COUNTRIES;
  const list = raw
    ? raw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter((c) => COUNTRIES[c])
    : DEFAULT_COUNTRIES;
  return list.length ? list : DEFAULT_COUNTRIES;
}

// ---------------------------------------------------------------------------
// Seller trust
// ---------------------------------------------------------------------------

/** Large retailers with buyer protection and real returns, per market. */
const MAJOR_RETAILERS: Record<Market, string[]> = {
  US: [
    "amazon",
    "best buy",
    "bestbuy",
    "walmart",
    "target",
    "costco",
    "b&h",
    "bhphotovideo",
    "adorama",
    "newegg",
    "home depot",
    "lowe's",
    "lowes",
    "macy's",
    "macys",
    "nordstrom",
    "bloomingdale",
    "saks",
    "neiman marcus",
    "sephora",
    "ulta",
    "dick's",
    "rei",
    "foot locker",
    "kohl's",
    "staples",
    "gamestop",
    "crutchfield",
    "sam's club",
    "verizon",
    "at&t",
    "t-mobile",
  ],
  EU: [
    "amazon",
    "mediamarkt",
    "media markt",
    "mediaworld",
    "saturn",
    "otto",
    "cyberport",
    "notebooksbilliger",
    "alternate",
    "galaxus",
    "zalando",
    "about you",
    "douglas",
    "fnac",
    "darty",
    "boulanger",
    "cdiscount",
    "carrefour",
    "leclerc",
    "el corte ingl",
    "pccomponentes",
    "unieuro",
    "euronics",
    "coolblue",
    "bol.com",
    "bol",
    "currys",
    "argos",
    "john lewis",
    "very",
    "selfridges",
    "harrods",
    "jd sports",
    "decathlon",
    "ikea",
    "apple",
    "conrad",
    "expert",
    "worten",
    "trony",
    "bcc",
    "ldlc",
    "rue du commerce",
    "e.leclerc",
    "mytheresa",
    "farfetch",
    "net-a-porter",
    "breuninger",
    "kadewe",
    "ao.com",
    "box.co.uk",
    "scan.co.uk",
  ],
  TR: [
    "hepsiburada",
    "trendyol",
    "amazon",
    "teknosa",
    "vatan",
    "mediamarkt",
    "media markt",
    "n11",
    "migros",
    "carrefoursa",
    "boyner",
    "beymen",
    "vakko",
    "decathlon",
    "itopya",
    "incehesap",
    "pazarama",
    "çiçeksepeti",
    "ciceksepeti",
    "koçtaş",
    "koctas",
    "ikea",
    "turkcell",
    "vodafone",
    "türk telekom",
    "gratis",
    "watsons",
    "sephora",
    "flo",
    "lc waikiki",
    "defacto",
    "english home",
    "karaca",
    "arçelik",
    "arcelik",
    "beko",
    "vestel",
    "a101",
    "bim",
  ],
};

/** Open marketplaces where any seller can list: cheap, but weakest guarantees. */
const OPEN_MARKETPLACES = [
  "aliexpress",
  "temu",
  "shein",
  "wish",
  "dhgate",
  "joom",
  "etsy",
  "banggood",
  "alibaba",
  "lightinthebox",
  "fruugo",
  "ubuy",
  "onbuy",
  "desertcart",
  "kaufland marketplace",
];

/** Second-hand / refurbished sellers: SCOPE compares NEW prices only. */
const RESALE_STORES = [
  "ebay",
  "stockx",
  "goat",
  "grailed",
  "poshmark",
  "depop",
  "mercari",
  "vinted",
  "therealreal",
  "the real real",
  "vestiaire",
  "rebelle",
  "fashionphile",
  "dolap",
  "letgo",
  "sahibinden",
  "gittigidiyor",
  "facebook",
  "swappa",
  "back market",
  "backmarket",
  "refurbed",
  "reebelo",
  "gazelle",
  "rebuy",
  "recommerce",
  "kleinanzeigen",
  "leboncoin",
  "wallapop",
  "subito",
  "marktplaats",
  "gumtree",
  "craigslist",
  "offerup",
];

const USED_RE =
  /\b(used|pre-?owned|second[\s-]?hand|segunda mano|refurb(ished)?|renewed|open[\s-]?box|gebraucht|generalüberholt|occasion|reconditionn[ée]e?|usag[ée]e?|usato|usata|ricondizionat[oa]|usado|usada|seminuevo|reacondicionad[oa]|ikinci el|2\.? ?el|yenilenmi[sş]|teşhir)\b/i;

/** "Platform - Seller" or "… Marketplace": a third-party seller on a big platform. */
const THIRD_PARTY_RE =
  /marketplace|marktplatz|place de march|pazar ?yeri|\s[-–]\s/i;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function includesAny(haystack: string, needles: string[]): boolean {
  const h = norm(haystack);
  return needles.some((n) => h.includes(norm(n)));
}

export function trustFor(
  store: string,
  market: Market,
  brand: string | null | undefined,
): { score: number; tier: TrustTier; reasons: string[] } {
  const s = norm(store);
  const b = brand ? norm(brand).trim() : "";

  if (
    b.length >= 3 &&
    (s === b ||
      s.startsWith(`${b} `) ||
      s.startsWith(`${b}.`) ||
      s === `${b} store`)
  ) {
    return {
      score: 96,
      tier: "official",
      reasons: [`Official ${brand} store`],
    };
  }
  if (includesAny(s, OPEN_MARKETPLACES)) {
    return {
      score: 50,
      tier: "marketplace",
      reasons: ["Open marketplace · seller varies"],
    };
  }
  if (THIRD_PARTY_RE.test(store) && includesAny(s, MAJOR_RETAILERS[market])) {
    return {
      score: 66,
      tier: "marketplace",
      reasons: ["Third-party seller · platform protection"],
    };
  }
  if (includesAny(s, MAJOR_RETAILERS[market])) {
    return {
      score: 86,
      tier: "major",
      reasons: ["Major retailer · buyer protection"],
    };
  }
  return {
    score: 55,
    tier: "unknown",
    reasons: ["Smaller shop · check reviews"],
  };
}

// ---------------------------------------------------------------------------
// Relevance
// ---------------------------------------------------------------------------

/** Words that mark an accessory for a product rather than the product itself. */
const ACCESSORY_RE =
  /\b(case|cover|sleeve|skin|screen protector|tempered glass|protector|strap|band|charger|cable|adapter|replacement|spare|sticker|decal|stand|mount|holder|h[uü]lle|schutzfolie|kabel|ladeger[aä]t|coque|housse|chargeur|custodia|cover|funda|cargador|k[ıi]l[ıi]f|ekran koruyucu|kablo|[sş]arj aleti|kay[ıi][sş])\b/i;

function compact(s: string): string {
  return norm(s).replace(/[^a-z0-9]/g, "");
}

/** True when a listing title plausibly is the product (not an accessory or a different model). */
export function isSameProduct(
  title: string | null,
  req: Pick<PricesRequest, "query" | "mustHave">,
): boolean {
  if (!title) return true; // nothing to judge; price band still applies
  const t = compact(title);
  const tokens = (req.mustHave ?? []).map(compact).filter((x) => x.length >= 2);
  if (tokens.length) {
    const hits = tokens.filter((tok) => t.includes(tok)).length;
    if (hits < Math.ceil(tokens.length / 2)) return false;
  }
  if (ACCESSORY_RE.test(title) && !ACCESSORY_RE.test(req.query)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// SerpAPI
// ---------------------------------------------------------------------------

interface SerpShoppingResult {
  title?: string;
  source?: string;
  seller?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  condition?: string;
  second_hand_condition?: string;
  tag?: string;
  extensions?: string[];
  immersive_product_page_token?: string;
}

export type Fetcher = (
  url: string,
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const defaultFetcher: Fetcher = (url) => fetchWithTimeout(url, {}, 10_000);

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; results: SerpShoppingResult[] }>();

export function clearPriceCache(): void {
  cache.clear();
}

async function searchCountry(
  query: string,
  country: CountryConfig,
  fetcher: Fetcher,
): Promise<SerpShoppingResult[]> {
  const key = `${country.code}|${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  const params = new URLSearchParams({
    api_key: process.env.SERPAPI_KEY as string,
    engine: "google_shopping",
    q: query,
    gl: country.gl,
    hl: country.hl,
    google_domain: country.domain,
  });
  try {
    const res = await fetcher(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      shopping_results?: SerpShoppingResult[];
    };
    const results = Array.isArray(data.shopping_results)
      ? data.shopping_results.slice(0, 20)
      : [];
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), results });
    return results;
  } catch {
    return [];
  }
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return /(^|\.)google\./.test(host) ? null : host;
  } catch {
    return null;
  }
}

function toOffer(
  r: SerpShoppingResult,
  country: CountryConfig,
  brand: string | null | undefined,
  index: number,
): Offer | null {
  const store = (r.source || r.seller || "").trim();
  if (!store) return null;
  if (includesAny(store, RESALE_STORES)) return null;
  // Google only sets this for second-hand listings ("usado", "gebraucht"…).
  if (r.second_hand_condition?.trim()) return null;
  const condition = `${r.condition ?? ""} ${r.second_hand_condition ?? ""} ${r.tag ?? ""} ${(r.extensions ?? []).join(" ")}`;
  if (USED_RE.test(condition) || USED_RE.test(r.title ?? "")) return null;

  let price: number;
  let currency: string;
  if (typeof r.extracted_price === "number" && r.extracted_price > 0) {
    price = r.extracted_price;
    currency = country.currency;
  } else {
    const parsed = extractPrice(r.price ?? "");
    price = parsed.value;
    currency =
      r.price && /[₺$€£]|TL|TRY|EUR|GBP|USD/.test(r.price)
        ? parsed.currency
        : country.currency;
  }
  if (!(price > 0)) return null;

  const url = r.link || r.product_link;
  if (!url) return null;

  return {
    id: `${country.code}-${index}-${compact(store).slice(0, 24)}`,
    store,
    domain: hostOf(r.link),
    title: r.title?.trim() || null,
    url: affiliateUrl(url),
    price,
    currency,
    priceUSD: Math.round(convertToUSD(price, currency) * 100) / 100,
    country: country.code,
    market: country.market,
    trust: trustFor(store, country.market, brand),
    rating: typeof r.rating === "number" ? r.rating : null,
    reviews: typeof r.reviews === "number" ? r.reviews : null,
    delivery: r.delivery?.trim() || null,
    thumbnail: r.thumbnail || null,
    suspicious: false,
    resolveToken: r.immersive_product_page_token || null,
  };
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Same store selling the same item in one country appears once: keep its lowest price. */
function dedupe(offers: Offer[]): Offer[] {
  const best = new Map<string, Offer>();
  for (const o of offers) {
    const key = `${o.country}|${compact(o.store)}`;
    const prev = best.get(key);
    if (!prev || o.priceUSD < prev.priceUSD) best.set(key, o);
  }
  return [...best.values()];
}

function searchUrlFor(market: Market, query: string): string {
  const domain =
    market === "US"
      ? "google.com"
      : market === "TR"
        ? "google.com.tr"
        : "google.de";
  return `https://www.${domain}/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

/** Score, flag and pick from a list of same-product offers. Pure, for testing. */
export function buildReport(
  offers: Offer[],
  query: string,
  live: boolean,
): PriceReport {
  const all = dedupe(offers);

  // Typical price from the trustworthy part of the market, robust to outliers.
  const trusted = all.filter(
    (o) => o.trust.tier === "official" || o.trust.tier === "major",
  );
  const basis = (trusted.length >= 2 ? trusted : all)
    .map((o) => o.priceUSD)
    .sort((a, b) => a - b);
  const typical = basis.length ? median(basis) : null;

  for (const o of all) {
    if (typical && o.priceUSD < typical * 0.55) {
      o.suspicious = true;
      o.trust = {
        score: Math.max(5, o.trust.score - 35),
        tier: o.trust.tier,
        reasons: [...o.trust.reasons, "Far below the usual price"],
      };
    } else if (typical && o.priceUSD > typical * 2.5) {
      // Almost always a bundle or a different model.
      o.suspicious = true;
    }
  }

  const clean = all.filter((o) => !o.suspicious);
  const byPrice = (a: Offer, b: Offer) => a.priceUSD - b.priceUSD;

  const markets: MarketSummary[] = (["US", "EU", "TR"] as Market[]).map(
    (market) => {
      const list = all
        .filter((o) => o.market === market)
        .sort(
          (a, b) =>
            Number(a.suspicious) - Number(b.suspicious) || byPrice(a, b),
        );
      const lowest = list.find((o) => !o.suspicious && o.trust.score >= 50);
      return {
        market,
        offers: list,
        lowestUSD: lowest ? lowest.priceUSD : null,
        searchUrl: searchUrlFor(market, query),
      };
    },
  );

  const cheapest = [...clean].sort(byPrice)[0] ?? null;
  const safest =
    [...clean].sort(
      (a, b) => b.trust.score - a.trust.score || byPrice(a, b),
    )[0] ?? null;
  const recommended =
    [...clean].filter((o) => o.trust.score >= 80).sort(byPrice)[0] ??
    [...clean].filter((o) => o.trust.score >= 55).sort(byPrice)[0] ??
    cheapest;

  const cleanPrices = clean.map((o) => o.priceUSD).sort((a, b) => a - b);
  const range =
    cleanPrices.length >= 2
      ? {
          min: cleanPrices[0],
          median: Math.round(median(cleanPrices) * 100) / 100,
          max: cleanPrices[cleanPrices.length - 1],
        }
      : null;

  return {
    query,
    markets,
    picks: { cheapest, safest, recommended },
    range,
    sourceCount: clean.length,
    pricedAt: new Date().toISOString(),
    live,
  };
}

async function collect(
  query: string,
  req: PricesRequest,
  countries: string[],
  fetcher: Fetcher,
): Promise<Offer[]> {
  const perCountry = await Promise.all(
    countries.map(async (code) => {
      const country = COUNTRIES[code];
      const results = await searchCountry(query, country, fetcher);
      return results
        .filter((r) =>
          isSameProduct(r.title ?? null, { query, mustHave: req.mustHave }),
        )
        .map((r, i) => toOffer(r, country, req.brand, i))
        .filter((o): o is Offer => o !== null);
    }),
  );
  let offers = perCountry.flat();

  // The model's own retail guess catches accessories/bundles that slip past the title filter.
  const est = req.estimateUSD;
  if (typeof est === "number" && est > 0) {
    const band = offers.filter(
      (o) => o.priceUSD >= est * 0.3 && o.priceUSD <= est * 3.5,
    );
    if (band.length >= 2) offers = band;
  }
  return offers;
}

/** Find new-price offers for a product across US, Europe and Turkey. */
export async function findPrices(
  req: PricesRequest,
  fetcher: Fetcher = defaultFetcher,
): Promise<PriceReport> {
  const query = req.query.trim();
  if (!process.env.SERPAPI_KEY) return buildReport([], query, false);

  const countries = activeCountries();
  let offers = await collect(query, req, countries, fetcher);

  // Too specific? Retry once with the first broader query.
  const fallback = req.altQueries?.find((q) => q.trim() && q.trim() !== query);
  if (offers.length < 2 && fallback) {
    const more = await collect(fallback.trim(), req, countries, fetcher);
    if (more.length > offers.length) offers = more;
  }

  return buildReport(offers, query, true);
}

// ---------------------------------------------------------------------------
// Direct store links
// ---------------------------------------------------------------------------

interface ImmersiveStore {
  name?: string;
  link?: string;
  details_and_offers?: string[];
}

const linkCache = new Map<string, { at: number; stores: ImmersiveStore[] }>();

/**
 * Google Shopping lists offers with a link to its own product page. When the
 * user taps an offer we look up that product's store list once and return the
 * seller's real page (falls back to null, and the caller keeps the Google link).
 */
export async function resolveOfferLink(
  token: string,
  store: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<{ url: string; details: string[] } | null> {
  if (!process.env.SERPAPI_KEY) return null;
  let stores: ImmersiveStore[];
  const hit = linkCache.get(token);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    stores = hit.stores;
  } else {
    const params = new URLSearchParams({
      api_key: process.env.SERPAPI_KEY,
      engine: "google_immersive_product",
      page_token: token,
    });
    try {
      const res = await fetcher(`https://serpapi.com/search.json?${params}`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        product_results?: { stores?: ImmersiveStore[] };
      };
      stores = data.product_results?.stores ?? [];
    } catch {
      return null;
    }
    if (linkCache.size >= CACHE_MAX) {
      const oldest = linkCache.keys().next().value;
      if (oldest !== undefined) linkCache.delete(oldest);
    }
    linkCache.set(token, { at: Date.now(), stores });
  }

  const want = compact(store.split(/\s[-–]\s/)[0]);
  const match =
    stores.find((s) => s.link && compact(s.name ?? "") === want) ??
    stores.find((s) => {
      const n = compact(s.name ?? "");
      return s.link && n && (n.includes(want) || want.includes(n));
    });
  if (!match?.link) return null;
  return {
    url: affiliateUrl(match.link),
    details: match.details_and_offers ?? [],
  };
}
