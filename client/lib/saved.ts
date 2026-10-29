import type {
  Offer,
  PriceReport,
  ProductIdentity,
  SavedItem,
  StoredDeal,
} from "@/types";

function toStoredDeal(o: Offer): StoredDeal {
  return {
    storeName: o.store,
    price: o.priceUSD,
    currency: "USD",
    url: o.url,
    region: o.country,
  };
}

export function newSavedId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Build the saved record for a scan. Prices are the recommended buy at save time. */
export function savedItemFrom(args: {
  id: string;
  identity: ProductIdentity;
  report: PriceReport | null;
  dateAdded?: string;
  image?: { imageUri?: string; thumbnailUri?: string };
}): SavedItem {
  const best = args.report?.picks.recommended ?? null;
  const price = best ? best.priceUSD : 0;
  const offers = args.report
    ? args.report.markets.flatMap((m) => m.offers)
    : [];
  return {
    id: args.id,
    itemName: args.identity.name,
    category: args.identity.category,
    estimatedPrice: price,
    currency: "USD",
    purchasePrice: price,
    trendPercentage: 0,
    confidenceScore: args.identity.confidence,
    investmentRating: "HOLD",
    isAuthentic: true,
    history: price > 0 ? [price] : [],
    deals: offers
      .filter((o) => !o.suspicious)
      .slice(0, 20)
      .map(toStoredDeal),
    dateAdded: args.dateAdded ?? new Date().toISOString(),
    imageUri: args.image?.imageUri,
    thumbnailUri: args.image?.thumbnailUri,
    identity: args.identity,
    report: args.report ?? undefined,
  };
}

/** Best price to show in the saved list, USD. */
export function bestPriceOf(
  item: SavedItem,
): { usd: number; store: string } | null {
  const rec = item.report?.picks.recommended;
  if (rec) return { usd: rec.priceUSD, store: rec.store };
  if (item.estimatedPrice > 0) {
    const cheapest = [...(item.deals ?? [])].sort(
      (a, b) => a.price - b.price,
    )[0];
    return { usd: item.estimatedPrice, store: cheapest?.storeName ?? "" };
  }
  return null;
}
