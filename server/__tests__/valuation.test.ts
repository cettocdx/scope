import { describe, it, expect } from "vitest";
import { calculateValuation, convertToUSD, FX_RATES } from "../routes";

describe("convertToUSD (routes)", () => {
  it("returns the same amount for USD", () => {
    expect(convertToUSD(100, "USD")).toBe(100);
    expect(convertToUSD(100, "$")).toBe(100);
  });

  it("converts TRY to USD using the TRY_USD rate", () => {
    const amount = 1000;
    expect(convertToUSD(amount, "TRY")).toBeCloseTo(amount * FX_RATES.TRY_USD);
    expect(convertToUSD(amount, "TL")).toBeCloseTo(amount * FX_RATES.TRY_USD);
    expect(convertToUSD(amount, "₺")).toBeCloseTo(amount * FX_RATES.TRY_USD);
  });

  it("converts EUR to USD using the EUR_USD rate", () => {
    const amount = 100;
    expect(convertToUSD(amount, "EUR")).toBeCloseTo(amount * FX_RATES.EUR_USD);
    expect(convertToUSD(amount, "€")).toBeCloseTo(amount * FX_RATES.EUR_USD);
  });

  it("returns the amount unchanged for an unknown currency", () => {
    expect(convertToUSD(100, "JPY")).toBe(100);
  });
});

describe("calculateValuation", () => {
  it("returns a zero range for empty deals", () => {
    const result = calculateValuation([], "USD");
    expect(result.priceRange).toEqual({
      min: 0,
      median: 0,
      max: 0,
      currency: "USD",
    });
    expect(result.outlierCount).toBe(0);
    expect(result.processedDeals).toEqual([]);
  });

  it("returns a zero range when deals are missing entirely", () => {
    // @ts-expect-error - exercising the null-guard branch
    const result = calculateValuation(undefined, "EUR");
    expect(result.priceRange).toEqual({
      min: 0,
      median: 0,
      max: 0,
      currency: "EUR",
    });
    expect(result.outlierCount).toBe(0);
  });

  it("computes min / median / max for an odd number of in-range prices", () => {
    const deals = [
      { price: 100, currency: "USD" },
      { price: 200, currency: "USD" },
      { price: 300, currency: "USD" },
    ];
    const result = calculateValuation(deals, "USD");
    expect(result.priceRange.min).toBe(100);
    expect(result.priceRange.max).toBe(300);
    expect(result.priceRange.median).toBe(200);
    expect(result.outlierCount).toBe(0);
  });

  it("computes the median as the average of the two middle prices for an even count", () => {
    const deals = [
      { price: 100, currency: "USD" },
      { price: 200, currency: "USD" },
      { price: 300, currency: "USD" },
      { price: 400, currency: "USD" },
    ];
    const result = calculateValuation(deals, "USD");
    expect(result.priceRange.min).toBe(100);
    expect(result.priceRange.max).toBe(400);
    // even count -> (200 + 300) / 2 = 250
    expect(result.priceRange.median).toBe(250);
  });

  it("flags an extreme high price as an outlier and counts it", () => {
    const deals = [
      { price: 100, currency: "USD" },
      { price: 105, currency: "USD" },
      { price: 110, currency: "USD" },
      { price: 95, currency: "USD" },
      { price: 102, currency: "USD" },
      { price: 5000, currency: "USD" }, // extreme high
    ];
    const result = calculateValuation(deals, "USD");
    expect(result.outlierCount).toBe(1);
    const outlier = result.processedDeals.find((d) => d.price === 5000);
    expect(outlier?.isOutlier).toBe(true);
    // outliers are excluded from the reported range
    expect(result.priceRange.max).toBeLessThan(5000);
  });

  it("flags an extreme low price as an outlier", () => {
    const deals = [
      { price: 1000, currency: "USD" },
      { price: 1050, currency: "USD" },
      { price: 1100, currency: "USD" },
      { price: 980, currency: "USD" },
      { price: 1020, currency: "USD" },
      { price: 1, currency: "USD" }, // extreme low
    ];
    const result = calculateValuation(deals, "USD");
    expect(result.outlierCount).toBe(1);
    const outlier = result.processedDeals.find((d) => d.price === 1);
    expect(outlier?.isOutlier).toBe(true);
    expect(result.priceRange.min).toBeGreaterThan(1);
  });

  it("marks no outliers when all prices are tightly clustered", () => {
    const deals = [
      { price: 100, currency: "USD" },
      { price: 101, currency: "USD" },
      { price: 102, currency: "USD" },
      { price: 103, currency: "USD" },
    ];
    const result = calculateValuation(deals, "USD");
    expect(result.outlierCount).toBe(0);
    expect(result.processedDeals.every((d) => d.isOutlier === false)).toBe(
      true,
    );
  });

  it("converts non-USD prices before computing the range", () => {
    // 1000 TRY -> ~29 USD ; pair with a USD price to verify conversion is applied.
    const deals = [
      { price: 1000, currency: "TRY" },
      { price: 1000, currency: "TRY" },
    ];
    const result = calculateValuation(deals, "USD");
    const expectedUsd = Math.round(1000 * FX_RATES.TRY_USD);
    expect(result.priceRange.min).toBe(expectedUsd);
    expect(result.priceRange.max).toBe(expectedUsd);
  });

  it("produces a deterministic qualityScore (no randomness)", () => {
    const deals = [
      { price: 100, currency: "USD" },
      { price: 105, currency: "USD" },
      { price: 110, currency: "USD" },
      { price: 5000, currency: "USD" },
    ];
    const first = calculateValuation(deals, "USD");
    const second = calculateValuation(deals, "USD");
    // Same input must yield identical qualityScores across runs.
    const firstScores = first.processedDeals.map((d) => d.qualityScore);
    const secondScores = second.processedDeals.map((d) => d.qualityScore);
    expect(firstScores).toEqual(secondScores);
    // Non-outliers score 80, outliers score 30 — fixed, not random.
    for (const deal of first.processedDeals) {
      expect(deal.qualityScore).toBe(deal.isOutlier ? 30 : 80);
    }
  });
});
