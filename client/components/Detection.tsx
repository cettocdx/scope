import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors, Spacing } from "@/constants/theme";
import { Glass, Txt } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { DetectedObject } from "../../modules/scope-camera";

const SPRING = { damping: 18, stiffness: 180, mass: 0.6 };
const PAD = 10;

/**
 * Brackets that glide onto what the camera sees. The main object gets bold
 * corners and a label; the others get thin ones and can be tapped to scan
 * just that thing.
 */
function Brackets({
  box,
  primary,
  stable,
  onPress,
}: {
  box: DetectedObject;
  primary: boolean;
  stable: boolean;
  onPress: () => void;
}) {
  const x = useSharedValue(box.x - PAD);
  const y = useSharedValue(box.y - PAD);
  const w = useSharedValue(box.width + PAD * 2);
  const h = useSharedValue(box.height + PAD * 2);
  const lock = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(box.x - PAD, SPRING);
    y.value = withSpring(box.y - PAD, SPRING);
    w.value = withSpring(box.width + PAD * 2, SPRING);
    h.value = withSpring(box.height + PAD * 2, SPRING);
  }, [box.x, box.y, box.width, box.height, x, y, w, h]);

  useEffect(() => {
    lock.value = withTiming(stable ? 1 : 0, { duration: 200 });
  }, [lock, stable]);

  const frame = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: w.value,
    height: h.value,
    transform: [{ scale: 1 - lock.value * 0.03 }],
  }));

  const size = primary ? 28 : 18;
  const width = primary ? 4 : 2;
  const color = primary ? Colors.text : "rgba(255,255,255,0.7)";
  const corner = { width: size, height: size, borderColor: color };
  return (
    <Animated.View style={[styles.box, frame]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("Scan this object")}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          corner,
          {
            top: 0,
            left: 0,
            borderTopWidth: width,
            borderLeftWidth: width,
            borderTopLeftRadius: 14,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          corner,
          {
            top: 0,
            right: 0,
            borderTopWidth: width,
            borderRightWidth: width,
            borderTopRightRadius: 14,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          corner,
          {
            bottom: 0,
            left: 0,
            borderBottomWidth: width,
            borderLeftWidth: width,
            borderBottomLeftRadius: 14,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.corner,
          corner,
          {
            bottom: 0,
            right: 0,
            borderBottomWidth: width,
            borderRightWidth: width,
            borderBottomRightRadius: 14,
          },
        ]}
      />
    </Animated.View>
  );
}

export function DetectionOverlay({
  objects,
  stable,
  autoCapture,
  onPick,
}: {
  objects: DetectedObject[];
  stable: boolean;
  autoCapture: boolean;
  onPick: (o: DetectedObject) => void;
}) {
  const primary = objects.find((o) => o.primary);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {objects.map((o, i) => (
        <Brackets
          // Keep the main bracket mounted so it glides between objects.
          key={o.primary ? "primary" : `other-${i}`}
          box={o}
          primary={o.primary}
          stable={o.primary && stable}
          onPress={() => onPick(o)}
        />
      ))}
      {primary ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          pointerEvents="none"
          style={[
            styles.label,
            {
              left: Math.max(Spacing.lg, primary.x - PAD),
              top: Math.max(8, primary.y - PAD - 38),
            },
          ]}
        >
          <Glass style={styles.labelInner}>
            <View
              style={[
                styles.dot,
                { backgroundColor: stable ? Colors.trustHigh : Colors.text },
              ]}
            />
            <Txt variant="caption" color={Colors.text}>
              {stable
                ? autoCapture
                  ? t("Detected · capturing")
                  : t("Detected")
                : t("Hold steady…")}
            </Txt>
          </Glass>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute" },
  corner: { position: "absolute" },
  label: { position: "absolute" },
  labelInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: Spacing.md,
    borderRadius: 14,
    overflow: "hidden",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
