import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

import { getApiUrl } from "@/lib/query-client";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { LOCALE } from "@/lib/i18n";
import type { Market } from "@shared/scan";

export const DISPLAY_CURRENCIES = ["USD", "EUR", "TRY", "GBP"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

const CURRENCY_KEY = "scope_display_currency_v1";

/** Same fallback table the server starts from; replaced by live rates on launch. */
const FALLBACK_USD_PER_UNIT: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  TRY: 0.029,
};

const EU_REGIONS = new Set([
  "AT",
  "BE",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
]);

function defaultCurrency(): DisplayCurrency {
  try {
    const locale = getLocales()[0];
    const region = locale?.regionCode?.toUpperCase() ?? "";
    if (locale?.languageCode === "tr" || region === "TR") return "TRY";
    if (region === "GB") return "GBP";
    if (EU_REGIONS.has(region)) return "EUR";
  } catch {
    // fall through
  }
  return "USD";
}

/** The market a user buys in: Türkiye, Europe (EU + UK) or the US. */
function deviceMarket(): Market {
  try {
    const locale = getLocales()[0];
    const region = locale?.regionCode?.toUpperCase() ?? "";
    if (region === "TR" || (!region && locale?.languageCode === "tr"))
      return "TR";
    if (region === "GB" || EU_REGIONS.has(region)) return "EU";
  } catch {
    // fall through
  }
  return "US";
}

const HOME_MARKET: Market = deviceMarket();

interface SettingsValue {
  /** Where the user buys; its offers are recommended first. */
  homeMarket: Market;
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  /** Convert a USD amount to the display currency. */
  fromUSD: (usd: number) => number;
  /** Format a USD amount in the display currency. */
  formatUSD: (usd: number) => string;
}

const SettingsContext = createContext<SettingsValue | undefined>(undefined);

export function formatMoney(amount: number, currency: string): string {
  const digits =
    amount >= 1000 || currency === "TRY" ? 0 : amount % 1 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString(LOCALE)} ${currency}`;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] =
    useState<DisplayCurrency>(defaultCurrency);
  const [rates, setRates] = useState(FALLBACK_USD_PER_UNIT);

  useEffect(() => {
    AsyncStorage.getItem(CURRENCY_KEY)
      .then((v) => {
        if (v && (DISPLAY_CURRENCIES as readonly string[]).includes(v)) {
          setCurrencyState(v as DisplayCurrency);
        }
      })
      .catch(() => {});

    fetchWithTimeout(new URL("/api/rates", getApiUrl()).toString(), {}, 6000)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { usdPerUnit?: Record<string, number> } | null) => {
        if (j?.usdPerUnit) setRates((prev) => ({ ...prev, ...j.usdPerUnit }));
      })
      .catch(() => {});
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    AsyncStorage.setItem(CURRENCY_KEY, c).catch(() => {});
  }, []);

  const value = useMemo<SettingsValue>(() => {
    const perUnit = rates[currency] || 1;
    const fromUSD = (usd: number) => usd / perUnit;
    return {
      homeMarket: HOME_MARKET,
      currency,
      setCurrency,
      fromUSD,
      formatUSD: (usd: number) => formatMoney(fromUSD(usd), currency),
    };
  }, [currency, rates, setCurrency]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
