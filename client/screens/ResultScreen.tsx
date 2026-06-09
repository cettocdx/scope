import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Linking,
  Alert,
  Platform,
  Share,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PortfolioAsset, ProductDeal } from "@/types";
import { useAddAsset } from "@/hooks/usePortfolio";
import { persistAssetImage } from "@/lib/image-store";
import { ScopeBackground } from "@/components/ScopeBackground";
import { ratingLabel, RATING_DISCLAIMER } from "@/lib/rating";
import { captureRef } from "react-native-view-shot";
import {
  ValueCard,
  VALUE_CARD_HEIGHT,
  VALUE_CARD_WIDTH,
} from "@/components/ValueCard";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

export default function ResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { imageBase64, assetData } = route.params;
  const [isSaving, setIsSaving] = useState(false);
  const addAsset = useAddAsset();

  const safeAssetData = {
    itemName: assetData?.itemName || "Unknown Item",
    estimatedPrice: assetData?.estimatedPrice || 0,
    currency: assetData?.currency || "USD",
    trendPercentage: assetData?.trendPercentage || 0,
    confidenceScore: assetData?.confidenceScore || 0,
    category: assetData?.category || "General",
    regulatedCategory: assetData?.regulatedCategory ?? false,
    investmentRating: assetData?.investmentRating || "HOLD",
    ratingReason: assetData?.ratingReason || "",
    deals: assetData?.deals || [],
    priceRange: assetData?.priceRange || { min: 0, median: 0, max: 0, currency: "USD" },
    outlierCount: assetData?.outlierCount || 0,
    sourceCount: assetData?.sourceCount ?? 0,
    pricedAt: assetData?.pricedAt ?? null,
  };

  // We only show real marketplace prices. When none were found the server sends
  // priceFound=false (and a 0 price), so the UI says "no price" instead of "$0".
  const priceFound =
    assetData?.priceFound ?? safeAssetData.estimatedPrice > 0;

  const [showRatingSheet, setShowRatingSheet] = useState(false);
  const [listingPrice, setListingPrice] = useState("");

  // Decision-moment: compare a listing/asking price to the real retail median.
  const median = safeAssetData.estimatedPrice;
  const listingValue = parseFloat(listingPrice.replace(/[^0-9.]/g, ""));
  const dealDiffPct =
    priceFound && median > 0 && listingValue > 0
      ? Math.round(((listingValue - median) / median) * 100)
      : null;

  const handleClose = () => {
    navigation.popToTop();
  };

  const handleAddToVault = async () => {
    setIsSaving(true);
    try {
      const id = `asset-${Date.now()}`;

      // Persist the captured image to the filesystem and keep only the file
      // uris on the asset — the base64 never reaches storage or the cloud.
      const stored = await persistAssetImage(imageBase64, id);

      const newAsset: PortfolioAsset = {
        ...safeAssetData,
        id,
        dateAdded: new Date().toISOString(),
        purchasePrice: safeAssetData.estimatedPrice,
        isAuthentic: safeAssetData.confidenceScore > 80,
        history: safeAssetData.estimatedPrice > 0 ? [safeAssetData.estimatedPrice] : [],
        imageUri: stored?.imageUri,
        thumbnailUri: stored?.thumbnailUri,
        // Fall back to the inline image only if persistence failed.
        imageBase64: stored ? undefined : imageBase64,
      };

      await addAsset.mutateAsync(newAsset);

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

  const cardRef = useRef<View>(null);

  // Capture the off-screen Value Card to an image and share it — the viral,
  // zero-CAC moment. Only meaningful when we have a real price.
  const handleShareValueCard = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      await Share.share(
        Platform.OS === "ios"
          ? { url: uri }
          : { url: uri, message: "Priced with SCOPE" },
      );
    } catch (e) {
      // captureRef needs a native module (unavailable in Expo Go); degrade to a
      // text share so the action still works everywhere.
      console.error("Value card capture failed, sharing text:", e);
      await Share.share({
        message: `${safeAssetData.itemName} — real price $${safeAssetData.estimatedPrice.toLocaleString(
          "en-US",
        )} (median of ${safeAssetData.sourceCount} live retail prices). Scanned with SCOPE.`,
      }).catch(() => {});
    }
  };

  const handleShareReport = async () => {
    try {
      const bestDeal = safeAssetData.deals?.find(d => d.isBestDeal);
      const dealsSummary = safeAssetData.deals
        ?.map(d => `${d.storeName}: $${d.price}${d.isBestDeal ? ' (Best Price)' : ''}`)
        .join('\n') || '';

      const reportText = `
SCOPE Asset Analysis Report

${safeAssetData.itemName}
Category: ${safeAssetData.category}

PRICE CHECK
Estimated Value: $${safeAssetData.estimatedPrice.toLocaleString("en-US")}
Trend: ${safeAssetData.trendPercentage > 0 ? '+' : ''}${safeAssetData.trendPercentage}% (24H)
AI Confidence: ${safeAssetData.confidenceScore}%
Price check: ${ratingLabel(safeAssetData.investmentRating)}

GLOBAL MARKET PRICES
${dealsSummary}

${bestDeal ? `Best Deal: ${bestDeal.storeName} at $${bestDeal.price}` : ''}

Analyzed by SCOPE - AI Asset Scanner
`.trim();

      if (Platform.OS !== "web") {
        Haptics.selectionAsync().catch(() => {});
      }

      await Share.share({
        message: reportText,
        title: `SCOPE Analysis: ${safeAssetData.itemName}`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  return (
    <ScopeBackground glowY={0.3}>
    {priceFound && (
      <View ref={cardRef} collapsable={false} style={styles.offscreenCard}>
        <ValueCard
          itemName={safeAssetData.itemName}
          price={safeAssetData.estimatedPrice}
          category={safeAssetData.category}
          sourceCount={safeAssetData.sourceCount}
        />
      </View>
    )}
    <View style={styles.modalOverlay}>
      <View style={[styles.cardContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.tagRow}>
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{safeAssetData.category}</Text>
              </View>
              {safeAssetData.confidenceScore > 85 && (
                <View style={styles.matchTag}>
                  <Text style={styles.matchText}>{safeAssetData.confidenceScore}% MATCH</Text>
                </View>
              )}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {safeAssetData.itemName}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {priceFound ? (
            <>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                ${safeAssetData.estimatedPrice.toLocaleString("en-US")}
              </Text>
              <View
                style={[
                  styles.trendBadge,
                  {
                    backgroundColor:
                      safeAssetData.trendPercentage >= 0
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
                        safeAssetData.trendPercentage >= 0
                          ? Colors.dark.successGreen
                          : Colors.dark.alertRed,
                    },
                  ]}
                >
                  {safeAssetData.trendPercentage > 0 ? "+" : ""}
                  {safeAssetData.trendPercentage}% (24H)
                </Text>
              </View>
            </View>
            {safeAssetData.sourceCount > 0 && (
              <View style={styles.trustRow}>
                <Feather name="check-circle" size={12} color={Colors.dark.accentIce} />
                <Text style={styles.trustText}>
                  Median of {safeAssetData.sourceCount} live retail price
                  {safeAssetData.sourceCount === 1 ? "" : "s"}
                  {safeAssetData.pricedAt
                    ? ` · ${new Date(safeAssetData.pricedAt).toLocaleDateString()}`
                    : ""}
                </Text>
              </View>
            )}
            </>
          ) : (
            <View style={styles.noPriceBox}>
              <Feather name="search" size={18} color={Colors.dark.warningYellow} />
              <View style={styles.noPriceTextWrap}>
                <Text style={styles.noPriceTitle}>Gerçek fiyat bulunamadı</Text>
                <Text style={styles.noPriceSub}>
                  Bu ürün için canlı mağaza fiyatı yok. Aşağıdaki linklerden arayabilirsin.
                </Text>
              </View>
            </View>
          )}

          {safeAssetData.priceRange.min > 0 && (
            <View style={styles.priceRangeContainer}>
              <Text style={styles.priceRangeTitle}>MARKET PRICE RANGE</Text>
              <View style={styles.priceRangeRow}>
                <View style={styles.priceRangeItem}>
                  <Text style={styles.priceRangeLabel}>MIN</Text>
                  <Text style={styles.priceRangeValue}>${safeAssetData.priceRange.min.toLocaleString("en-US")}</Text>
                </View>
                <View style={[styles.priceRangeItem, styles.priceRangeMedian]}>
                  <Text style={styles.priceRangeLabel}>MEDIAN</Text>
                  <Text style={[styles.priceRangeValue, styles.priceRangeMedianValue]}>
                    ${safeAssetData.priceRange.median.toLocaleString("en-US")}
                  </Text>
                </View>
                <View style={styles.priceRangeItem}>
                  <Text style={styles.priceRangeLabel}>MAX</Text>
                  <Text style={styles.priceRangeValue}>${safeAssetData.priceRange.max.toLocaleString("en-US")}</Text>
                </View>
              </View>
              {safeAssetData.outlierCount > 0 && (
                <Text style={styles.outlierInfo}>
                  {safeAssetData.outlierCount} outlier{safeAssetData.outlierCount > 1 ? 's' : ''} excluded from calculation
                </Text>
              )}
            </View>
          )}

          <View style={styles.ratingContainer}>
            <View style={styles.ratingBadge}>
              <Feather 
                name={safeAssetData.investmentRating === 'BUY' ? 'trending-up' : safeAssetData.investmentRating === 'SELL' ? 'trending-down' : 'minus'} 
                size={16} 
                color={safeAssetData.investmentRating === 'BUY' ? Colors.dark.successGreen : safeAssetData.investmentRating === 'SELL' ? Colors.dark.alertRed : Colors.dark.warningYellow} 
              />
              <Text style={[styles.ratingText, {
                color: safeAssetData.investmentRating === 'BUY' ? Colors.dark.successGreen : safeAssetData.investmentRating === 'SELL' ? Colors.dark.alertRed : Colors.dark.warningYellow
              }]}>
                {ratingLabel(safeAssetData.investmentRating)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.whyButton}
              onPress={() => setShowRatingSheet(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Why this rating"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.whyButtonText}>Why?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAddToVault}
              disabled={isSaving}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isSaving ? "Saving asset" : "Add to vault"}
              accessibilityState={{ disabled: isSaving, busy: isSaving }}
            >
              <Feather name="plus-circle" size={18} color="#000" />
              <Text style={styles.primaryButtonText}>
                {isSaving ? "SAVING..." : "ADD TO VAULT"}
              </Text>
            </TouchableOpacity>
            {priceFound && (
              <TouchableOpacity
                style={styles.promoButton}
                onPress={handleShareValueCard}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Share value card"
              >
                <Feather name="share" size={18} color={Colors.dark.accent} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.disclaimer}>{RATING_DISCLAIMER}</Text>

          {priceFound && (
            <View style={styles.dealCheck}>
              <Text style={styles.dealCheckLabel}>IS IT A GOOD DEAL?</Text>
              <View style={styles.dealCheckRow}>
                <Text style={styles.dealCheckCurrency}>$</Text>
                <TextInput
                  style={styles.dealCheckInput}
                  value={listingPrice}
                  onChangeText={setListingPrice}
                  placeholder="Enter the asking price"
                  placeholderTextColor={Colors.dark.textTertiary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  accessibilityLabel="Asking price to compare against retail"
                />
              </View>
              {dealDiffPct !== null && (
                <View
                  style={[
                    styles.dealVerdict,
                    {
                      backgroundColor:
                        dealDiffPct <= 0
                          ? Colors.dark.successTint
                          : Colors.dark.alertTint,
                    },
                  ]}
                >
                  <Feather
                    name={dealDiffPct <= 0 ? "trending-down" : "trending-up"}
                    size={16}
                    color={dealDiffPct <= 0 ? Colors.dark.successGreen : Colors.dark.alertRed}
                  />
                  <Text
                    style={[
                      styles.dealVerdictText,
                      { color: dealDiffPct <= 0 ? Colors.dark.successGreen : Colors.dark.alertRed },
                    ]}
                  >
                    {dealDiffPct === 0
                      ? "Right at retail price"
                      : dealDiffPct < 0
                        ? `${Math.abs(dealDiffPct)}% below retail · good deal`
                        : `${dealDiffPct}% above retail`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {safeAssetData.regulatedCategory ? (
            <View style={styles.regulatedNotice}>
              <Feather name="alert-triangle" size={16} color={Colors.dark.warningYellow} />
              <Text style={styles.regulatedNoticeText}>
                Regulated item (17+). Purchase links are hidden — prices shown for
                information only.
              </Text>
            </View>
          ) : (
          <>
          <Text style={styles.sectionTitle}>GLOBAL MARKETS</Text>

          {([
            { code: "US", name: "USA", emoji: "🇺🇸" },
            { code: "UK", name: "UK", emoji: "🇬🇧" },
            { code: "CN", name: "CHINA", emoji: "🇨🇳" },
            { code: "TR", name: "TÜRKİYE", emoji: "🇹🇷" },
            { code: "IT", name: "ITALY", emoji: "🇮🇹" },
            { code: "ES", name: "SPAIN", emoji: "🇪🇸" },
            { code: "FR", name: "FRANCE", emoji: "🇫🇷" },
            { code: "AE", name: "DUBAI", emoji: "🇦🇪" },
          ] as {
            code: string;
            name: string;
            emoji: string;
          }[]).map((region) => {
            const regionDeals = safeAssetData.deals?.filter((d: ProductDeal) => d.region === region.code) || [];
            if (regionDeals.length === 0) return null;

            return (
              <View key={region.code} style={styles.regionSection}>
                <View style={styles.regionHeader}>
                  <Text style={styles.regionFlag}>{region.emoji}</Text>
                  <Text style={styles.regionTitle}>{region.name}</Text>
                </View>
                {regionDeals.map((deal: ProductDeal, index: number) => (
                  <TouchableOpacity
                    key={`${region.code}-${index}`}
                    style={[styles.dealCard, deal.isOutlier && styles.dealCardOutlier]}
                    onPress={() => openLink(deal.url)}
                    activeOpacity={0.7}
                    accessibilityRole="link"
                    accessibilityLabel={
                      deal.isSearchLink
                        ? `Search ${deal.storeName}. Opens in browser.`
                        : `${deal.storeName}, ${Math.round(deal.price)} dollars. Opens in browser.`
                    }
                  >
                    <View style={styles.dealLeft}>
                      <View style={styles.storeRow}>
                        <Text style={styles.storeName}>{deal.storeName}</Text>
                        {deal.isOutlier && (
                          <View style={styles.outlierBadge}>
                            <Text style={styles.outlierBadgeText}>OUTLIER</Text>
                          </View>
                        )}
                      </View>
                      {deal.isBestDeal && !deal.isOutlier && (
                        <Text style={styles.bestDealText}>BEST PRICE</Text>
                      )}
                    </View>
                    <View style={styles.dealRight}>
                      {deal.isSearchLink ? (
                        <Text style={styles.searchLinkText}>ARA</Text>
                      ) : (
                        <Text style={[styles.dealPrice, deal.isOutlier && styles.dealPriceOutlier]}>
                          ${Math.round(deal.price).toLocaleString("en-US")}
                        </Text>
                      )}
                      <Feather name="external-link" size={14} color={Colors.dark.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          </>
          )}

          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.7}
            onPress={handleShareReport}
            accessibilityRole="button"
            accessibilityLabel="Share report"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="share-2" size={14} color={Colors.dark.textTertiary} />
            <Text style={styles.shareText}>SHARE REPORT</Text>
          </TouchableOpacity>

          <View style={{ height: 50 }} />
        </ScrollView>
      </View>

      <Modal
        visible={showRatingSheet}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRatingSheet(false)}
      >
        <View style={styles.ratingSheetOverlay}>
          <View style={[styles.ratingSheetContainer, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>
            
            <View style={styles.ratingSheetHeader}>
              <Text style={styles.ratingSheetTitle}>AI Rating Explanation</Text>
              <TouchableOpacity
                onPress={() => setShowRatingSheet(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="x" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.ratingSheetContent}>
              <View style={[styles.ratingBadgeLarge, {
                backgroundColor: safeAssetData.investmentRating === 'BUY' 
                  ? 'rgba(0, 255, 148, 0.15)' 
                  : safeAssetData.investmentRating === 'SELL' 
                    ? 'rgba(255, 59, 48, 0.15)' 
                    : 'rgba(250, 204, 21, 0.15)'
              }]}>
                <Feather 
                  name={safeAssetData.investmentRating === 'BUY' ? 'trending-up' : safeAssetData.investmentRating === 'SELL' ? 'trending-down' : 'minus'} 
                  size={32} 
                  color={safeAssetData.investmentRating === 'BUY' ? Colors.dark.successGreen : safeAssetData.investmentRating === 'SELL' ? Colors.dark.alertRed : Colors.dark.warningYellow} 
                />
                <Text style={[styles.ratingBadgeLargeText, {
                  color: safeAssetData.investmentRating === 'BUY' ? Colors.dark.successGreen : safeAssetData.investmentRating === 'SELL' ? Colors.dark.alertRed : Colors.dark.warningYellow
                }]}>
                  {ratingLabel(safeAssetData.investmentRating)}
                </Text>
              </View>

              <Text style={styles.ratingExplanationTitle}>
                Why {ratingLabel(safeAssetData.investmentRating)}?
              </Text>

              <View style={styles.ratingFactorsList}>
                {safeAssetData.ratingReason ? (
                  <View style={styles.ratingFactor}>
                    <Feather
                      name={safeAssetData.investmentRating === 'BUY' ? 'check-circle' : safeAssetData.investmentRating === 'SELL' ? 'alert-circle' : 'minus-circle'}
                      size={16}
                      color={safeAssetData.investmentRating === 'BUY' ? Colors.dark.successGreen : safeAssetData.investmentRating === 'SELL' ? Colors.dark.alertRed : Colors.dark.warningYellow}
                    />
                    <Text style={styles.ratingFactorText}>{safeAssetData.ratingReason}</Text>
                  </View>
                ) : (
                  <View style={styles.ratingFactor}>
                    <Feather name="info" size={16} color={Colors.dark.textTertiary} />
                    <Text style={styles.ratingFactorText}>No explanation available for this rating.</Text>
                  </View>
                )}
              </View>

              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>
                  AI ratings are based on market data analysis and should not be considered financial advice. 
                  Always do your own research before making investment decisions.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  offscreenCard: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: VALUE_CARD_WIDTH,
    height: VALUE_CARD_HEIGHT,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
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
    color: Colors.dark.accentIce,
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
  noPriceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing["3xl"],
    backgroundColor: "rgba(250, 204, 21, 0.08)",
    borderColor: "rgba(250, 204, 21, 0.25)",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
  },
  noPriceTextWrap: {
    flex: 1,
  },
  noPriceTitle: {
    fontSize: Typography.h4.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  noPriceSub: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textTertiary,
    marginTop: 2,
  },
  searchLinkText: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    letterSpacing: 1,
    color: Colors.dark.warningYellow,
    fontFamily: Fonts?.mono,
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
  promoButton: {
    width: Spacing.buttonHeight,
    height: Spacing.buttonHeight,
    backgroundColor: "rgba(0, 255, 148, 0.15)",
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 148, 0.3)",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  trustText: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
  },
  regulatedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(250, 204, 21, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.25)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  regulatedNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  dealCheck: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.accentBorder,
    backgroundColor: Colors.dark.accentTint,
  },
  dealCheckLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.dark.accentIce,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.sm,
  },
  dealCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  dealCheckCurrency: {
    fontSize: 20,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  dealCheckInput: {
    flex: 1,
    height: 48,
    marginLeft: 6,
    fontSize: 18,
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  dealVerdict: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  dealVerdictText: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  disclaimer: {
    fontSize: 10,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 0.3,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 1,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.md,
  },
  regionSection: {
    marginBottom: Spacing.lg,
  },
  regionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  regionFlag: {
    fontSize: 15,
  },
  regionTitle: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    color: Colors.dark.accentIce,
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
    color: Colors.dark.accent,
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
  priceRangeContainer: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  priceRangeTitle: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  priceRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceRangeItem: {
    alignItems: "center",
    flex: 1,
  },
  priceRangeMedian: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  priceRangeLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.xs,
  },
  priceRangeValue: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: Colors.dark.textSecondary,
  },
  priceRangeMedianValue: {
    color: Colors.dark.accentIce,
    fontSize: Typography.h3.fontSize,
  },
  outlierInfo: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.warningYellow,
    fontFamily: Fonts?.mono,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  ratingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
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
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  whyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: BorderRadius.sm,
  },
  whyButtonText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  dealCardOutlier: {
    opacity: 0.6,
    borderColor: Colors.dark.warningYellow,
  },
  dealLeft: {
    flex: 1,
  },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  outlierBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    backgroundColor: "rgba(250, 204, 21, 0.2)",
    borderRadius: 4,
  },
  outlierBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.dark.warningYellow,
    fontFamily: Fonts?.mono,
  },
  dealPriceOutlier: {
    color: Colors.dark.textTertiary,
    textDecorationLine: "line-through",
  },
  ratingSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  ratingSheetContainer: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  ratingSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing.lg,
  },
  ratingSheetTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  ratingSheetContent: {
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
  },
  ratingBadgeLarge: {
    alignSelf: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  ratingBadgeLargeText: {
    fontSize: Typography.h1.fontSize,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  ratingExplanationTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  ratingFactorsList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  ratingFactor: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.dark.backgroundTertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  ratingFactorText: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.dark.text,
  },
  disclaimerBox: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  disclaimerText: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textTertiary,
    textAlign: "center",
    lineHeight: 20,
  },
});
