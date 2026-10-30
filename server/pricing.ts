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
  "gardrops",
  "modacruz",
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

/** Seller names that say "second-hand" (Secondipity, SecondBest, 2nd Hand…). */
// Shops that sell second-hand by trade: vintage, antique, consignment and
// "pre-loved" luxury resellers (LuxSpace, 58 Facettes, The Antique Guild…).
const RESALE_NAME_RE =
  /\bsecond|\b2nd[\s-]?hand|\brefurb|\brenewed|\bpre-?owned|\bpre-?loved|\bikinci ?el|vintage|antiq|\bantik|\bconsign|\bcollective\b|\bestate\b|\bluxspace|\bfacettes\b|\bchronomentum|\bcollector ?square|\brebag\b|\breebonz|\bluxury ?closet|\bbrandoff|\bkomehyo|\bvestiaire/i;

const USED_RE =
  /\b(used|pre-?owned|pre-?loved|second[\s-]?hand|segunda mano|refurb(ished)?|renewed|open[\s-]?box|gebraucht|generalüberholt|occasion|reconditionn[ée]e?|usag[ée]e?|usato|usata|ricondizionat[oa]|usado|usada|seminuevo|reacondicionad[oa]|ikinci el|2\.? ?el|yenilenmi[sş]|teşhir)\b/i;

const FAKE_RE =
  /\b(replica|réplica|replika|1:1|aaa\+?|mirror quality|super ?copy|inspired by|dupe|fake|imitation|kopya|muadil)\b/i;
const FAKE_STORE_RE = /^account\b|\breplica|\breplika/i;

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

const defaultFetcher: Fetcher = (url) => fetchWithTimeout(url, {}, 6_000);

/**
 * The whole price search answers within this budget. A country still loading
 * is left out of this answer (its request keeps running and fills the cache, so
 * a refresh moments later has it) instead of holding every other market back.
 */
const PRICE_DEADLINE_MS = 7_000;

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
  if (includesAny(store, RESALE_STORES) || RESALE_NAME_RE.test(store))
    return null;
  // Google only sets this for second-hand listings ("usado", "gebraucht"…).
  if (r.second_hand_condition?.trim()) return null;
  // Replicas and throwaway seller accounts are never a buy.
  if (FAKE_RE.test(r.title ?? "") || FAKE_STORE_RE.test(store)) return null;
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
    // One row per store per market: a shop listed in DE, FR and IT shows once.
    const key = `${o.market}|${compact(o.store)}`;
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
  homeMarket?: Market | null,
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
  // Buying at home avoids cross-border shipping, customs and returns, so a
  // trustworthy offer in the user's own market wins over a cheaper one abroad.
  const bestBalance = (pool: Offer[]) =>
    [...pool].filter((o) => o.trust.score >= 80).sort(byPrice)[0] ??
    [...pool].filter((o) => o.trust.score >= 55).sort(byPrice)[0];
  // An official store or big retailer abroad beats an unknown shop at home:
  // for luxury goods the local results are often resellers or fakes.
  const solid = (pool: Offer[]) =>
    [...pool].filter((o) => o.trust.score >= 80).sort(byPrice)[0];
  const homePool = homeMarket
    ? clean.filter((o) => o.market === homeMarket)
    : [];
  const local = homeMarket
    ? (solid(homePool) ?? (solid(clean) ? undefined : bestBalance(homePool)))
    : undefined;
  const recommended = local ?? bestBalance(clean) ?? cheapest;

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
    picks: {
      cheapest,
      safest,
      recommended,
      recommendedIsLocal: Boolean(local),
    },
    range,
    sourceCount: clean.length,
    pricedAt: new Date().toISOString(),
    live,
  };
}

/**
 * Queries to try, most specific first. Google Shopping often returns nothing
 * for a long, exact listing name in one country while the short brand + model
 * name finds dozens of offers, so each country falls back on its own.
 */
export function queriesFor(req: PricesRequest): string[] {
  const out: string[] = [];
  const add = (q: string | null | undefined) => {
    const clean = q?.replace(/\s+/g, " ").trim();
    if (clean && !out.some((o) => o.toLowerCase() === clean.toLowerCase()))
      out.push(clean);
  };
  add(req.query);
  if (req.brand && req.model) add(`${req.brand} ${req.model}`);
  for (const q of req.altQueries ?? []) add(q);
  // Last resort: the first four words ("Louis Vuitton Neverfull MM").
  add(req.query.split(/\s+/).slice(0, 4).join(" "));
  return out.slice(0, 3);
}

/** Enough listings in one country to stop trying broader queries. */
const ENOUGH_RESULTS = 3;

async function searchCountryCascade(
  queries: string[],
  country: CountryConfig,
  fetcher: Fetcher,
): Promise<SerpShoppingResult[]> {
  let best: SerpShoppingResult[] = [];
  for (const q of queries) {
    const results = await searchCountry(q, country, fetcher);
    if (results.length > best.length) best = results;
    if (best.length >= ENOUGH_RESULTS) break;
  }
  return best;
}

function withDeadline<T>(
  work: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

async function collect(
  req: PricesRequest,
  countries: string[],
  fetcher: Fetcher,
  deadlineMs: number,
): Promise<Offer[]> {
  const queries = queriesFor(req);
  const perCountry = await Promise.all(
    countries.map(async (code) => {
      const country = COUNTRIES[code];
      const results = await withDeadline(
        searchCountryCascade(queries, country, fetcher),
        deadlineMs,
        [],
      );
      return results
        .filter((r) =>
          isSameProduct(r.title ?? null, {
            query: req.query,
            mustHave: req.mustHave,
          }),
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

export async function findPrices(
  req: PricesRequest,
  fetcher: Fetcher = defaultFetcher,
  deadlineMs: number = PRICE_DEADLINE_MS,
  /** Search only these markets (e.g. the user's own, for cheap side lookups). */
  onlyMarkets?: Market[],
): Promise<PriceReport> {
  const query = req.query.trim();
  if (!process.env.SERPAPI_KEY) return buildReport([], query, false);
  const countries = onlyMarkets
    ? activeCountries().filter((c) => onlyMarkets.includes(COUNTRIES[c].market))
    : activeCountries();
  const offers = await collect(
    { ...req, query },
    countries,
    fetcher,
    deadlineMs,
  );
  return buildReport(offers, query, true, req.homeMarket);
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
