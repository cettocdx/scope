import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildReport,
  clearPriceCache,
  findPrices,
  isSameProduct,
  resolveOfferLink,
  trustFor,
  type Fetcher,
} from "../pricing";
import type { Offer } from "@shared/scan";

function offer(p: Partial<Offer> & { store: string; priceUSD: number }): Offer {
  return {
    id: `${p.store}-${p.priceUSD}`,
    domain: null,
    title: null,
    url: "https://example.com",
    price: p.priceUSD,
    currency: "USD",
    country: "US",
    market: "US",
    trust: trustFor(p.store, p.market ?? "US", "Apple"),
    rating: null,
    reviews: null,
    delivery: null,
    thumbnail: null,
    suspicious: false,
    resolveToken: null,
    ...p,
  };
}

describe("trustFor", () => {
  it("treats the brand's own store as official", () => {
    expect(trustFor("Apple", "US", "Apple").tier).toBe("official");
    expect(trustFor("Apple Store", "EU", "Apple").tier).toBe("official");
  });

  it("knows major retailers per market", () => {
    expect(trustFor("Best Buy", "US", "Sony").tier).toBe("major");
    expect(trustFor("MediaMarkt", "EU", "Sony").tier).toBe("major");
    expect(trustFor("Hepsiburada", "TR", "Sony").tier).toBe("major");
  });

  it("ranks open marketplaces and unknown shops lower", () => {
    const market = trustFor("AliExpress", "US", "Sony");
    const unknown = trustFor("gadgetzone24", "US", "Sony");
    expect(market.tier).toBe("marketplace");
    expect(unknown.tier).toBe("unknown");
    expect(market.score).toBeLessThan(trustFor("Best Buy", "US", "Sony").score);
  });

  it("treats third-party sellers on big platforms as marketplace sellers", () => {
    expect(trustFor("Mediamarkt Marketplace DE", "EU", "Sony").tier).toBe(
      "marketplace",
    );
    expect(trustFor("Walmart - Focus Camera", "US", "Sony").tier).toBe(
      "marketplace",
    );
    expect(trustFor("Amazon.com.tr – pazaryeri", "TR", "Sony").tier).toBe(
      "marketplace",
    );
    expect(trustFor("MediaMarkt ES", "EU", "Sony").tier).toBe("major");
  });

  it("does not call a store official because a short brand is a substring", () => {
    expect(trustFor("LGadgets", "US", "LG").tier).not.toBe("official");
  });
});

describe("isSameProduct", () => {
  const req = {
    query: "Apple AirPods Pro 2 USB-C",
    mustHave: ["airpods pro", "usb-c"],
  };

  it("accepts titles with the key tokens, in any language", () => {
    expect(
      isSameProduct("Apple AirPods Pro (2. Generation) mit USB-C", req),
    ).toBe(true);
  });

  it("rejects accessories for the product", () => {
    expect(isSameProduct("Silicone case for AirPods Pro USB-C", req)).toBe(
      false,
    );
    expect(isSameProduct("AirPods Pro USB-C Kılıf", req)).toBe(false);
  });

  it("rejects a different product", () => {
    expect(isSameProduct("Samsung Galaxy Buds 3 Pro", req)).toBe(false);
  });
});

describe("buildReport", () => {
  it("picks cheapest, safest and recommended, and flags a too-good-to-be-true price", () => {
    const report = buildReport(
      [
        offer({ store: "Apple", priceUSD: 249 }),
        offer({ store: "Best Buy", priceUSD: 229 }),
        offer({ store: "Amazon", priceUSD: 219 }),
        offer({ store: "gadgetzone24", priceUSD: 205 }),
        offer({ store: "cheapbuds", priceUSD: 59 }),
        offer({
          store: "Hepsiburada",
          priceUSD: 240,
          market: "TR",
          country: "TR",
        }),
        offer({
          store: "MediaMarkt",
          priceUSD: 235,
          market: "EU",
          country: "DE",
        }),
      ],
      "AirPods Pro 2",
      true,
    );

    const scam = report.markets[0].offers.find((o) => o.store === "cheapbuds");
    expect(scam?.suspicious).toBe(true);
    expect(report.picks.cheapest?.store).toBe("gadgetzone24");
    expect(report.picks.safest?.store).toBe("Apple");
    expect(report.picks.recommended?.store).toBe("Amazon");
    expect(report.markets.map((m) => m.market)).toEqual(["US", "EU", "TR"]);
    expect(report.markets[2].lowestUSD).toBe(240);
    expect(report.range?.median).toBeGreaterThan(200);
    expect(report.sourceCount).toBe(6);
  });

  it("keeps one entry per store per country (its lowest price)", () => {
    const report = buildReport(
      [
        offer({ store: "Amazon", priceUSD: 230 }),
        offer({ store: "Amazon", priceUSD: 219 }),
      ],
      "x",
      true,
    );
    expect(report.markets[0].offers).toHaveLength(1);
    expect(report.markets[0].offers[0].priceUSD).toBe(219);
  });

  it("returns empty picks and a search link per market when nothing was found", () => {
    const report = buildReport([], "Dyson V15", false);
    expect(report.picks.cheapest).toBeNull();
    expect(report.range).toBeNull();
    expect(
      report.markets.every((m) => m.searchUrl.includes("Dyson%20V15")),
    ).toBe(true);
  });
});

describe("findPrices", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    clearPriceCache();
    process.env.SERPAPI_KEY = "test";
    process.env.PRICE_COUNTRIES = "US,DE,TR";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const results: Record<string, unknown[]> = {
    us: [
      {
        title: "Apple AirPods Pro 2 USB-C",
        source: "Best Buy",
        extracted_price: 229,
        link: "https://bestbuy.com/a",
      },
      {
        title: "Apple AirPods Pro 2 USB-C (Renewed)",
        source: "Amazon",
        extracted_price: 150,
        link: "https://amazon.com/r",
      },
      {
        title: "Case for AirPods Pro 2 USB-C",
        source: "Amazon",
        extracted_price: 12,
        link: "https://amazon.com/c",
      },
      {
        title: "AirPods Pro 2 USB-C",
        source: "Tienda de segunda mano",
        extracted_price: 120,
        second_hand_condition: "usado",
        link: "https://shop.example/a",
      },
      {
        title: "Apple AirPods Pro 2 USB-C",
        source: "eBay",
        extracted_price: 160,
        link: "https://ebay.com/x",
      },
    ],
    de: [
      {
        title: "Apple AirPods Pro (2. Gen.) USB-C",
        source: "MediaMarkt",
        extracted_price: 219,
        link: "https://mediamarkt.de/a",
      },
    ],
    tr: [
      {
        title: "Apple AirPods Pro 2. Nesil USB-C",
        source: "Hepsiburada",
        extracted_price: 8999,
        link: "https://hepsiburada.com/a",
      },
    ],
  };

  const fetcher: Fetcher = async (url) => {
    const gl = new URL(url).searchParams.get("gl") ?? "";
    return {
      ok: true,
      json: async () => ({ shopping_results: results[gl] ?? [] }),
    };
  };

  it("queries every country in parallel and keeps only new, same-product offers", async () => {
    const report = await findPrices(
      {
        query: "Apple AirPods Pro 2 USB-C",
        mustHave: ["airpods pro", "usb-c"],
        brand: "Apple",
        estimateUSD: 249,
      },
      fetcher,
    );
    const stores = report.markets
      .flatMap((m) => m.offers.map((o) => o.store))
      .sort();
    expect(stores).toEqual(["Best Buy", "Hepsiburada", "MediaMarkt"]);
    const tr = report.markets.find((m) => m.market === "TR")?.offers[0];
    expect(tr?.currency).toBe("TRY");
    expect(tr?.price).toBe(8999);
    expect(report.live).toBe(true);
  });

  it("reports live=false without a SerpAPI key instead of inventing prices", async () => {
    delete process.env.SERPAPI_KEY;
    const report = await findPrices({ query: "anything" }, fetcher);
    expect(report.live).toBe(false);
    expect(report.sourceCount).toBe(0);
  });

  it("caches per country and query", async () => {
    let calls = 0;
    const counting: Fetcher = async (url) => {
      calls++;
      return fetcher(url);
    };
    await findPrices(
      { query: "Apple AirPods Pro 2 USB-C", mustHave: ["airpods pro"] },
      counting,
    );
    await findPrices(
      { query: "Apple AirPods Pro 2 USB-C", mustHave: ["airpods pro"] },
      counting,
    );
    expect(calls).toBe(3);
  });
});

describe("resolveOfferLink", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("finds the tapped seller's own page in the product's store list", async () => {
    process.env.SERPAPI_KEY = "test";
    const fetcher: Fetcher = async () => ({
      ok: true,
      json: async () => ({
        product_results: {
          stores: [
            { name: "Amazon.es", link: "https://www.amazon.es/dp/X" },
            {
              name: "MediaMarkt ES",
              link: "https://www.mediamarkt.es/p/Y",
              details_and_offers: ["Envío gratuito"],
            },
          ],
        },
      }),
    });
    const link = await resolveOfferLink(
      "token-mediamarkt-1",
      "MediaMarkt ES",
      fetcher,
    );
    expect(link?.url).toBe("https://www.mediamarkt.es/p/Y");
    expect(link?.details).toEqual(["Envío gratuito"]);
    expect(
      await resolveOfferLink("token-other-0001", "Unknown shop", fetcher),
    ).toBeNull();
  });
});
