import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Typography, Fonts, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";
import FinancialChart from "@/components/FinancialChart";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ScopeBackground } from "@/components/ScopeBackground";

type Props = NativeStackScreenProps<RootStackParamList, "Analytics">;

interface AnalyticsData {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  roiPercentage: number;
  bestPerformer: PortfolioAsset | null;
  worstPerformer: PortfolioAsset | null;
  categoryBreakdown: { category: string; value: number; count: number }[];
  ratingCounts: { BUY: number; HOLD: number; SELL: number };
  recommendations: string[];
}

function calculateAnalytics(assets: PortfolioAsset[]): AnalyticsData {
  if (assets.length === 0) {
    return {
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      roiPercentage: 0,
      bestPerformer: null,
      worstPerformer: null,
      categoryBreakdown: [],
      ratingCounts: { BUY: 0, HOLD: 0, SELL: 0 },
      recommendations: ["Scan your first asset to build your portfolio!"],
    };
  }

  const totalValue = assets.reduce((acc, a) => acc + a.estimatedPrice, 0);
  const totalCost = assets.reduce((acc, a) => acc + a.purchasePrice, 0);
  const totalGainLoss = totalValue - totalCost;
  const roiPercentage = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const assetPerformance = assets.map(a => ({
    asset: a,
    gain: ((a.estimatedPrice - a.purchasePrice) / a.purchasePrice) * 100,
  }));

  const sorted = [...assetPerformance].sort((a, b) => b.gain - a.gain);
  const bestPerformer = sorted[0]?.asset || null;
  const worstPerformer = sorted[sorted.length - 1]?.asset || null;

  const categoryMap = new Map<string, { value: number; count: number }>();
  for (const asset of assets) {
    const existing = categoryMap.get(asset.category) || { value: 0, count: 0 };
    categoryMap.set(asset.category, {
      value: existing.value + asset.estimatedPrice,
      count: existing.count + 1,
    });
  }
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.value - a.value);

  const ratingCounts = { BUY: 0, HOLD: 0, SELL: 0 };
  for (const asset of assets) {
    ratingCounts[asset.investmentRating as keyof typeof ratingCounts]++;
  }

  const recommendations: string[] = [];
  
  if (ratingCounts.SELL > 0) {
    recommendations.push(`Consider liquidating ${ratingCounts.SELL} SELL-rated asset${ratingCounts.SELL > 1 ? 's' : ''} to optimize returns.`);
  }
  
  if (categoryBreakdown.length === 1) {
    recommendations.push("Diversify your portfolio across different asset categories.");
  }
  
  if (roiPercentage > 20) {
    recommendations.push("Excellent ROI! Consider taking partial profits to lock in gains.");
  } else if (roiPercentage < -10) {
    recommendations.push("Portfolio is underperforming. Review SELL-rated assets for potential cuts.");
  }
  
  if (ratingCounts.BUY > ratingCounts.HOLD + ratingCounts.SELL) {
    recommendations.push("Strong BUY signals across portfolio - good growth potential.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Portfolio is balanced. Continue monitoring market trends.");
  }

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    roiPercentage,
    bestPerformer,
    worstPerformer,
    categoryBreakdown,
    ratingCounts,
    recommendations,
  };
}

export default function AnalyticsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { assets, isLoading } = usePortfolio();
  const analytics = React.useMemo(() => calculateAnalytics(assets), [assets]);

  const historyData = React.useMemo(() => {
    if (assets.length === 0) return [0, 0, 0, 0, 0];
    const maxLen = Math.max(...assets.map(a => a.history?.length || 0), 7);
    const aggregated: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      let total = 0;
      for (const asset of assets) {
        if (asset.history && asset.history[i] !== undefined) {
          total += asset.history[i];
        } else {
          total += asset.estimatedPrice;
        }
      }
      aggregated.push(total);
    }
    return aggregated;
  }, [assets]);

  const navigateToAsset = (asset: PortfolioAsset) => {
    navigation.navigate("AssetDetail", { asset });
  };

  return (
    <ScopeBackground>
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={24} color={Colors.dark.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ANALYTICS</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <Text style={styles.loadingText}>CRUNCHING NUMBERS</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>PORTFOLIO VALUE</Text>
          <Text style={styles.summaryValue}>${analytics.totalValue.toLocaleString()}</Text>
          <View style={[
            styles.roiBadge,
            { backgroundColor: analytics.totalGainLoss >= 0 ? Colors.dark.successTintStrong : Colors.dark.alertTintStrong }
          ]}>
            <Text style={[
              styles.roiText,
              { color: analytics.totalGainLoss >= 0 ? Colors.dark.successGreen : Colors.dark.alertRed }
            ]}>
              {analytics.totalGainLoss >= 0 ? "+" : ""}${analytics.totalGainLoss.toFixed(0)} ({analytics.roiPercentage.toFixed(1)}% ROI)
            </Text>
          </View>
          <FinancialChart data={historyData} height={100} color={Colors.dark.accent} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBg}>
              <Feather name="trending-up" size={16} color={Colors.dark.successGreen} />
            </View>
            <Text style={styles.statValue}>{analytics.ratingCounts.BUY}</Text>
            <Text style={styles.statLabel}>BUY</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: "rgba(255, 255, 255, 0.1)" }]}>
              <Feather name="minus" size={16} color={Colors.dark.textSecondary} />
            </View>
            <Text style={styles.statValue}>{analytics.ratingCounts.HOLD}</Text>
            <Text style={styles.statLabel}>HOLD</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconBg, { backgroundColor: Colors.dark.alertTintStrong }]}>
              <Feather name="trending-down" size={16} color={Colors.dark.alertRed} />
            </View>
            <Text style={styles.statValue}>{analytics.ratingCounts.SELL}</Text>
            <Text style={styles.statLabel}>SELL</Text>
          </View>
        </View>

        {analytics.bestPerformer && (
          <TouchableOpacity
            style={styles.performerCard}
            onPress={() => navigateToAsset(analytics.bestPerformer!)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Top performer: ${analytics.bestPerformer.itemName}. Open details.`}
          >
            <View style={styles.performerHeader}>
              <Feather name="award" size={16} color={Colors.dark.successGreen} />
              <Text style={styles.performerTitle}>TOP PERFORMER</Text>
            </View>
            <Text style={styles.performerName}>{analytics.bestPerformer.itemName}</Text>
            <Text style={styles.performerValue}>
              ${analytics.bestPerformer.estimatedPrice.toLocaleString()}
              <Text style={[styles.performerGain, { color: Colors.dark.successGreen }]}>
                {" +"}
                {(((analytics.bestPerformer.estimatedPrice - analytics.bestPerformer.purchasePrice) / analytics.bestPerformer.purchasePrice) * 100).toFixed(1)}%
              </Text>
            </Text>
          </TouchableOpacity>
        )}

        {analytics.worstPerformer && analytics.worstPerformer !== analytics.bestPerformer && (
          <TouchableOpacity
            style={[styles.performerCard, { borderColor: "rgba(255, 59, 48, 0.3)" }]}
            onPress={() => navigateToAsset(analytics.worstPerformer!)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Underperformer: ${analytics.worstPerformer.itemName}. Open details.`}
          >
            <View style={styles.performerHeader}>
              <Feather name="alert-triangle" size={16} color={Colors.dark.alertRed} />
              <Text style={[styles.performerTitle, { color: Colors.dark.alertRed }]}>UNDERPERFORMER</Text>
            </View>
            <Text style={styles.performerName}>{analytics.worstPerformer.itemName}</Text>
            <Text style={styles.performerValue}>
              ${analytics.worstPerformer.estimatedPrice.toLocaleString()}
              <Text style={[styles.performerGain, { color: Colors.dark.alertRed }]}>
                {" "}
                {(((analytics.worstPerformer.estimatedPrice - analytics.worstPerformer.purchasePrice) / analytics.worstPerformer.purchasePrice) * 100).toFixed(1)}%
              </Text>
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Feather name="pie-chart" size={14} color={Colors.dark.textTertiary} />
          <Text style={styles.sectionTitle}>ALLOCATION BY CATEGORY</Text>
        </View>
        
        {analytics.categoryBreakdown.map((cat, index) => (
          <View key={cat.category} style={styles.categoryRow}>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{cat.category}</Text>
              <Text style={styles.categoryCount}>{cat.count} asset{cat.count > 1 ? "s" : ""}</Text>
            </View>
            <Text style={styles.categoryValue}>${cat.value.toLocaleString()}</Text>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Feather name="zap" size={14} color={Colors.dark.textTertiary} />
          <Text style={styles.sectionTitle}>AI RECOMMENDATIONS</Text>
        </View>

        {analytics.recommendations.map((rec, index) => (
          <View key={index} style={styles.recommendationCard}>
            <Feather name="info" size={14} color="#60A5FA" />
            <Text style={styles.recommendationText}>{rec}</Text>
          </View>
        ))}
      </ScrollView>
      )}
    </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
    letterSpacing: 2,
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 2,
  },
  summaryCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    marginBottom: Spacing.xl,
  },
  summaryLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 2,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.sm,
  },
  roiBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  roiText: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 255, 148, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  statLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  performerCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 255, 148, 0.3)",
  },
  performerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  performerTitle: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
  },
  performerName: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.xs,
  },
  performerValue: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  performerGain: {
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 1,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  categoryCount: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  categoryValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  recommendationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    backgroundColor: "rgba(96, 165, 250, 0.1)",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(96, 165, 250, 0.2)",
  },
  recommendationText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    lineHeight: 20,
  },
});
