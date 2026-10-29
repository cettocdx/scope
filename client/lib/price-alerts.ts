import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import {
  addAssetToPortfolio,
  getLocalPortfolio,
} from "@/services/portfolioService";
import {
  fetchPrices,
  identityFromName,
  pricesRequestFor,
  titleFor,
} from "@/services/scanService";
import { savedItemFrom } from "@/lib/saved";
import { t } from "@/lib/i18n";
import { HOME_MARKET } from "@/contexts/SettingsContext";
import type { SavedItem } from "@/types";

/**
 * Price alerts. Saved items are re-priced every ~12 hours (iOS decides the
 * exact moment for background work; opening the app also triggers a check),
 * and a local notification fires when the recommended price drops by 3% or
 * more. No push server or Apple push keys involved: it all runs on the phone.
 */

export const PRICE_TASK = "scope-price-check";
const ENABLED_KEY = "scope.alerts.enabled";
const LAST_RUN_KEY = "scope.alerts.lastRun";
const MIN_DROP = 0.03;
const EVERY_MS = 12 * 60 * 60 * 1000;
const MAX_ITEMS = 12;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function alertsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(ENABLED_KEY)) !== "off";
}

export async function setAlertsEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? "on" : "off");
  if (on) await registerPriceTask();
  else await BackgroundTask.unregisterTaskAsync(PRICE_TASK).catch(() => {});
}

/** Ask once, right after the first save — when the value is obvious. */
export async function askForAlertPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return next.granted;
}

export interface PriceDrop {
  item: SavedItem;
  from: number;
  to: number;
}

/** Re-price saved items; returns the ones that got meaningfully cheaper. */
export async function checkSavedPrices(): Promise<PriceDrop[]> {
  const items = (await getLocalPortfolio()).slice(0, MAX_ITEMS);
  const home = HOME_MARKET;
  const drops: PriceDrop[] = [];
  for (const item of items) {
    const identity = item.identity ?? identityFromName(item.itemName);
    if (identity.regulated) continue;
    try {
      const report = await fetchPrices(pricesRequestFor(identity, home));
      const next = savedItemFrom({
        id: item.id,
        identity,
        report,
        dateAdded: item.dateAdded,
        image: { imageUri: item.imageUri, thumbnailUri: item.thumbnailUri },
        previous: item,
      });
      const before = item.estimatedPrice;
      const now = next.estimatedPrice;
      if (before > 0 && now > 0 && now <= before * (1 - MIN_DROP))
        drops.push({ item: next, from: before, to: now });
      await addAssetToPortfolio(next);
    } catch {
      // Offline or one item failing: try again next time.
    }
  }
  await AsyncStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  return drops;
}

async function notifyDrops(drops: PriceDrop[]): Promise<void> {
  for (const d of drops.slice(0, 3)) {
    const pct = Math.round(((d.from - d.to) / d.from) * 100);
    const name = d.item.identity ? titleFor(d.item.identity) : d.item.itemName;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t("Price dropped"),
        body: t("{name} is {n}% cheaper than when you saved it.", {
          name,
          n: pct,
        }),
        data: { savedId: d.item.id },
      },
      trigger: null,
    });
  }
}

/** One full run: re-price, then notify. Safe to call any time. */
export async function runPriceCheck(): Promise<number> {
  if (!(await alertsEnabled())) return 0;
  const drops = await checkSavedPrices();
  const perm = await Notifications.getPermissionsAsync();
  if (perm.granted && drops.length) await notifyDrops(drops);
  return drops.length;
}

/** Called when the app comes to the foreground: runs if the last check is old. */
export async function runPriceCheckIfDue(): Promise<void> {
  const last = Number((await AsyncStorage.getItem(LAST_RUN_KEY)) ?? 0);
  if (Date.now() - last < EVERY_MS) return;
  await runPriceCheck().catch(() => {});
}

TaskManager.defineTask(PRICE_TASK, async () => {
  try {
    await runPriceCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerPriceTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(PRICE_TASK)) return;
    await BackgroundTask.registerTaskAsync(PRICE_TASK, {
      minimumInterval: 12 * 60,
    });
  } catch {
    // Expo Go and simulators may not support background tasks.
  }
}
