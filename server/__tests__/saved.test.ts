import { describe, expect, it } from "vitest";

import { savedItemFrom } from "@/lib/saved";
import type { PriceReport, ProductIdentity } from "@shared/scan";

const identity = { name: "Sony WH-1000XM5" } as ProductIdentity;
const reportAt = (priceUSD: number) =>
  ({
    markets: [],
    picks: { recommended: { priceUSD, store: "Amazon" } },
  }) as unknown as PriceReport;

describe("savedItemFrom price tracking", () => {
  it("starts the history at the save-time price", () => {
    const item = savedItemFrom({ id: "a", identity, report: reportAt(300) });
    expect(item.purchasePrice).toBe(300);
    expect(item.history).toEqual([300]);
    expect(item.trendPercentage).toBe(0);
  });

  it("keeps the save-time price and reports the move on refresh", () => {
    const first = savedItemFrom({ id: "a", identity, report: reportAt(300) });
    const next = savedItemFrom({
      id: "a",
      identity,
      report: reportAt(270),
      previous: first,
    });
    expect(next.purchasePrice).toBe(300);
    expect(next.history).toEqual([300, 270]);
    expect(next.trendPercentage).toBe(-10);
  });

  it("keeps the old history when a refresh finds no price", () => {
    const first = savedItemFrom({ id: "a", identity, report: reportAt(300) });
    const next = savedItemFrom({
      id: "a",
      identity,
      report: null,
      previous: first,
    });
    expect(next.history).toEqual([300]);
    expect(next.trendPercentage).toBe(0);
  });
});
