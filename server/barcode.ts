import { fetchWithTimeout } from "./serpapi";
import type { Fetcher } from "./pricing";

/**
 * Barcode → product name, from open product databases. A scanned EAN/UPC is
 * the most exact signal we can get, so the name found here is handed to the
 * vision model as a fact. Each source has a short timeout; misses are fine.
 *
 * - UPCitemdb (trial tier, no key): electronics, fashion, home, toys…
 * - Open Food Facts / Open Beauty Facts: groceries and cosmetics.
 */

export interface BarcodeProduct {
  name: string;
  brand: string | null;
  source: "upcitemdb" | "openfoodfacts" | "openbeautyfacts";
}

const TIMEOUT_MS = 2_500;
const cache = new Map<string, BarcodeProduct | null>();
const defaultFetcher: Fetcher = (url) =>
  fetchWithTimeout(url, { headers: { "User-Agent": "SCOPE/1.0" } }, TIMEOUT_MS);

async function upcItemDb(
  code: string,
  fetcher: Fetcher,
): Promise<BarcodeProduct | null> {
  const res = await fetcher(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { title?: string; brand?: string }[];
  };
  const item = data.items?.[0];
  if (!item?.title) return null;
  return {
    name: item.title.trim(),
    brand: item.brand?.trim() || null,
    source: "upcitemdb",
  };
}

async function openFacts(
  code: string,
  host: "world.openfoodfacts.org" | "world.openbeautyfacts.org",
  fetcher: Fetcher,
): Promise<BarcodeProduct | null> {
  const res = await fetcher(
    `https://${host}/api/v2/product/${code}.json?fields=product_name,brands,quantity`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: number;
    product?: { product_name?: string; brands?: string; quantity?: string };
  };
  const p = data.product;
  if (data.status !== 1 || !p?.product_name) return null;
  const brand = p.brands?.split(",")[0]?.trim() || null;
  const title = p.product_name.trim();
  const withBrand = brand && !title.toLowerCase().includes(brand.toLowerCase());
  const name = [withBrand ? brand : null, title, p.quantity?.trim()]
    .filter(Boolean)
    .join(" ");
  return {
    name,
    brand,
    source: host.includes("food") ? "openfoodfacts" : "openbeautyfacts",
  };
}

export async function lookupBarcode(
  code: string,
  fetcher: Fetcher = defaultFetcher,
): Promise<BarcodeProduct | null> {
  if (!/^\d{8,14}$/.test(code)) return null;
  if (cache.has(code)) return cache.get(code) ?? null;
  const safe = (p: Promise<BarcodeProduct | null>) => p.catch(() => null);
  const [upc, food, beauty] = await Promise.all([
    safe(upcItemDb(code, fetcher)),
    safe(openFacts(code, "world.openfoodfacts.org", fetcher)),
    safe(openFacts(code, "world.openbeautyfacts.org", fetcher)),
  ]);
  const found = upc ?? food ?? beauty;
  if (cache.size > 2000) cache.clear();
  cache.set(code, found);
  return found;
}
