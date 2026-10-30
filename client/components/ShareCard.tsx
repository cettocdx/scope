import React, { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import { Txt } from "@/components/ui";
import { countryFlag, countryName, t } from "@/lib/i18n";
import type { Offer } from "@shared/scan";

/**
 * The image "Share" sends: the photo, the product and its recommended buy.
 * Rendered off screen at a fixed size and captured with react-native-view-shot.
 */
export const ShareCard = forwardRef<
  View,
  {
    title: string;
    subtitle?: string;
    imageUri?: string;
    best?: Offer | null;
    price?: string;
  }
>(function ShareCard({ title, subtitle, imageUri, best, price }, ref) {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      <View style={styles.photo}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.body}>
        <Txt style={styles.title} numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="subhead" color={Colors.textSecondary} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
        {best && price ? (
          <View style={styles.best}>
            <View style={{ flex: 1 }}>
              <Txt variant="overline" color={Colors.textSecondary}>
                {t("Recommended")}
              </Txt>
              <Txt variant="headline" numberOfLines={1}>
                {best.store}
              </Txt>
              <Txt variant="footnote" color={Colors.textTertiary}>
                {countryFlag(best.country)} {countryName(best.country)}
              </Txt>
            </View>
            <Txt style={styles.price}>{price}</Txt>
          </View>
        ) : null}
        <View style={styles.foot}>
          <Txt style={styles.wordmark}>SCOPE</Txt>
          <Txt variant="footnote" color={Colors.textTertiary}>
            {t("Snap anything. Pay the best price.")}
          </Txt>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 360,
    backgroundColor: Colors.bg,
    borderRadius: Radius.xxl,
    overflow: "hidden",
  },
  photo: { width: 360, height: 300, backgroundColor: Colors.surface },
  body: { padding: Spacing.xl, gap: Spacing.sm, marginTop: -56 },
  title: { ...Fonts.bold, fontSize: 26, lineHeight: 31, color: Colors.text },
  best: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  price: { ...Fonts.bold, fontSize: 28, color: Colors.text },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  wordmark: {
    ...Fonts.extrabold,
    fontSize: 13,
    letterSpacing: 4,
    color: Colors.text,
  },
});
