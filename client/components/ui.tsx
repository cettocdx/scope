import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Colors, Radius, Spacing, Type } from "@/constants/theme";

export type IconName = React.ComponentProps<typeof Feather>["name"];

export function tap(style: "light" | "medium" = "light"): void {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(
    style === "light"
      ? Haptics.ImpactFeedbackStyle.Light
      : Haptics.ImpactFeedbackStyle.Medium,
  ).catch(() => {});
}

type TypeName = keyof typeof Type;

export function Txt({
  variant = "body",
  color = Colors.text,
  style,
  ...rest
}: TextProps & { variant?: TypeName; color?: string }) {
  return <Text {...rest} style={[Type[variant], { color }, style]} />;
}

/** Pressable that dips slightly on touch — the app's single press feel. */
export function Press({
  style,
  scale = 0.97,
  haptic,
  onPress,
  ...rest
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scale?: number;
  haptic?: boolean;
}) {
  return (
    <Pressable
      {...rest}
      onPress={(e) => {
        if (haptic) tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        style,
        pressed && !rest.disabled
          ? { transform: [{ scale }], opacity: 0.9 }
          : null,
        rest.disabled ? { opacity: 0.45 } : null,
      ]}
    />
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 44,
  tone = "glass",
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  tone?: "glass" | "plain" | "surface";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        tone === "glass" && { backgroundColor: Colors.glass },
        tone === "surface" && { backgroundColor: Colors.surfaceRaised },
        style,
      ]}
    >
      <Feather name={icon} size={Math.round(size * 0.45)} color={Colors.text} />
    </Press>
  );
}

export function Button({
  title,
  onPress,
  icon,
  tone = "primary",
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  tone?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const fg = tone === "primary" ? Colors.textInverse : Colors.text;
  return (
    <Press
      onPress={onPress}
      haptic
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[
        styles.button,
        tone === "primary" && { backgroundColor: Colors.accent },
        tone === "secondary" && { backgroundColor: Colors.surfaceRaised },
        tone === "ghost" && { backgroundColor: "transparent" },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={18} color={fg} /> : null}
          <Txt variant="headline" color={fg} numberOfLines={1}>
            {title}
          </Txt>
        </>
      )}
    </Press>
  );
}

export function Chip({
  label,
  icon,
  color = Colors.textSecondary,
  bg = Colors.surfaceRaised,
  onPress,
}: {
  label: string;
  icon?: IconName;
  color?: string;
  bg?: string;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Feather name={icon} size={12} color={color} /> : null}
      <Txt variant="caption" color={color} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
  return onPress ? (
    <Press
      onPress={onPress}
      haptic
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {body}
    </Press>
  ) : (
    body
  );
}

/** Soft pulsing placeholder block. */
export function Skeleton({
  width,
  height,
  radius = Radius.sm,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
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
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: Colors.surfaceRaised,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.line,
        marginLeft: inset,
      }}
    />
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    height: 54,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    height: 24,
    borderRadius: Radius.full,
    alignSelf: "flex-start",
  },
});
