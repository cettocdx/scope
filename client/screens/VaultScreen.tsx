import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Colors, Spacing, Typography, Fonts, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";
import FinancialChart from "@/components/FinancialChart";
import { TrendPill } from "@/components/TrendPill";
import { usePortfolio } from "@/hooks/usePortfolio";
import { imageSource } from "@/lib/image-store";
import { ScopeBackground } from "@/components/ScopeBackground";

// Fixed card geometry lets the list skip measurement (getItemLayout): an 80px
// image plus 4px padding top/bottom = 88, plus a 12px gap between cards.
const CARD_HEIGHT = 88;
const ROW_STRIDE = CARD_HEIGHT + Spacing.md;

type Props = NativeStackScreenProps<RootStackParamList, "Vault">;

const AssetRow = React.memo(function AssetRow({
  item,
  onPress,
}: {
  item: PortfolioAsset;
  onPress: (asset: PortfolioAsset) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.assetCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.itemName}, valued at ${item.estimatedPrice} dollars`}
    >
      <Image
        source={imageSource(item, { thumbnail: true })}
        style={styles.assetImage}
        contentFit="cover"
        recyclingKey={item.id}
        transition={120}
      />
      <View style={styles.assetInfo}>
        <View>
          <Text style={styles.assetName} numberOfLines={1}>
            {item.itemName}
          </Text>
          <Text style={styles.assetCategory}>{item.category}</Text>
        </View>
        <View style={styles.assetStats}>
          <Text style={styles.assetPrice}>${item.estimatedPrice.toLocaleString("en-US")}</Text>
          <TrendPill value={item.trendPercentage} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function VaultScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { assets, isLoading } = usePortfolio();

  const totalValue = assets.reduce((acc, curr) => acc + curr.estimatedPrice, 0);
  const totalPurchaseValue = assets.reduce((acc, curr) => acc + curr.purchasePrice, 0);
  const totalGainLoss = totalValue - totalPurchaseValue;
  const roiPercentage = totalPurchaseValue > 0 ? ((totalGainLoss / totalPurchaseValue) * 100) : 0;
  
  const historyData = React.useMemo(() => {
    if (assets.length === 0) return [0, 0, 0, 0, 0];
    
    const maxHistoryLength = Math.max(...assets.map(a => a.history?.length || 0), 7);
    const aggregatedHistory: number[] = [];
    
    for (let i = 0; i < maxHistoryLength; i++) {
      let totalAtPoint = 0;
      for (const asset of assets) {
        if (asset.history && asset.history[i] !== undefined) {
          totalAtPoint += asset.history[i];
        } else if (asset.history && asset.history.length > 0) {
          totalAtPoint += asset.history[asset.history.length - 1];
        } else {
          totalAtPoint += asset.estimatedPrice;
        }
      }
      aggregatedHistory.push(totalAtPoint);
    }
    
    return aggregatedHistory.length > 0 ? aggregatedHistory : [totalValue];
  }, [assets, totalValue]);

  const handleSelectAsset = useCallback(
    (asset: PortfolioAsset) => {
      navigation.navigate("AssetDetail", { asset });
    },
    [navigation],
  );

  const handleScan = () => {
    navigation.navigate("Scanner");
  };

  const renderAssetCard = useCallback(
    ({ item }: { item: PortfolioAsset }) => (
      <AssetRow item={item} onPress={handleSelectAsset} />
    ),
    [handleSelectAsset],
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.dark.accent} />
          <Text style={styles.loadingText}>LOADING VAULT</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <View style={styles.iconCircle}>
          <Feather name="briefcase" size={24} color={Colors.dark.textDim} />
        </View>
        <Text style={styles.emptyText}>VAULT IS EMPTY</Text>
      </View>
    );
  };

  return (
    <ScopeBackground>
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="chevron-left" size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Analytics")}
              style={styles.analyticsButton}
              accessibilityRole="button"
              accessibilityLabel="View analytics"
            >
              <Feather name="bar-chart-2" size={20} color={Colors.dark.accent} />
            </TouchableOpacity>
          </View>
          <View style={styles.netWorthSection}>
            <Text style={styles.label}>NET WORTH</Text>
            <Text style={styles.netWorth}>
              ${totalValue.toLocaleString()}
            </Text>
            {assets.length > 0 && (
              <View style={[
                styles.roiBadge,
                { backgroundColor: totalGainLoss >= 0 ? Colors.dark.successTintStrong : Colors.dark.alertTintStrong }
              ]}>
                <Text style={[
                  styles.roiText,
                  { color: totalGainLoss >= 0 ? Colors.dark.successGreen : Colors.dark.alertRed }
                ]}>
                  {totalGainLoss >= 0 ? "+" : ""}{roiPercentage.toFixed(1)}% ROI
                </Text>
              </View>
            )}
          </View>
        </View>
        <FinancialChart data={historyData} height={80} color={Colors.dark.accent} />
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderAssetCard}
        getItemLayout={(_data, index) => ({
          length: ROW_STRIDE,
          offset: ROW_STRIDE * index,
          index,
        })}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.label}>HOLDINGS</Text>
            <Text style={styles.activeCount}>{assets.length} ACTIVE</Text>
          </View>
        }
        ListEmptyComponent={renderEmptyState}
      />

      <View style={[styles.fabContainer, { bottom: 40 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={handleScan}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Scan new item"
        >
          <Feather name="crosshair" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.dark.glassSurface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.accentTint,
    justifyContent: "center",
    alignItems: "center",
  },
  netWorthSection: {
    alignItems: "flex-end",
  },
  label: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 2,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  netWorth: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  roiBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.xs,
    marginTop: Spacing.xs,
  },
  roiText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  listContent: {
    padding: Spacing.xl,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  activeCount: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    color: Colors.dark.accentIce,
    fontFamily: Fonts?.mono,
  },
  assetCard: {
    flexDirection: "row",
    height: CARD_HEIGHT,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  assetImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.cardBorder,
  },
  assetInfo: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  assetName: {
    color: Colors.dark.text,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  assetCategory: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  assetStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  assetPrice: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  emptyState: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    borderRadius: BorderRadius.lg,
    borderStyle: "dashed",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  loadingText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 2,
    marginTop: Spacing.md,
  },
  fabContainer: {
    position: "absolute",
    alignSelf: "center",
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.dark.accent,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
