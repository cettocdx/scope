/**
 * Price-fairness rating display. The underlying signal is BUY/SELL/HOLD, but we
 * surface it as a neutral PRICE judgement — never as investment advice — to keep
 * the product honest and clear of App Store financial-advice rejection.
 */
export type Rating = "BUY" | "SELL" | "HOLD";

/** Full label shown on the result / detail screens. */
export function ratingLabel(rating: string): string {
  switch (rating) {
    case "BUY":
      return "GOOD DEAL";
    case "SELL":
      return "OVERPRICED";
    default:
      return "FAIR PRICE";
  }
}

/** Compact label for tight spots (e.g. analytics stat buckets). */
export function ratingShort(rating: string): string {
  switch (rating) {
    case "BUY":
      return "DEALS";
    case "SELL":
      return "PRICEY";
    default:
      return "FAIR";
  }
}

/** Shown wherever a rating or price estimate appears. */
export const RATING_DISCLAIMER = "Price guidance only — not financial advice.";
