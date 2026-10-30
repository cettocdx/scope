import { describe, it, expect, afterEach } from "vitest";
import { findVisualMatches, toVisualMatches } from "../lens";
import type { Fetcher } from "../pricing";

describe("toVisualMatches", () => {
  it("keeps shops, drops resale and social pages, puts priced pages first", () => {
    const out = toVisualMatches([
      {
        title: "Sony WH-1000XM5",
        source: "Trendyol",
        link: "https://www.trendyol.com/sony/x",
      },
      {
        title: "Sony WH-1000XM5 2. el",
        source: "sahibinden",
        link: "https://sahibinden.com/a",
      },
      {
        title: "my setup",
        source: "Pinterest",
        link: "https://pinterest.com/p",
      },
      {
        title: "Sony WH-1000XM5",
        source: "MediaMarkt",
        link: "https://www.mediamarkt.com.tr/p?utm=1",
        price: { value: "13.999,00 TL", extracted_value: 13999 },
        in_stock: true,
      },
      {
        title: "dup",
        source: "MediaMarkt",
        link: "https://www.mediamarkt.com.tr/p?utm=2",
      },
    ]);
    expect(out.map((m) => m.store)).toEqual(["MediaMarkt", "Trendyol"]);
    expect(out[0].price).toBe(13999);
    expect(out[0].currency).toBe("TRY");
    expect(out[0].inStock).toBe(true);
    expect(out[1].price).toBeNull();
  });
});

describe("findVisualMatches", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("asks Lens in the user's market and returns nothing without a key", async () => {
    let asked = "";
    const fetcher: Fetcher = async (url) => {
      asked = url;
      return { ok: true, json: async () => ({ visual_matches: [] }) };
    };
    delete process.env.SERPAPI_KEY;
    expect(await findVisualMatches("https://img/x.jpg", "TR", fetcher)).toEqual(
      [],
    );
    expect(asked).toBe("");

    process.env.SERPAPI_KEY = "test";
    await findVisualMatches("https://img/x.jpg", "TR", fetcher);
    const params = new URL(asked).searchParams;
    expect(params.get("engine")).toBe("google_lens");
    expect(params.get("country")).toBe("tr");
    expect(params.get("url")).toBe("https://img/x.jpg");
  });
});
