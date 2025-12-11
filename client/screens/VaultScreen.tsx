import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Colors, Spacing, Typography, Fonts, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";
import FinancialChart from "@/components/FinancialChart";

const PORTFOLIO_STORAGE_KEY = "scope_portfolio_v1";
const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "Vault">;

export default function VaultScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);

  const loadPortfolio = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
      if (saved) {
        setAssets(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadPortfolio);
    loadPortfolio();
    return unsubscribe;
  }, [navigation, loadPortfolio]);

  const totalValue = assets.reduce((acc, curr) => acc + curr.estimatedPrice, 0);
  const historyData = assets.length > 0 
    ? [100, 102, 105, 103, 108, 112, 115, 118, 120, 125]
    : [0, 0, 0, 0, 0];

  const handleSelectAsset = (asset: PortfolioAsset) => {
    navigation.navigate("AssetDetail", { asset });
  };

  const handleScan = () => {
    navigation.navigate("Scanner");
  };

  const renderAssetCard = ({ item }: { item: PortfolioAsset }) => (
    <TouchableOpacity
      style={styles.assetCard}
      onPress={() => handleSelectAsset(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.imageBase64 }} style={styles.assetImage} />
      <View style={styles.assetInfo}>
        <View>
          <Text style={styles.assetName} numberOfLines={1}>
            {item.itemName}
          </Text>
          <Text style={styles.assetCategory}>{item.category}</Text>
        </View>
        <View style={styles.assetStats}>
          <Text style={styles.assetPrice}>
            ${item.estimatedPrice.toLocaleString()}
          </Text>
          <View
            style={[
              styles.trendPill,
              {
                backgroundColor:
                  item.trendPercentage >= 0
                    ? "rgba(0, 255, 148, 0.1)"
                    : "rgba(255, 59, 48, 0.1)",
              },
            ]}
          >
            <Text
              style={[
                styles.trendText,
                {
                  color:
                    item.trendPercentage >= 0
                      ? Colors.dark.successGreen
                      : Colors.dark.alertRed,
                },
              ]}
            >
              {item.trendPercentage > 0 ? "+" : ""}
              {item.trendPercentage}%
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.iconCircle}>
        <Feather name="briefcase" size={24} color={Colors.dark.textDim} />
      </View>
      <Text style={styles.emptyText}>VAULT IS EMPTY</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="chevron-left" size={24} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <View style={styles.netWorthSection}>
            <Text style={styles.label}>NET WORTH</Text>
            <Text style={styles.netWorth}>
              ${totalValue.toLocaleString()}
            </Text>
          </View>
        </View>
        <FinancialChart data={historyData} height={80} color={Colors.dark.successGreen} />
      </View>

      <FlatList
        data={assets}
        keyExtractor={(item) => item.id}
        renderItem={renderAssetCard}
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
        <TouchableOpacity style={styles.fab} onPress={handleScan} activeOpacity={0.8}>
          <Feather name="crosshair" size={24} color="#000" />
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
  },
  assetCard: {
    flexDirection: "row",
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
  trendPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.xs,
  },
  trendText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
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
  fabContainer: {
    position: "absolute",
    alignSelf: "center",
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
