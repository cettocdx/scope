import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Icon } from "@/components/Icon";
import { Divider, Press, Txt } from "@/components/ui";
import { OfferRow } from "@/components/offers";
import { useSettings } from "@/contexts/SettingsContext";
import { LOCALE, t } from "@/lib/i18n";
import { nextSale } from "@/lib/sale-calendar";
import { fetchAlternatives } from "@/services/scanService";
import type { Alternative } from "@shared/scan";

/** "Same job, less money": loads on tap (it runs a few live searches). */
export function Alternatives({
  name,
  category,
  priceUSD,
  linkable,
}: {
  name: string;
  category: string;
  priceUSD: number | null;
  linkable: boolean;
}) {
  const { homeMarket } = useSettings();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [items, setItems] = useState<Alternative[]>([]);

  const load = async () => {
    setState("loading");
    try {
      const res = await fetchAlternatives({
        name,
        category,
        priceUSD,
        homeMarket,
      });
      setItems(res.alternatives);
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "idle" || state === "error")
    return (
      <Press
        onPress={load}
        haptic
        scale={0.98}
        accessibilityRole="button"
        style={styles.cta}
      >
        <Icon name="trending-down" size={18} color={Colors.text} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{t("Cheaper alternatives")}</Txt>
          <Txt variant="footnote" color={Colors.textTertiary}>
            {state === "error"
              ? t("Couldn't load. Tap to try again.")
              : t("Same job for less money, priced live")}
          </Txt>
        </View>
        <Icon name="chevron-right" size={18} color={Colors.textTertiary} />
      </Press>
    );

  if (state === "loading")
    return (
      <View style={[styles.cta, { justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.textSecondary} />
        <Txt variant="subhead" color={Colors.textSecondary}>
          {t("Looking for cheaper options…")}
        </Txt>
      </View>
    );

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.section}>
      <Txt variant="title">{t("Cheaper alternatives")}</Txt>
      {items.length === 0 ? (
        <Txt variant="subhead" color={Colors.textSecondary}>
          {t("Nothing clearly cheaper that does the same job right now.")}
        </Txt>
      ) : (
        <View style={styles.list}>
          {items.map((a, i) => (
            <View key={a.name}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.altHead}>
                <Txt variant="bodyStrong">{a.name}</Txt>
                {a.why ? (
                  <Txt variant="footnote" color={Colors.textSecondary}>
                    {a.why}
                  </Txt>
                ) : null}
              </View>
              {a.offer ? (
                <OfferRow offer={a.offer} linkable={linkable} />
              ) : null}
            </View>
          ))}
        </View>
      )}
      <Txt variant="caption" color={Colors.textTertiary}>
        {t("Suggested by AI, priced live. Compare features before buying.")}
      </Txt>
    </Animated.View>
  );
}

/** The next big sale for this kind of product. */
export function SaleTiming({ category }: { category: string }) {
  const { homeMarket } = useSettings();
  const sale = nextSale(category, homeMarket);
  if (!sale) return null;
  const date = sale.start.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
  });
  const when =
    sale.days === 0
      ? t("today")
      : sale.days === 1
        ? t("tomorrow")
        : t("in {n} days", { n: sale.days });
  return (
    <View style={styles.sale}>
      <Icon name="tag" size={18} color={Colors.trustMid} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="overline" color={Colors.textSecondary}>
          {t("Best time to buy")}
        </Txt>
        <Txt variant="bodyStrong">
          {t(sale.name)} · {sale.approximate ? "~" : ""}
          {date} ({when})
        </Txt>
        <Txt variant="footnote" color={Colors.textTertiary}>
          {sale.days <= 30
            ? t(
                "Prices in this category often drop then. If you can wait, it may pay off.",
              )
            : t(
                "A usual sale period for this category. Each shop decides its own discounts.",
              )}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  altHead: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: 2,
  },
  sale: {
    flexDirection: "row",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
});
