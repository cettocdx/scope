import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

export const VALUE_CARD_WIDTH = 340;
export const VALUE_CARD_HEIGHT = 440;

/**
 * The shareable "Value Card" — a clean, watermarked snapshot of a scan's real
 * price, designed to be captured to an image and shared. No fabricated trend %:
 * it shows only the verified median and how many live prices back it, so it
 * reads as trustworthy proof, not hype.
 */
export function ValueCard({
  itemName,
  price,
  category,
  sourceCount,
}: {
  itemName: string;
  price: number;
  category: string;
  sourceCount: number;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.glow} />

      <View style={styles.top}>
        <Text style={styles.wordmark}>SCOPE</Text>
        <View style={styles.categoryChip}>
          <Text style={styles.categoryText}>{category.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.middle}>
        <Text style={styles.label}>REAL PRICE</Text>
        <Text style={styles.price}>${price.toLocaleString("en-US")}</Text>
        <Text style={styles.item} numberOfLines={2}>
          {itemName}
        </Text>
        {sourceCount > 0 && (
          <Text style={styles.sources}>
            Median of {sourceCount} live retail price{sourceCount === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      <View style={styles.bottom}>
        <Text style={styles.tagline}>Know the real price of anything.</Text>
        <Text style={styles.watermark}>scan with SCOPE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: VALUE_CARD_WIDTH,
    height: VALUE_CARD_HEIGHT,
    backgroundColor: "#02040A",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.dark.accentBorder,
    padding: 28,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -120,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: Colors.dark.accent,
    opacity: 0.16,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 6,
    color: Colors.dark.text,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.dark.accentTint,
    borderWidth: 1,
    borderColor: Colors.dark.accentBorder,
  },
  categoryText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.dark.accentIce,
    fontWeight: "700",
  },
  middle: {
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    letterSpacing: 4,
    color: Colors.dark.textTertiary,
    marginBottom: 8,
  },
  price: {
    fontSize: 56,
    fontWeight: "800",
    letterSpacing: -1,
    color: Colors.dark.text,
  },
  item: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  sources: {
    marginTop: 10,
    fontSize: 12,
    color: Colors.dark.accentIce,
  },
  bottom: {
    alignItems: "center",
  },
  tagline: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  watermark: {
    marginTop: 6,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.dark.textTertiary,
    fontWeight: "700",
  },
});
