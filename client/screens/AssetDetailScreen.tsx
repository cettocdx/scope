import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";
import FinancialChart from "@/components/FinancialChart";
import { removeAssetFromPortfolio } from "@/services/portfolioService";

type Props = NativeStackScreenProps<RootStackParamList, "AssetDetail">;

export default function AssetDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { asset } = route.params;
  const profit = asset.estimatedPrice - asset.purchasePrice;
  const isProfit = profit >= 0;

  const handleShareAsset = async () => {
    try {
      const profit = asset.estimatedPrice - asset.purchasePrice;
      const profitText = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;
      const roiPercent = asset.purchasePrice > 0 ? ((profit / asset.purchasePrice) * 100).toFixed(1) : '0';

      const reportText = `
SCOPE Portfolio Asset

${asset.itemName}
Category: ${asset.category}

VALUATION
Current Value: $${asset.estimatedPrice.toLocaleString()}
Purchase Price: $${asset.purchasePrice.toLocaleString()}
Unrealized P/L: ${profitText} (${profit >= 0 ? '+' : ''}${roiPercent}%)

INVESTMENT ANALYSIS
AI Rating: ${asset.investmentRating}
Confidence: ${asset.confidenceScore}%
Trend: ${asset.trendPercentage > 0 ? '+' : ''}${asset.trendPercentage}% (24H)
Status: ${asset.isAuthentic ? 'VERIFIED' : 'UNVERIFIED'}

Acquired: ${new Date(asset.dateAdded).toLocaleDateString()}

Tracked by SCOPE - AI Asset Scanner
`.trim();

      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }

      await Share.share({
        message: reportText,
        title: `SCOPE Asset: ${asset.itemName}`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleLiquidate = () => {
    Alert.alert(
      "Liquidate Asset",
      "Are you sure you want to remove this asset from your vault?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Liquidate",
          style: "destructive",
          onPress: async () => {
            try {
              await removeAssetFromPortfolio(asset.id);

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              }

              navigation.goBack();
            } catch (e) {
              Alert.alert("Error", "Failed to remove asset");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleShareAsset}
          accessibilityRole="button"
          accessibilityLabel="Share asset"
        >
          <Feather name="share-2" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: asset.imageBase64 }} style={styles.heroImage} />
          <View style={styles.gradientOverlay} />
          <View style={styles.heroText}>
            <View style={styles.tagRow}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{asset.category}</Text>
              </View>
              {asset.isAuthentic && (
                <View style={styles.verifiedTag}>
                  <Feather name="shield" size={12} color={Colors.dark.successGreen} />
                  <Text style={styles.verifiedText}> VERIFIED</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>{asset.itemName}</Text>
          </View>
        </View>

        <View style={styles.contentBody}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MARKET VALUE</Text>
              <Text style={styles.statValue}>
                ${asset.estimatedPrice.toLocaleString()}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>UNREALIZED P/L</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: isProfit ? Colors.dark.successGreen : Colors.dark.alertRed },
                ]}
              >
                {isProfit ? "+" : ""}
                {profit.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.statLabel}>AI RATING</Text>
            <View style={styles.ratingBadge}>
              {asset.investmentRating === "BUY" && (
                <Feather name="trending-up" size={14} color={Colors.dark.successGreen} />
              )}
              {asset.investmentRating === "SELL" && (
                <Feather name="trending-down" size={14} color={Colors.dark.alertRed} />
              )}
              {asset.investmentRating === "HOLD" && (
                <Feather name="minus" size={14} color={Colors.dark.textSecondary} />
              )}
              <Text
                style={[
                  styles.ratingText,
                  {
                    color:
                      asset.investmentRating === "BUY"
                        ? Colors.dark.successGreen
                        : asset.investmentRating === "SELL"
                        ? Colors.dark.alertRed
                        : Colors.dark.text,
                  },
                ]}
              >
                {asset.investmentRating}
              </Text>
            </View>
          </View>

          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <View style={styles.chartHeaderRow}>
                <Feather name="clock" size={14} color={Colors.dark.textTertiary} />
                <Text style={styles.statLabel}>12 MONTH PROJECTION</Text>
              </View>
            </View>
            {asset.history && asset.history.length > 1 ? (
              <FinancialChart data={asset.history} height={200} showPrediction />
            ) : (
              <View style={styles.chartEmptyState}>
                <Feather name="bar-chart-2" size={20} color={Colors.dark.textTertiary} />
                <Text style={styles.chartEmptyText}>Not enough history to chart yet</Text>
              </View>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>ASSET SPECS</Text>
            {asset.condition && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Condition</Text>
                <Text style={styles.infoValue}>{asset.condition}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Acquired</Text>
              <Text style={styles.infoValue}>
                {new Date(asset.dateAdded).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <View style={styles.holdButton}>
          <Text style={styles.buttonText}>HOLD</Text>
        </View>
        <TouchableOpacity
          style={styles.liquidateButton}
          onPress={handleLiquidate}
          activeOpacity={0.8}
        >
          <Feather name="zap" size={18} color="#FFF" />
          <Text style={styles.buttonText}>LIQUIDATE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  imageContainer: {
    height: 400,
    width: "100%",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  heroText: {
    position: "absolute",
    bottom: Spacing.xl,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  tagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.dark.glassBorder,
  },
  tagText: {
    color: "#FFF",
    fontSize: Typography.micro.fontSize,
    fontFamily: Fonts?.mono,
  },
  verifiedTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(0, 255, 148, 0.2)",
    borderRadius: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedText: {
    color: Colors.dark.successGreen,
    fontSize: Typography.micro.fontSize,
    fontFamily: Fonts?.mono,
    fontWeight: "700",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFF",
    fontFamily: Fonts?.mono,
  },
  contentBody: {
    padding: Spacing.xl,
    marginTop: -Spacing.xl,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  statLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 1,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.priceSmall.fontSize,
    fontWeight: Typography.priceSmall.fontWeight,
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  ratingText: {
    fontSize: Typography.small.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  chartSection: {
    marginBottom: Spacing.xl,
  },
  chartHeader: {
    marginBottom: Spacing.md,
  },
  chartHeaderRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  chartEmptyState: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  chartEmptyText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  infoBlock: {
    padding: Spacing.xl,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  infoTitle: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  infoValue: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    flexDirection: "row",
    gap: Spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
  },
  holdButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: Colors.dark.cardBorder,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.cardBorderLight,
  },
  liquidateButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: Colors.dark.alertRed,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
});
