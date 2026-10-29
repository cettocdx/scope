import React from "react";
import { StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { Colors, Radius, Spacing, trustColors } from "@/constants/theme";
import { Press, Txt } from "@/components/ui";
import { StoreAvatar } from "@/components/StoreAvatar";
import { formatMoney, useSettings } from "@/contexts/SettingsContext";
import { countryFlag, countryName, t, type StringKey } from "@/lib/i18n";
import type { Market, MarketSummary, Offer, TrustTier } from "@shared/scan";

export function openStore(url: string): void {
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: Colors.accent,
    toolbarColor: Colors.bg,
    dismissButtonStyle: "close",
  }).catch(() => {});
}

const TIER_LABEL: Record<TrustTier, StringKey> = {
  official: "Official store",
  major: "Major retailer",
  marketplace: "Marketplace",
  unknown: "Small shop",
};

export function TrustLabel({ offer }: { offer: Offer }) {
  const { fg } = trustColors(offer.trust.score);
  const label = offer.suspicious
    ? t("Suspiciously cheap")
    : t(TIER_LABEL[offer.trust.tier]);
  const icon = offer.suspicious
    ? "alert-triangle"
    : offer.trust.score >= 80
      ? "shield"
      : "info";
  return (
    <View style={styles.trust}>
      <Feather name={icon} size={11} color={fg} />
      <Txt variant="caption" color={fg} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Price in the user's currency, with the store's own price underneath when it differs. */
/** An offer's price in the user's currency — exact when the store already charges in it. */
export function usePrimaryPrice(): (offer: Offer) => string {
  const { currency, formatUSD } = useSettings();
  return (offer) =>
    offer.currency === currency
      ? formatMoney(offer.price, offer.currency)
      : formatUSD(offer.priceUSD);
}

export function PriceStack({
  offer,
  big,
  align = "right",
}: {
  offer: Offer;
  big?: boolean;
  align?: "left" | "right";
}) {
  const { currency } = useSettings();
  const primary = usePrimaryPrice();
  const same = offer.currency === currency;
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Txt
        variant={big ? "priceHero" : "price"}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {primary(offer)}
      </Txt>
      {!same ? (
        <Txt variant="priceSmall" color={Colors.textTertiary} numberOfLines={1}>
          {formatMoney(offer.price, offer.currency)}
        </Txt>
      ) : null}
    </View>
  );
}

export function OfferRow({
  offer,
  linkable,
}: {
  offer: Offer;
  linkable: boolean;
}) {
  const meta = [`${countryFlag(offer.country)} ${countryName(offer.country)}`];
  if (offer.delivery) meta.push(offer.delivery);
  return (
    <Press
      onPress={() => openStore(offer.url)}
      disabled={!linkable}
      scale={0.985}
      haptic
      accessibilityRole="link"
      accessibilityLabel={`${offer.store}, ${countryName(offer.country)}`}
      style={[styles.row, offer.suspicious && { opacity: 0.6 }]}
    >
      <StoreAvatar store={offer.store} domain={offer.domain} />
      <View style={styles.rowMiddle}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {offer.store}
        </Txt>
        <TrustLabel offer={offer} />
        <Txt variant="caption" color={Colors.textTertiary} numberOfLines={1}>
          {meta.join(" · ")}
        </Txt>
      </View>
      <PriceStack offer={offer} />
      {linkable ? (
        <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
      ) : null}
    </Press>
  );
}

/** The one big "buy here" card. */
export function RecommendedCard({
  offer,
  linkable,
}: {
  offer: Offer;
  linkable: boolean;
}) {
  return (
    <View style={styles.recommended}>
      <View style={styles.recommendedTop}>
        <View style={styles.badge}>
          <Feather name="award" size={12} color={Colors.textInverse} />
          <Txt variant="overline" color={Colors.textInverse}>
            {t("Recommended")}
          </Txt>
        </View>
        <Txt variant="caption" color={Colors.textTertiary}>
          {t("Best balance of price and trust")}
        </Txt>
      </View>

      <View style={styles.recommendedBody}>
        <StoreAvatar store={offer.store} domain={offer.domain} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="headline" numberOfLines={1}>
            {offer.store}
          </Txt>
          <TrustLabel offer={offer} />
          <Txt variant="caption" color={Colors.textTertiary} numberOfLines={1}>
            {countryFlag(offer.country)} {countryName(offer.country)}
            {offer.delivery ? ` · ${offer.delivery}` : ""}
          </Txt>
        </View>
      </View>

      <View style={styles.recommendedFoot}>
        <PriceStack offer={offer} big align="left" />
        {linkable ? (
          <Press
            onPress={() => openStore(offer.url)}
            haptic
            accessibilityRole="link"
            accessibilityLabel={`${t("Buy")} · ${offer.store}`}
            style={styles.buy}
          >
            <Txt variant="headline" color={Colors.textInverse}>
              {t("Buy")}
            </Txt>
            <Feather
              name="arrow-up-right"
              size={18}
              color={Colors.textInverse}
            />
          </Press>
        ) : null}
      </View>
    </View>
  );
}

/** Small side-by-side card for "cheapest" / "most trusted". */
export function PickTile({
  label,
  icon,
  offer,
  linkable,
}: {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  offer: Offer;
  linkable: boolean;
}) {
  return (
    <Press
      onPress={() => openStore(offer.url)}
      disabled={!linkable}
      haptic
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${offer.store}`}
      style={styles.tile}
    >
      <View style={styles.tileHead}>
        <Feather name={icon} size={13} color={Colors.textSecondary} />
        <Txt variant="overline" color={Colors.textSecondary}>
          {label}
        </Txt>
      </View>
      <PriceStack offer={offer} align="left" />
      <View style={styles.tileStore}>
        <StoreAvatar store={offer.store} domain={offer.domain} size={20} />
        <Txt variant="calloutStrong" numberOfLines={1} style={{ flex: 1 }}>
          {offer.store}
        </Txt>
      </View>
      <TrustLabel offer={offer} />
    </Press>
  );
}

/** Min — typical — max of the trustworthy new price. */
export function RangeBar({
  range,
  count,
}: {
  range: { min: number; median: number; max: number };
  count: number;
}) {
  const { formatUSD } = useSettings();
  const span = Math.max(1, range.max - range.min);
  const pos = Math.min(1, Math.max(0, (range.median - range.min) / span));
  return (
    <View style={styles.range}>
      <View style={styles.rangeHead}>
        <Txt variant="overline" color={Colors.textSecondary}>
          {t("Typical new price")}
        </Txt>
        <Txt variant="caption" color={Colors.textTertiary}>
          {t("from {n} stores", { n: count })}
        </Txt>
      </View>
      <Txt variant="title">{formatUSD(range.median)}</Txt>
      <View style={styles.track}>
        <View style={[styles.marker, { left: `${pos * 100}%` }]} />
      </View>
      <View style={styles.rangeEnds}>
        <Txt variant="priceSmall" color={Colors.textTertiary}>
          {formatUSD(range.min)}
        </Txt>
        <Txt variant="priceSmall" color={Colors.textTertiary}>
          {formatUSD(range.max)}
        </Txt>
      </View>
    </View>
  );
}

/** The price a market tab shows: its cheapest trustworthy offer. */
function lowestOf(m: MarketSummary): Offer | undefined {
  return m.offers.find((o) => !o.suspicious && o.trust.score >= 50);
}

export function MarketTabs({
  markets,
  selected,
  onSelect,
}: {
  markets: MarketSummary[];
  selected: Market;
  onSelect: (m: Market) => void;
}) {
  const primary = usePrimaryPrice();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {markets.map((m) => {
        const active = m.market === selected;
        return (
          <Press
            key={m.market}
            onPress={() => onSelect(m.market)}
            haptic
            scale={0.98}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(m.market)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Txt
              variant="calloutStrong"
              color={active ? Colors.textInverse : Colors.text}
            >
              {t(m.market)}
            </Txt>
            <Txt
              variant="priceSmall"
              color={active ? "rgba(10,10,11,0.6)" : Colors.textTertiary}
              numberOfLines={1}
            >
              {lowestOf(m) ? primary(lowestOf(m) as Offer) : "—"}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trust: { flexDirection: "row", alignItems: "center", gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rowMiddle: { flex: 1, gap: 2 },
  recommended: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xxl,
    borderWidth: 1,
    borderColor: "rgba(215,255,58,0.28)",
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  recommendedTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    height: 22,
    borderRadius: Radius.full,
  },
  recommendedBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  recommendedFoot: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  buy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accent,
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    flexShrink: 1,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileStore: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  range: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  rangeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceRaised,
    marginTop: Spacing.sm,
    justifyContent: "center",
  },
  marker: {
    position: "absolute",
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 3,
    borderColor: Colors.surface,
  },
  rangeEnds: { flexDirection: "row", justifyContent: "space-between" },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 1,
  },
  tabActive: { backgroundColor: Colors.text },
});
