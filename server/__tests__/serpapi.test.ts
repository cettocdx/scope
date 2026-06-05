import { describe, it, expect } from "vitest";
import { extractPrice, convertToUSD, EXCHANGE_RATES } from "../serpapi";

describe("extractPrice", () => {
  it("parses US number format (1,234.56)", () => {
    expect(extractPrice("1,234.56").value).toBeCloseTo(1234.56);
  });

  it("parses EU number format (1.234,56)", () => {
    expect(extractPrice("1.234,56").value).toBeCloseTo(1234.56);
  });

  it("parses a single decimal comma (EU style, e.g. 99,90)", () => {
    expect(extractPrice("99,90").value).toBeCloseTo(99.9);
  });

  it("treats a single comma with 3 trailing digits as a thousands separator", () => {
    expect(extractPrice("$1,299").value).toBeCloseTo(1299);
    expect(extractPrice("1,234").value).toBeCloseTo(1234);
  });

  it("treats a single comma with exactly 2 trailing digits as a decimal separator", () => {
    expect(extractPrice("19,99").value).toBeCloseTo(19.99);
  });

  it("treats a single dot with 2 trailing digits as a decimal separator", () => {
    expect(extractPrice("19.99").value).toBeCloseTo(19.99);
  });

  it("treats a single dot with 3 trailing digits as a thousands separator", () => {
    expect(extractPrice("1.234").value).toBeCloseTo(1234);
  });

  it("parses mixed-separator values regardless of order", () => {
    expect(extractPrice("1,234.56").value).toBeCloseTo(1234.56);
    expect(extractPrice("1.234,56").value).toBeCloseTo(1234.56);
  });

  it("detects USD for the $ symbol (default)", () => {
    expect(extractPrice("$1,234.56").currency).toBe("USD");
    expect(extractPrice("1234.56").currency).toBe("USD");
  });

  it("detects TRY for the ₺ / TL / TRY markers", () => {
    expect(extractPrice("₺1.234,56").currency).toBe("TRY");
    expect(extractPrice("1.234,56 TL").currency).toBe("TRY");
    expect(extractPrice("TRY 1.234,56").currency).toBe("TRY");
  });

  it("detects EUR for the € / EUR markers", () => {
    expect(extractPrice("€1.234,56").currency).toBe("EUR");
    expect(extractPrice("1.234,56 EUR").currency).toBe("EUR");
  });

  it("detects GBP for the £ / GBP markers", () => {
    expect(extractPrice("£1,234.56").currency).toBe("GBP");
  });

  it("parses a currency-prefixed EU value correctly (₺ symbol + EU grouping)", () => {
    const result = extractPrice("₺1.234,56");
    expect(result.value).toBeCloseTo(1234.56);
    expect(result.currency).toBe("TRY");
  });

  it("returns 0 and defaults to USD for invalid / empty input", () => {
    expect(extractPrice("").value).toBe(0);
    expect(extractPrice("N/A").value).toBe(0);
    expect(extractPrice("abc").value).toBe(0);
    expect(extractPrice("").currency).toBe("USD");
  });
});

describe("convertToUSD (serpapi)", () => {
  it("leaves USD unchanged", () => {
    expect(convertToUSD(100, "USD")).toBe(100);
  });

  it("converts TRY using EXCHANGE_RATES and rounds to 2 decimals", () => {
    expect(convertToUSD(1000, "TRY")).toBeCloseTo(
      Math.round(1000 * EXCHANGE_RATES.TRY * 100) / 100,
    );
  });

  it("converts EUR using EXCHANGE_RATES", () => {
    expect(convertToUSD(100, "EUR")).toBeCloseTo(
      Math.round(100 * EXCHANGE_RATES.EUR * 100) / 100,
    );
  });

  it("converts GBP using EXCHANGE_RATES", () => {
    expect(convertToUSD(100, "GBP")).toBeCloseTo(
      Math.round(100 * EXCHANGE_RATES.GBP * 100) / 100,
    );
  });

  it("falls back to a 1:1 rate for an unknown currency", () => {
    expect(convertToUSD(100, "JPY")).toBe(100);
  });
});
