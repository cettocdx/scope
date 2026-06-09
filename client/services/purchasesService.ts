import { Platform } from "react-native";

/**
 * RevenueCat (Pro subscription) wrapper.
 *
 * react-native-purchases is a native module: it is unavailable in Expo Go and
 * only links into a development / production build. Every call is therefore
 * guarded — in Expo Go these become no-ops and `isProActive()` returns false,
 * so the rest of the app degrades gracefully (free tier).
 *
 * The "pro" entitlement id and product offering are configured in the
 * RevenueCat dashboard + App Store Connect.
 */

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || "";
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || "";
const ENTITLEMENT_ID = "pro";

// Lazily resolved native module. Stays null in Expo Go.
type PurchasesModule = typeof import("react-native-purchases").default;
type PurchasesPackage = import("react-native-purchases").PurchasesPackage;

let Purchases: PurchasesModule | null = null;
let configured = false;

function load(): PurchasesModule | null {
  if (Purchases) return Purchases;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Purchases = require("react-native-purchases").default as PurchasesModule;
    return Purchases;
  } catch {
    return null;
  }
}

export function isPurchasesAvailable(): boolean {
  return load() !== null && (Platform.OS === "ios" || Platform.OS === "android");
}

/** Configure the SDK once. `appUserId` links purchases to a SCOPE account. */
export async function configurePurchases(appUserId?: string): Promise<void> {
  const P = load();
  if (!P) return;
  const apiKey = Platform.OS === "ios" ? IOS_KEY : ANDROID_KEY;
  if (!apiKey) return;
  try {
    if (!configured) {
      P.configure({ apiKey, appUserID: appUserId });
      configured = true;
    } else if (appUserId) {
      await P.logIn(appUserId);
    }
  } catch (e) {
    console.error("RevenueCat configure failed:", e);
  }
}

/** Link the current (anonymous) RevenueCat user to a SCOPE account id. */
export async function linkPurchasesUser(appUserId: string): Promise<void> {
  const P = load();
  if (!P || !configured) return;
  try {
    await P.logIn(appUserId);
  } catch (e) {
    console.error("RevenueCat logIn failed:", e);
  }
}

export async function logoutPurchases(): Promise<void> {
  const P = load();
  if (!P || !configured) return;
  try {
    await P.logOut();
  } catch {
    /* anonymous already */
  }
}

/** Whether the Pro entitlement is currently active. */
export async function isProActive(): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    const info = await P.getCustomerInfo();
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
  } catch {
    return false;
  }
}

/** The purchasable Pro packages from the current offering. */
export async function getProPackages(): Promise<PurchasesPackage[]> {
  const P = load();
  if (!P || !configured) return [];
  try {
    const offerings = await P.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (e) {
    console.error("RevenueCat getOfferings failed:", e);
    return [];
  }
}

/** Purchase a package; returns whether Pro is active afterwards. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  const { customerInfo } = await P.purchasePackage(pkg);
  return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
}

/** Restore prior purchases (App Store requirement); returns Pro status. */
export async function restorePurchases(): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    const info = await P.restorePurchases();
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
  } catch {
    return false;
  }
}
