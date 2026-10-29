import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Colors, Fonts, Spacing } from "@/constants/theme";
import { Button, Press, Txt } from "@/components/ui";
import { t } from "@/lib/i18n";

const HERO = require("../../assets/images/welcome-hero.jpg");
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * The first thing a new user sees: a studio still life of everyday things
 * (made with Higgsfield) that a white scan line keeps sweeping across, then the
 * one-sentence promise.
 */
export function Welcome({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const heroH = Math.round(height * 0.66);

  const settle = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    settle.value = withTiming(1, { duration: 2600, easing: ease });
    sweep.value = withDelay(
      900,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1400 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
  }, [settle, sweep]);

  const heroStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ scale: 1.1 - settle.value * 0.1 }],
  }));

  const lineStyle = useAnimatedStyle(() => {
    const p = sweep.value;
    return {
      opacity: p <= 0 || p >= 1 ? 0 : Math.min(1, p * 6, (1 - p) * 6),
      transform: [{ translateY: insets.top + 40 + p * (heroH * 0.62) }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.hero,
          { top: insets.top - 8, height: heroH - insets.top + 8 },
          heroStyle,
        ]}
      >
        <Image
          source={HERO}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
        />
      </Animated.View>
      <Animated.View style={[styles.line, lineStyle]} pointerEvents="none">
        <LinearGradient
          colors={["transparent", Colors.accent, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)", Colors.bg]}
        locations={[0, 0.55, 1]}
        style={[styles.fade, { top: heroH * 0.5, height: heroH * 0.5 + 2 }]}
        pointerEvents="none"
      />

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Animated.View entering={FadeIn.duration(800).delay(350)}>
          <Txt style={styles.wordmark}>SCOPE</Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(700).delay(500)}>
          <Txt style={styles.title} accessibilityRole="header">
            {t("Snap anything.\nPay the best price.")}
          </Txt>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(700).delay(650)}>
          <Txt variant="body" color={Colors.textSecondary} style={styles.body}>
            {t(
              "SCOPE knows what it is in seconds and shows the cheapest and most trusted shops in the US, Europe and Türkiye.",
            )}
          </Txt>
        </Animated.View>
        <Animated.View
          entering={FadeInDown.duration(700).delay(800)}
          style={styles.actions}
        >
          <Button title={t("Get started")} onPress={onStart} />
          <Press
            onPress={onSkip}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.skip}
          >
            <Txt variant="subhead" color={Colors.textSecondary}>
              {t("Skip the tour")}
            </Txt>
          </Press>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  hero: { position: "absolute", left: 0, right: 0 },
  line: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    shadowColor: Colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  fade: { position: "absolute", left: 0, right: 0 },
  wordmark: {
    ...Fonts.extrabold,
    fontSize: 13,
    letterSpacing: 4,
    color: Colors.accent,
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  title: {
    ...Fonts.bold,
    fontSize: 38,
    lineHeight: 43,
    color: Colors.text,
  },
  body: { marginBottom: Spacing.md },
  actions: { gap: Spacing.sm },
  skip: { alignSelf: "center", paddingVertical: Spacing.sm },
});
