import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset } from "@/types";

const PORTFOLIO_STORAGE_KEY = "scope_portfolio_v1";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

export default function ResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { imageBase64, assetData } = route.params;
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    navigation.popToTop();
  };

  const handleAddToVault = async () => {
    setIsSaving(true);
    try {
      const newAsset: PortfolioAsset = {
        ...assetData,
        id: `asset-${Date.now()}`,
        dateAdded: new Date().toISOString(),
        purchasePrice: assetData.estimatedPrice,
        isAuthentic: assetData.confidenceScore > 80,
        history: Array(7)
          .fill(0)
          .map(() => assetData.estimatedPrice * (0.95 + Math.random() * 0.1)),
        imageBase64,
      };

      const saved = await AsyncStorage.getItem(PORTFOLIO_STORAGE_KEY);
      const portfolio: PortfolioAsset[] = saved ? JSON.parse(saved) : [];
      portfolio.unshift(newAsset);
      await AsyncStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio));

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      navigation.popToTop();
    } catch (e) {
      Alert.alert("Error", "Failed to save asset");
    } finally {
      setIsSaving(false);
    }
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.cardContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.tagRow}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{assetData.category}</Text>
              </View>
              {assetData.confidenceScore > 85 && (
                <View style={styles.matchTag}>
                  <Text style={styles.matchText}>99% MATCH</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {assetData.itemName}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Feather name="x" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              ${assetData.estimatedPrice.toLocaleString()}
            </Text>
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    assetData.trendPercentage >= 0
                      ? "rgba(0, 255, 148, 0.2)"
                      : "rgba(255, 59, 48, 0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      assetData.trendPercentage >= 0
                        ? Colors.dark.successGreen
                        : Colors.dark.alertRed,
                  },
                ]}
              >
                {assetData.trendPercentage > 0 ? "+" : ""}
                {assetData.trendPercentage}% (24H)
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAddToVault}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color="#000" />
              <Text style={styles.primaryButtonText}>
                {isSaving ? "SAVING..." : "ADD TO VAULT"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>GLOBAL MARKETS</Text>

          {assetData.deals?.map((deal, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dealCard}
              onPress={() => openLink(deal.url)}
              activeOpacity={0.7}
            >
              <View>
                <Text style={styles.storeName}>{deal.storeName}</Text>
                {deal.isBestDeal && (
                  <Text style={styles.bestDealText}>BEST PRICE</Text>
                )}
              </View>
              <View style={styles.dealRight}>
                <Text style={styles.dealPrice}>
                  ${deal.price.toLocaleString()}
                </Text>
                <Feather name="external-link" size={14} color={Colors.dark.textTertiary} />
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.shareButton} activeOpacity={0.7}>
            <Feather name="share-2" size={14} color={Colors.dark.textTertiary} />
            <Text style={styles.shareText}>SHARE REPORT</Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  cardContainer: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: SCREEN_HEIGHT * 0.85,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  handle: {
    width: 50,
    height: 4,
    backgroundColor: Colors.dark.textDim,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  headerLeft: {
    flex: 1,
  },
  closeButton: {
    padding: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
  },
  tagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: Spacing.xs,
  },
  categoryText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  matchTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(0, 255, 148, 0.1)",
    borderRadius: Spacing.xs,
  },
  matchText: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  scrollContent: {
    paddingHorizontal: Spacing["2xl"],
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
    marginBottom: Spacing["3xl"],
  },
  price: {
    fontSize: Typography.price.fontSize,
    fontWeight: Typography.price.fontWeight,
    color: Colors.dark.text,
  },
  trendBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  trendText: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing["3xl"],
  },
  primaryButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    backgroundColor: "#FFF",
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  primaryButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  sectionTitle: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 1,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.md,
  },
  dealCard: {
    backgroundColor: Colors.dark.backgroundTertiary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  storeName: {
    color: Colors.dark.text,
    fontWeight: "700",
    fontSize: Typography.body.fontSize,
  },
  bestDealText: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.mono,
    marginTop: Spacing.xs,
  },
  dealRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dealPrice: {
    color: Colors.dark.text,
    fontWeight: "700",
    fontSize: Typography.body.fontSize,
  },
  shareButton: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  shareText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
});
