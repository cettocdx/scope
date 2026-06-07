import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { Colors, Spacing } from "@/constants/theme";

/**
 * A small green/red pill showing a signed percentage trend. Extracted so the
 * Vault, Result and Analytics screens share one source of truth instead of each
 * re-implementing the same colored badge.
 */
export function TrendPill({
  value,
  suffix = "%",
  style,
}: {
  value: number;
  suffix?: string;
  style?: ViewStyle;
}) {
  const up = value >= 0;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: up ? Colors.dark.successTint : Colors.dark.alertTint },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: up ? Colors.dark.successGreen : Colors.dark.alertRed },
        ]}
      >
        {value > 0 ? "+" : ""}
        {value}
        {suffix}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.xs,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
  },
});
