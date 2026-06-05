import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { PortfolioAsset } from "@/types";

const PORTFOLIO_STORAGE_KEY = "scope_portfolio_v1";
const DEVICE_ID_KEY = "scope_device_id";

// Cloud sync is best-effort; bound each request so a stalled network never
// leaves a fire-and-forget promise hanging forever.
const CLOUD_TIMEOUT_MS = 10_000;

function generateDeviceId(): string {
  // Build a long, high-entropy UUID-like id without adding dependencies.
  // Prefer a native crypto UUID when available, otherwise combine multiple
  // random segments so the id is not trivially enumerable.
  const cryptoObj = (globalThis as any)?.crypto;
  if (cryptoObj?.randomUUID) {
    return `device-${cryptoObj.randomUUID()}`;
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `device-${hex}`;
  }

  // Fallback: 4 random segments (~52 bits each from Math.random) gives a
  // 32+ character unpredictable hex-like string.
  const segment = () => Math.random().toString(16).slice(2).padStart(13, "0");
  return `device-${segment()}${segment()}${segment()}`;
}

async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    // Existing (legacy) device ids are preserved; only freshly generated ids
    // use the stronger format.
    deviceId = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getLocalPortfolio(): Promise<PortfolioAsset[]> {
  try {
    const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load local portfolio:", e);
    return [];
  }
}

export async function saveLocalPortfolio(assets: PortfolioAsset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(assets));
  } catch (e) {
    console.error("Failed to save local portfolio:", e);
  }
}

export async function addAssetToPortfolio(asset: PortfolioAsset): Promise<void> {
  const portfolio = await getLocalPortfolio();
  portfolio.unshift(asset);
  await saveLocalPortfolio(portfolio);
  
  syncToCloud(asset).catch(console.error);
}

export async function removeAssetFromPortfolio(assetId: string): Promise<void> {
  const portfolio = await getLocalPortfolio();
  const updated = portfolio.filter(p => p.id !== assetId);
  await saveLocalPortfolio(updated);
  
  deleteFromCloud(assetId).catch(console.error);
}

async function syncToCloud(asset: PortfolioAsset): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = getApiUrl();
    const url = new URL(`/api/portfolio/${deviceId}`, apiUrl);

    const response = await fetchWithTimeout(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: asset.id,
        itemName: asset.itemName,
        category: asset.category,
        estimatedPrice: asset.estimatedPrice,
        currency: asset.currency,
        purchasePrice: asset.purchasePrice,
        trendPercentage: asset.trendPercentage,
        confidenceScore: asset.confidenceScore,
        investmentRating: asset.investmentRating,
        isAuthentic: asset.isAuthentic,
        history: asset.history,
        deals: asset.deals,
        imageBase64: asset.imageBase64,
        dateAdded: asset.dateAdded,
      }),
    }, CLOUD_TIMEOUT_MS);

    if (!response.ok) {
      console.error("Cloud sync failed:", await response.text());
    }
  } catch (e) {
    console.error("Cloud sync error:", e);
  }
}

async function deleteFromCloud(assetId: string): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = getApiUrl();
    const url = new URL(`/api/portfolio/${deviceId}/${assetId}`, apiUrl);

    await fetchWithTimeout(url.toString(), { method: "DELETE" }, CLOUD_TIMEOUT_MS);
  } catch (e) {
    console.error("Cloud delete error:", e);
  }
}

export async function fetchCloudPortfolio(): Promise<PortfolioAsset[]> {
  try {
    const deviceId = await getDeviceId();
    const apiUrl = getApiUrl();
    const url = new URL(`/api/portfolio/${deviceId}`, apiUrl);

    const response = await fetchWithTimeout(url.toString(), {}, CLOUD_TIMEOUT_MS);
    if (!response.ok) {
      console.error("Cloud fetch failed:", await response.text());
      return [];
    }

    const cloudAssets = await response.json();
    return cloudAssets.map((a: any) => ({
      ...a,
      dateAdded: a.dateAdded || new Date().toISOString(),
    }));
  } catch (e) {
    console.error("Cloud fetch error:", e);
    return [];
  }
}

export async function syncPortfolio(): Promise<PortfolioAsset[]> {
  const localAssets = await getLocalPortfolio();
  const cloudAssets = await fetchCloudPortfolio();

  const mergedMap = new Map<string, PortfolioAsset>();

  for (const asset of cloudAssets) {
    mergedMap.set(asset.id, asset);
  }

  for (const asset of localAssets) {
    const existing = mergedMap.get(asset.id);
    if (!existing) {
      mergedMap.set(asset.id, asset);
      syncToCloud(asset).catch(console.error);
    }
  }

  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
  );

  await saveLocalPortfolio(merged);

  return merged;
}
