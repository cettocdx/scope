import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { deleteAssetImage, persistAssetImage } from "@/lib/image-store";
import type { PriceReport, ProductIdentity } from "@shared/scan";

/**
 * Every scan lands here on its own (like Photos' Recents), so nothing is lost
 * when the user forgets to tap Save. Kept on the device only, newest first.
 */

export interface HistoryEntry {
  id: string;
  date: string;
  identity: ProductIdentity;
  report?: PriceReport;
  imageUri?: string;
  thumbnailUri?: string;
}

const KEY = "scope.history.v1";
const LIMIT = 60;

let entries: HistoryEntry[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function persist(): void {
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
}

export async function loadHistory(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) entries = JSON.parse(raw) as HistoryEntry[];
  } catch {
    entries = [];
  }
  emit();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  if (!loaded) void loadHistory();
  return () => listeners.delete(l);
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}

export function historyEntry(id: string): HistoryEntry | undefined {
  return entries.find((e) => e.id === id);
}

/** Adds (or updates) a scan. The photo is stored as a small file, not base64. */
export async function recordHistory(args: {
  id: string;
  identity: ProductIdentity;
  report?: PriceReport | null;
  photoBase64?: string;
}): Promise<void> {
  const existing = entries.find((e) => e.id === args.id);
  let image: { imageUri?: string; thumbnailUri?: string } = {
    imageUri: existing?.imageUri,
    thumbnailUri: existing?.thumbnailUri,
  };
  if (!existing && args.photoBase64) {
    image =
      (await persistAssetImage(
        `data:image/jpeg;base64,${args.photoBase64}`,
        `history-${args.id}`,
      )) ?? {};
  }
  const next: HistoryEntry = {
    id: args.id,
    date: existing?.date ?? new Date().toISOString(),
    identity: args.identity,
    report: args.report ?? existing?.report,
    ...image,
  };
  const rest = entries.filter((e) => e.id !== args.id);
  const dropped = rest.slice(LIMIT - 1);
  entries = [next, ...rest.slice(0, LIMIT - 1)];
  for (const d of dropped) void deleteAssetImage(d);
  persist();
  emit();
}

export function removeHistory(id: string): void {
  const gone = entries.find((e) => e.id === id);
  entries = entries.filter((e) => e.id !== id);
  if (gone) void deleteAssetImage(gone);
  persist();
  emit();
}

export function clearHistory(): void {
  for (const e of entries) void deleteAssetImage(e);
  entries = [];
  persist();
  emit();
}
