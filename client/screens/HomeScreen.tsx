import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Fonts } from "@/constants/theme";
import { LogoMark } from "@/components/Logo";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { usePortfolio } from "@/hooks/usePortfolio";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { assets } = usePortfolio();
  const assetCount = assets.length;
  const pulseAnim = useState(new Animated.Value(1))[0];
  const glowAnim = useState(new Animated.Value(0.16))[0];

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.28, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.16, duration: 1800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    glow.start();
    return () => {
      pulse.stop();
      glow.stop();
    };
  }, [pulseAnim, glowAnim]);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
    >
      {/* top status row */}
      <View style={styles.sysRow}>
        <View style={styles.sys}>
          <View style={styles.sysDot} />
          <Text style={styles.sysText}>SYSTEM ONLINE</Text>
        </View>
        <Text style={styles.ver}>v1.0.4</Text>
      </View>

      {/* hero */}
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          <Animated.View
            style={[styles.logoGlow, { opacity: glowAnim, transform: [{ scale: pulseAnim }] }]}
          />
          <LogoMark size={84} />
        </View>

        <Text style={styles.wordmark}>SCOPE</Text>
        <Text style={styles.kicker}>ASSET INTELLIGENCE</Text>
        <Text style={styles.caps}>SCAN   ·   IDENTIFY   ·   VALUE</Text>
      </View>

      {/* footer / CTA */}
      <View style={styles.foot}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate("Scanner")}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Start scanning. Point camera at any object"
        >
          <View style={styles.ctaGlow} />
          <View style={styles.ctaLeft}>
            <View style={styles.ctaIcon}>
              <Feather name="crosshair" size={22} color="#021006" />
            </View>
            <View>
              <Text style={styles.ctaTitle}>START SCANNING</Text>
              <Text style={styles.ctaSub}>Point camera at any object</Text>
            </View>
          </View>
          <View style={styles.ctaArrow}>
            <Feather name="arrow-right" size={20} color="#021006" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vault}
          onPress={() => navigation.navigate("Vault")}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Access vault, ${assetCount} items`}
        >
          <Feather name="lock" size={12} color={Colors.dark.textTertiary} />
          <Text style={styles.vaultText}>ACCESS VAULT</Text>
          <Text style={styles.vaultDim}>· {assetCount} ITEMS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "space-between",
  },

  sysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sys: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  sysDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.successGreen,
    shadowColor: Colors.dark.successGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
  },
  sysText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
  },
  ver: {
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.dark.textDim,
    fontFamily: Fonts?.mono,
  },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  logoGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.dark.successGreen,
  },
  wordmark: {
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: -1,
    color: Colors.dark.text,
  },
  kicker: {
    marginTop: Spacing.md,
    fontSize: 11,
    letterSpacing: 6,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  caps: {
    marginTop: Spacing.xl,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },

  foot: { gap: Spacing.lg },
  cta: {
    height: 64,
    backgroundColor: Colors.dark.successGreen,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    overflow: "hidden",
    shadowColor: Colors.dark.successGreen,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  ctaGlow: {
    position: "absolute",
    top: -40,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    opacity: 0.18,
  },
  ctaLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTitle: {
    fontSize: 14,
    color: "#021006",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
  },
  ctaSub: {
    fontSize: 11,
    color: "rgba(2,16,6,0.6)",
    marginTop: 1,
  },
  ctaArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  vault: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  vaultText: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    fontWeight: "600",
  },
  vaultDim: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
});
