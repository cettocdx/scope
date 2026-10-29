import React, { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import Svg, { Circle, Polyline } from "react-native-svg";
import { Icon, type IconName } from "@/components/Icon";
import * as WebBrowser from "expo-web-browser";

import { Colors, Radius, Spacing, trustColors } from "@/constants/theme";
import { notify, Press, select, tap, Txt } from "@/components/ui";
import { StoreAvatar } from "@/components/StoreAvatar";
import { formatMoney, useSettings } from "@/contexts/SettingsContext";
import { countryFlag, countryName, t, type StringKey } from "@/lib/i18n";
import { resolveOfferLink } from "@/services/scanService";
import type {
  Market,
  MarketSummary,
  Offer,
  TrustTier,
  VisualMatch,
} from "@shared/scan";

/** Opens an offer at the seller's own page when we can resolve it, else Google Shopping. */
function useOfferOpener(offer: Offer): {
  open: () => void;
  more: () => void;
  opening: boolean;
} {
  const [opening, setOpening] = useState(false);
  const link = useCallback(async () => {
    if (!offer.resolveToken) return offer.url;
    setOpening(true);
    try {
      return (
        (await resolveOfferLink(offer.resolveToken, offer.store)) ?? offer.url
      );
    } finally {
      setOpening(false);
    }
  }, [offer]);
  const open = useCallback(async () => {
    if (opening) return;
    openStore(await link());
  }, [link, opening]);
  // Long press: the same choices Safari gives a link.
  const more = useCallback(() => {
    tap("medium");
    const options = [t("Open"), t("Copy link"), t("Share"), t("Cancel")];
    const run = async (i: number) => {
      if (i === 0) return open();
      if (i === 1) {
        await Clipboard.setStringAsync(await link());
        notify();
        return;
      }
      if (i === 2) {
        const url = await link();
        Share.share(
          Platform.OS === "ios"
            ? { url, message: offer.title ?? undefined }
            : { message: `${offer.title}\n${url}` },
        ).catch(() => {});
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 3, title: offer.store },
        (i) => void run(i),
      );
    } else {
      Alert.alert(offer.store, undefined, [
        { text: options[0], onPress: () => void run(0) },
        { text: options[1], onPress: () => void run(1) },
        { text: options[2], onPress: () => void run(2) },
        { text: options[3], style: "cancel" },
      ]);
    }
  }, [link, offer, open]);
  return { open, more, opening };
}

export function openStore(url: string): void {
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: Colors.accent,
    toolbarColor: Colors.bg,
    dismissButtonStyle: "close",
  }).catch(() => {});
}

const LOCAL_PICK: Record<Market, StringKey> = {
  US: "Best price you can trust in the US",
  EU: "Best price you can trust in Europe",
  TR: "Best price you can trust in Türkiye",
};

/** Why we trust (or doubt) a seller, in the user's language. */
const TIER_REASON: Record<TrustTier, StringKey> = {
  official: "The brand's own store",
  major: "Big retailer with buyer protection",
  marketplace: "Marketplace: the seller varies",
  unknown: "Smaller shop: check its reviews",
};

export function trustReason(offer: Offer): string {
  const parts: string[] = [t(TIER_REASON[offer.trust.tier])];
  if (offer.rating && offer.reviews)
    parts.push(
      `${offer.rating.toFixed(1)}★ · ${t("{n} reviews", {
        n:
          offer.reviews >= 1000
            ? `${(offer.reviews / 1000).toFixed(1)}k`
            : offer.reviews,
      })}`,
    );
  return parts.join(" · ");
}

/** Buying from another market means shipping and, for Türkiye, customs. */
function useImportNote(offer: Offer): string | null {
  const { homeMarket } = useSettings();
  if (offer.market === homeMarket) return null;
  return homeMarket === "TR"
    ? t("From abroad: shipping and customs duty may be added")
    : t("From abroad: shipping and import fees may be added");
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
      <Icon name={icon} size={11} color={fg} />
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
  const { open, more, opening } = useOfferOpener(offer);
  const meta = [`${countryFlag(offer.country)} ${countryName(offer.country)}`];
  if (offer.rating) meta.push(`${offer.rating.toFixed(1)}★`);
  if (offer.delivery) meta.push(offer.delivery);
  return (
    <Press
      onPress={open}
      onLongPress={more}
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
        opening ? (
          <ActivityIndicator size="small" color={Colors.textTertiary} />
        ) : (
          <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
        )
      ) : null}
    </Press>
  );
}

/** The one big "buy here" card. */
export function RecommendedCard({
  offer,
  linkable,
  local,
}: {
  offer: Offer;
  linkable: boolean;
  /** Picked from the user's own market. */
  local?: boolean;
}) {
  const { open, more, opening } = useOfferOpener(offer);
  const importNote = useImportNote(offer);
  return (
    <View style={styles.recommended}>
      <View style={styles.recommendedTop}>
        <View style={styles.badge}>
          <Icon name="award" size={12} color={Colors.textInverse} />
          <Txt variant="overline" color={Colors.textInverse}>
            {t("Recommended")}
          </Txt>
        </View>
        <Txt variant="caption" color={Colors.textTertiary}>
          {local
            ? t(LOCAL_PICK[offer.market])
            : t("Best balance of price and trust")}
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
      <Txt variant="footnote" color={Colors.textSecondary}>
        {trustReason(offer)}
      </Txt>
      {importNote ? (
        <View style={styles.importNote}>
          <Icon name="globe" size={13} color={Colors.trustMid} />
          <Txt variant="footnote" color={Colors.trustMid} style={{ flex: 1 }}>
            {importNote}
          </Txt>
        </View>
      ) : null}

      <View style={styles.recommendedFoot}>
        <PriceStack offer={offer} big align="left" />
        {linkable ? (
          <Press
            onPress={open}
            onLongPress={more}
            haptic
            accessibilityRole="link"
            accessibilityLabel={`${t("Buy")} · ${offer.store}`}
            style={styles.buy}
          >
            <Txt variant="headline" color={Colors.textInverse}>
              {t("Buy")}
            </Txt>
            {opening ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Icon
                name="arrow-up-right"
                size={18}
                color={Colors.textInverse}
              />
            )}
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
  icon: IconName;
  offer: Offer;
  linkable: boolean;
}) {
  const { open, more } = useOfferOpener(offer);
  return (
    <Press
      onPress={open}
      onLongPress={linkable ? more : undefined}
      disabled={!linkable}
      haptic
      accessibilityRole="link"
      accessibilityLabel={`${label}: ${offer.store}`}
      style={styles.tile}
    >
      <View style={styles.tileHead}>
        <Icon name={icon} size={13} color={Colors.textSecondary} />
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
            onPress={() => {
              if (!active) select();
              onSelect(m.market);
            }}
            scale={0.98}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(m.market)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Txt variant="calloutStrong" color={Colors.text}>
              {t(m.market)}
            </Txt>
            <Txt
              variant="priceSmall"
              color={active ? Colors.textSecondary : Colors.textTertiary}
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

/** Shops showing the same-looking item, straight from the photo (Google Lens). */
export function VisualMatches({
  matches,
  linkable,
}: {
  matches: VisualMatch[];
  linkable: boolean;
}) {
  const { currency, formatUSD } = useSettings();
  return (
    <View style={styles.vmSection}>
      <View style={styles.vmHead}>
        <Txt variant="title">{t("Same item in shops")}</Txt>
        <Txt variant="caption" color={Colors.textTertiary}>
          {t("Matched by photo — check the model before buying.")}
        </Txt>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.vmRow}
      >
        {matches.map((m) => (
          <Press
            key={m.url}
            onPress={() => openStore(m.url)}
            disabled={!linkable}
            haptic
            scale={0.97}
            accessibilityRole="link"
            accessibilityLabel={`${m.store}: ${m.title}`}
            style={styles.vmCard}
          >
            <View style={styles.vmThumb}>
              {m.thumbnail ? (
                <Image
                  source={{ uri: m.thumbnail }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                />
              ) : (
                <Icon name="image" size={22} color={Colors.textInverse} />
              )}
            </View>
            <View style={styles.vmBody}>
              <Txt
                variant="caption"
                color={Colors.textSecondary}
                numberOfLines={1}
              >
                {m.store}
              </Txt>
              <Txt variant="calloutStrong" numberOfLines={2}>
                {m.title}
              </Txt>
              {m.price !== null && m.currency ? (
                <Txt variant="price" numberOfLines={1}>
                  {m.currency === currency || m.priceUSD === null
                    ? formatMoney(m.price, m.currency)
                    : formatUSD(m.priceUSD)}
                </Txt>
              ) : null}
            </View>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  vmSection: { gap: Spacing.md },
  vmHead: { gap: 2 },
  vmRow: { gap: Spacing.md, paddingRight: Spacing.gutter },
  vmCard: {
    width: 156,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  vmThumb: {
    width: 156,
    height: 140,
    backgroundColor: "#F5F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  vmBody: { padding: Spacing.md, gap: 3 },
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
    borderColor: "rgba(255,255,255,0.16)",
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
    paddingHorizontal: Spacing.sm + 2,
    height: 24,
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
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
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
  historyRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  importNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.trustMidTint,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
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
  tabActive: {
    backgroundColor: Colors.surfacePressed,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});

/** The recommended price at each check since the item was saved. */
export function PriceHistory({ history }: { history: number[] }) {
  const { formatUSD } = useSettings();
  if (history.length < 2) return null;
  const W = 300;
  const H = 64;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = Math.max(1, max - min);
  const points = history.map((v, i) => ({
    x: (i / (history.length - 1)) * W,
    y: 6 + (1 - (v - min) / span) * (H - 12),
  }));
  const first = history[0];
  const last = history[history.length - 1];
  const pct = ((last - first) / first) * 100;
  const down = pct < 0;
  const color =
    Math.abs(pct) < 0.5
      ? Colors.textSecondary
      : down
        ? Colors.trustHigh
        : Colors.trustLow;
  return (
    <View style={styles.range}>
      <View style={styles.rangeHead}>
        <Txt variant="overline" color={Colors.textSecondary}>
          {t("Price history")}
        </Txt>
        <Txt variant="caption" color={Colors.textTertiary}>
          {t("{n} checks", { n: history.length })}
        </Txt>
      </View>
      <View style={styles.historyRow}>
        <Txt variant="title">{formatUSD(last)}</Txt>
        <Txt variant="subheadStrong" color={color}>
          {`${pct > 0 ? "+" : ""}${pct.toFixed(1)}% ${t("since you saved it")}`}
        </Txt>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={4}
          fill={color}
        />
      </Svg>
    </View>
  );
}
