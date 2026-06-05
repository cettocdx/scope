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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors, Spacing, Fonts, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";

const PORTFOLIO_STORAGE_KEY = "scope_portfolio_v1";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [assetCount, setAssetCount] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const pulseAnim = useState(new Animated.Value(1))[0];
  const glowAnim = useState(new Animated.Value(0.3))[0];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
        if (saved) {
          const portfolio: PortfolioAsset[] = JSON.parse(saved);
          setAssetCount(portfolio.length);
          const value = portfolio.reduce((acc, a) => acc + a.estimatedPrice, 0);
          setTotalValue(value);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const unsubscribe = navigation.addListener("focus", loadPortfolio);
    loadPortfolio();
    return unsubscribe;
  }, [navigation]);

  const handleStartScanner = () => {
    navigation.navigate("Scanner");
  };

  const handleOpenVault = () => {
    navigation.navigate("Vault");
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.xl }]}>
      <Animated.View style={[styles.glowOrb, { opacity: glowAnim }]} />
      <Animated.View style={[styles.glowOrb2, { opacity: glowAnim }]} />

      <View style={styles.topSection}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>SYSTEM ONLINE</Text>
            </View>
            <Text style={styles.versionText}>v1.0.4</Text>
          </View>
          <View style={styles.networkStatus}>
            <Feather name="wifi" size={14} color={Colors.dark.successGreen} />
            <Text style={styles.networkText}>CONNECTED</Text>
          </View>
        </View>
      </View>

      <View style={styles.centerSection}>
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.logoGlow, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.logoIcon}>
            <Feather name="target" size={40} color={Colors.dark.successGreen} />
          </View>
        </View>

        <Text style={styles.heroTitle}>SCOPE</Text>
        <Text style={styles.heroTagline}>AI Asset Intelligence</Text>

        <View style={styles.dividerContainer}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDiamond} />
          <View style={styles.dividerLine} />
        </View>

        <Text style={styles.heroSubtitle}>Identify. Analyze. Capitalize.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{assetCount}</Text>
            <Text style={styles.statLabel}>ASSETS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${totalValue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>VALUE</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Feather name="camera" size={12} color={Colors.dark.successGreen} />
            <Text style={styles.pillText}>SCAN</Text>
          </View>
          <View style={styles.pill}>
            <Feather name="cpu" size={12} color="#60A5FA" />
            <Text style={styles.pillText}>AI ANALYZE</Text>
          </View>
          <View style={styles.pill}>
            <Feather name="dollar-sign" size={12} color="#C084FC" />
            <Text style={styles.pillText}>VALUATE</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.mainButton}
          onPress={handleStartScanner}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start scanning. Point camera at any object"
        >
          <View style={styles.mainButtonGlow} />
          <View style={styles.mainButtonContent}>
            <View style={styles.scanIconContainer}>
              <Feather name="crosshair" size={22} color="#000" />
            </View>
            <View>
              <Text style={styles.mainButtonText}>START SCANNING</Text>
              <Text style={styles.mainButtonSubtext}>Point camera at any object</Text>
            </View>
          </View>
          <View style={styles.arrowContainer}>
            <Feather name="arrow-right" size={20} color="#000" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vaultButton}
          onPress={handleOpenVault}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Access vault, ${assetCount} assets`}
        >
          <Feather name="lock" size={16} color={Colors.dark.textSecondary} />
          <Text style={styles.vaultButtonText}>ACCESS VAULT</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{assetCount}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.footerText}>Powered by Gemini AI</Text>
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
  glowOrb: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.dark.successGreen,
    opacity: 0.15,
  },
  glowOrb2: {
    position: "absolute",
    bottom: 100,
    left: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#60A5FA",
    opacity: 0.1,
  },
  topSection: {
    marginTop: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.successGreen,
    shadowColor: Colors.dark.successGreen,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "600",
    letterSpacing: 1.5,
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
  },
  versionText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textDim,
    fontFamily: Fonts?.mono,
    marginTop: Spacing.xs,
  },
  networkStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(0, 255, 148, 0.1)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.sm,
  },
  networkText: {
    fontSize: 10,
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
    fontWeight: "600",
  },
  centerSection: {
    alignItems: "center",
    marginTop: -Spacing["3xl"],
  },
  logoContainer: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  logoGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.dark.successGreen,
    opacity: 0.15,
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 255, 148, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0, 255, 148, 0.3)",
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: 12,
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  heroTagline: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 3,
    marginTop: Spacing.xs,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  dividerLine: {
    width: 40,
    height: 1,
    backgroundColor: Colors.dark.cardBorder,
  },
  dividerDiamond: {
    width: 8,
    height: 8,
    backgroundColor: Colors.dark.successGreen,
    transform: [{ rotate: "45deg" }],
  },
  heroSubtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing["2xl"],
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.dark.cardBorder,
  },
  pillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing["2xl"],
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  pillText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    fontWeight: "600",
  },
  bottomSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  mainButton: {
    height: 72,
    backgroundColor: Colors.dark.successGreen,
    borderRadius: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    overflow: "hidden",
  },
  mainButtonGlow: {
    position: "absolute",
    top: -50,
    left: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#fff",
    opacity: 0.15,
  },
  mainButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  scanIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonText: {
    fontSize: 15,
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
  },
  mainButtonSubtext: {
    fontSize: 11,
    color: "rgba(0, 0, 0, 0.6)",
    fontFamily: Fonts?.mono,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  vaultButton: {
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: Spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  vaultButtonText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: Spacing.xs,
  },
  countText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: Colors.dark.textDim,
    fontFamily: Fonts?.mono,
    marginTop: Spacing.sm,
  },
});
