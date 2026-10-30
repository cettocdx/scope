import { describe, expect, it } from "vitest";

import { lookupBarcode } from "../barcode";
import type { Fetcher } from "../pricing";

const respond =
  (byHost: Record<string, unknown>): Fetcher =>
  async (url) => {
    const host = new URL(url).host;
    const body = byHost[host];
    return { ok: body !== undefined, json: async () => body ?? {} };
  };

describe("lookupBarcode", () => {
  it("names a product from UPCitemdb", async () => {
    const found = await lookupBarcode(
      "027242923232",
      respond({
        "api.upcitemdb.com": {
          items: [
            { title: "Sony WH-1000XM5 Headphones - Black", brand: "Sony" },
          ],
        },
      }),
    );
    expect(found).toEqual({
      name: "Sony WH-1000XM5 Headphones - Black",
      brand: "Sony",
      source: "upcitemdb",
    });
  });

  it("falls back to Open Food Facts with brand and size", async () => {
    const found = await lookupBarcode(
      "5449000000996",
      respond({
        "world.openfoodfacts.org": {
          status: 1,
          product: {
            product_name: "Coca-Cola Original",
            brands: "Coca-Cola",
            quantity: "330 ml",
          },
        },
      }),
    );
    expect(found?.name).toBe("Coca-Cola Original 330 ml");
    expect(found?.source).toBe("openfoodfacts");
  });

  it("ignores anything that is not a retail barcode", async () => {
    expect(await lookupBarcode("abc", respond({}))).toBeNull();
  });
});
