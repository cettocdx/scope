import { describe, expect, it } from "vitest";

import { nextSale } from "@/lib/sale-calendar";

describe("nextSale", () => {
  it("finds 11.11 first for electronics at the end of October in Türkiye", () => {
    const s = nextSale("Electronics", "TR", new Date(2026, 9, 31));
    expect(s?.name).toBe("11.11 Singles' Day");
    expect(s?.days).toBe(11);
  });

  it("puts Black Friday on the 4th Friday of November", () => {
    const s = nextSale("Fashion", "US", new Date(2026, 10, 12));
    expect(s?.name).toBe("Black Friday");
    expect(s?.start.getDate()).toBe(27);
    expect(s?.start.getDay()).toBe(5);
  });

  it("points fashion to the winter season-end sale after November", () => {
    const s = nextSale("Bags", "EU", new Date(2026, 11, 5));
    expect(s?.name).toBe("Winter season-end sale");
  });
});
