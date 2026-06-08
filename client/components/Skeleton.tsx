import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";

import { BorderRadius, Colors } from "@/constants/theme";

/**
 * A soft pulsing placeholder block. AI-native loading: prefer skeletons over
 * blocking spinners so the layout is stable and the wait feels shorter.
 */
export function Skeleton({
  width,
  height,
  radius = BorderRadius.md,
  style,
}: {
  width?: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.block,
        { width: width as ViewStyle["width"], height, borderRadius: radius, opacity: pulse },
        style,
      ]}
    />
  );
}

/** A vault/list card skeleton row matching the real asset card geometry. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={80} height={80} radius={BorderRadius.md} />
      <View style={styles.cardBody}>
        <Skeleton width={"70%"} height={14} />
        <Skeleton width={"40%"} height={11} />
        <Skeleton width={"55%"} height={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: Colors.dark.cardBorderLight,
  },
  card: {
    flexDirection: "row",
    height: 88,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  cardBody: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
});
