import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { PortfolioAsset } from "@/types";

const PORTFOLIO_STORAGE_KEY = "scope_portfolio_v1";
const DEVICE_ID_KEY = "scope_device_id";
const SYNC_QUEUE_KEY = "scope_sync_queue_v1";

// Cloud sync is best-effort; bound each request so a stalled network never
// leaves a fire-and-forget promise hanging forever.
const CLOUD_TIMEOUT_MS = 10_000;

/**
 * A cloud operation that has not yet been confirmed by the server. Persisted in
 * AsyncStorage so a write made offline (or during a flaky request) is retried
 * on the next sync instead of being silently lost.
 */
type PendingOp =
  | { kind: "upsert"; asset: PortfolioAsset }
  | { kind: "delete"; assetId: string };

function opId(op: PendingOp): string {
  return op.kind === "upsert" ? op.asset.id : op.assetId;
}

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

// ---------------------------------------------------------------------------
// Local store
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Offline retry queue
// ---------------------------------------------------------------------------

async function getQueue(): Promise<PendingOp[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read sync queue:", e);
    return [];
  }
}

async function setQueue(ops: PendingOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(ops));
  } catch (e) {
    console.error("Failed to write sync queue:", e);
  }
}

/**
 * Append an operation, collapsing any earlier pending op for the same asset so
 * the queue never holds contradictory or redundant work (e.g. an upsert
 * followed by a delete for the same id leaves only the delete).
 */
async function enqueue(op: PendingOp): Promise<void> {
  const queue = await getQueue();
  const id = opId(op);
  const next = queue.filter((o) => opId(o) !== id);
  next.push(op);
  await setQueue(next);
}

// A single in-flight flush; concurrent callers (mount + focus) await the same
// run instead of double-processing the queue.
let flushing: Promise<void> | null = null;

async function flushQueue(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    const remaining: PendingOp[] = [];
    for (const op of queue) {
      const ok =
        op.kind === "upsert"
          ? await pushUpsert(op.asset)
          : await pushDelete(op.assetId);
      if (!ok) remaining.push(op);
    }
    await setQueue(remaining);
  })();

  try {
    await flushing;
  } finally {
    flushing = null;
  }
}

/** Asset ids with a delete still pending (hidden from the merged view). */
async function pendingDeleteIds(): Promise<Set<string>> {
  const queue = await getQueue();
  return new Set(queue.filter((o) => o.kind === "delete").map((o) => o.assetId));
}

/** Local-only adds not yet confirmed by the server (protected during merge). */
async function pendingUpserts(): Promise<PortfolioAsset[]> {
  const queue = await getQueue();
  return queue.flatMap((o) => (o.kind === "upsert" ? [o.asset] : []));
}

// ---------------------------------------------------------------------------
// Cloud transport — each returns whether the server accepted the op.
// ---------------------------------------------------------------------------

async function pushUpsert(asset: PortfolioAsset): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const url = new URL(`/api/portfolio/${deviceId}`, getApiUrl());

    const response = await fetchWithTimeout(
      url.toString(),
      {
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
      },
      CLOUD_TIMEOUT_MS,
    );

    if (!response.ok) {
      // 4xx is a permanent rejection (bad payload) — drop it so it does not
      // wedge the queue forever. 5xx is transient and worth retrying.
      if (response.status >= 400 && response.status < 500) {
        console.error("Cloud upsert rejected:", await response.text());
        return true;
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("Cloud upsert error (will retry):", e);
    return false;
  }
}

async function pushDelete(assetId: string): Promise<boolean> {
  try {
    const deviceId = await getDeviceId();
    const url = new URL(`/api/portfolio/${deviceId}/${assetId}`, getApiUrl());

    const response = await fetchWithTimeout(
      url.toString(),
      { method: "DELETE" },
      CLOUD_TIMEOUT_MS,
    );
    // Any HTTP response means the server received the delete; a 404 just means
    // it was already gone. Only a network failure is worth retrying.
    if (!response.ok && response.status >= 500) return false;
    return true;
  } catch (e) {
    console.error("Cloud delete error (will retry):", e);
    return false;
  }
}

async function fetchCloudPortfolio(): Promise<PortfolioAsset[] | null> {
  try {
    const deviceId = await getDeviceId();
    const url = new URL(`/api/portfolio/${deviceId}`, getApiUrl());

    const response = await fetchWithTimeout(url.toString(), {}, CLOUD_TIMEOUT_MS);
    if (!response.ok) {
      console.error("Cloud fetch failed:", await response.text());
      return null;
    }

    const cloudAssets: PortfolioAsset[] = await response.json();
    return cloudAssets.map((a) => ({
      ...a,
      dateAdded: a.dateAdded || new Date().toISOString(),
    }));
  } catch (e) {
    console.error("Cloud fetch error:", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public mutations — update local immediately, then sync (queue on failure).
// ---------------------------------------------------------------------------

export async function addAssetToPortfolio(asset: PortfolioAsset): Promise<void> {
  const portfolio = await getLocalPortfolio();
  await saveLocalPortfolio([asset, ...portfolio.filter((a) => a.id !== asset.id)]);

  await enqueue({ kind: "upsert", asset });
  await flushQueue();
}

export async function removeAssetFromPortfolio(assetId: string): Promise<void> {
  const portfolio = await getLocalPortfolio();
  await saveLocalPortfolio(portfolio.filter((a) => a.id !== assetId));

  await enqueue({ kind: "delete", assetId });
  await flushQueue();
}

// ---------------------------------------------------------------------------
// Sync — reconcile local with cloud. Cloud is authoritative for cross-device
// deletes, but never wipes local when the network is unreachable.
// ---------------------------------------------------------------------------

export async function syncPortfolio(): Promise<PortfolioAsset[]> {
  await flushQueue();

  const local = await getLocalPortfolio();
  const cloud = await fetchCloudPortfolio();
  const deletes = await pendingDeleteIds();

  if (cloud === null) {
    // Offline: keep showing local, minus anything queued for deletion.
    return local.filter((a) => !deletes.has(a.id));
  }

  // Cloud is the source of truth, plus local adds we have not pushed yet.
  const byId = new Map<string, PortfolioAsset>();
  for (const a of cloud) byId.set(a.id, a);
  for (const a of await pendingUpserts()) byId.set(a.id, a);
  for (const id of deletes) byId.delete(id);

  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
  );

  await saveLocalPortfolio(merged);
  return merged;
}
