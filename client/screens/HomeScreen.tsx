import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
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

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
        if (saved) {
          const portfolio: PortfolioAsset[] = JSON.parse(saved);
          setAssetCount(portfolio.length);
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
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.topSection}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>SYSTEM_READY</Text>
        </View>
        <Text style={styles.versionText}>V1.0.4 NATIVE</Text>
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.heroTitle}>
          SCO<Text style={styles.heroDimLetter}>P</Text>E
        </Text>
        <View style={styles.divider} />
        <Text style={styles.heroSubtitle}>Identify. Analyze. Capitalize.</Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Feather name="aperture" size={12} color={Colors.dark.successGreen} />
            <Text style={styles.pillText}>VISION</Text>
          </View>
          <View style={styles.pill}>
            <Feather name="layers" size={12} color="#60A5FA" />
            <Text style={styles.pillText}>DEPTH</Text>
          </View>
          <View style={styles.pill}>
            <Feather name="trending-up" size={12} color="#C084FC" />
            <Text style={styles.pillText}>PREDICT</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.mainButton}
          onPress={handleStartScanner}
          activeOpacity={0.8}
        >
          <View style={styles.mainButtonContent}>
            <Feather name="crosshair" size={20} color="#000" />
            <Text style={styles.mainButtonText}>INITIALIZE SCANNER</Text>
          </View>
          <Feather name="arrow-right" size={20} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.vaultButton}
          onPress={handleOpenVault}
          activeOpacity={0.7}
        >
          <Text style={styles.vaultButtonText}>ACCESS VAULT</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{assetCount}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    paddingHorizontal: Spacing["3xl"],
    justifyContent: "space-between",
  },
  topSection: {
    marginTop: Spacing.xl,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.successGreen,
  },
  statusText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: Typography.micro.letterSpacing,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  versionText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textDim,
    fontFamily: Fonts?.mono,
    marginTop: Spacing.xs,
  },
  centerSection: {
    alignItems: "flex-start",
  },
  heroTitle: {
    fontSize: Typography.hero.fontSize,
    fontWeight: Typography.hero.fontWeight,
    letterSpacing: Typography.hero.letterSpacing,
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  heroDimLetter: {
    color: Colors.dark.cardBorder,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.dark.successGreen,
    marginVertical: Spacing.lg,
  },
  heroSubtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  pillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing["3xl"],
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  pillText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  bottomSection: {
    gap: Spacing.lg,
    marginBottom: Spacing["3xl"],
  },
  mainButton: {
    height: Spacing.buttonHeightLarge,
    backgroundColor: "#FFFFFF",
    borderRadius: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  mainButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  mainButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  vaultButton: {
    height: Spacing.buttonHeight,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: Spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  vaultButtonText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: Spacing.xs,
  },
  countText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.text,
    fontWeight: "700",
  },
});
