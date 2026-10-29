import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { Icon } from "@/components/Icon";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import {
  Button,
  Chip,
  Divider,
  Glass,
  IconButton,
  notify,
  Press,
  Skeleton,
  Txt,
} from "@/components/ui";
import {
  MarketTabs,
  OfferRow,
  PickTile,
  RangeBar,
  RecommendedCard,
  VisualMatches,
  openStore,
} from "@/components/offers";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getPhoto } from "@/lib/scan-session";
import { recordScan } from "@/lib/quota";
import { imageSource, persistAssetImage } from "@/lib/image-store";
import { newSavedId, savedItemFrom } from "@/lib/saved";
import { historyEntry, recordHistory } from "@/lib/history";
import { categoryName, LOCALE, t } from "@/lib/i18n";
import {
  fetchPrices,
  identify,
  identityFromName,
  pricesRequestFor,
  sendFeedback,
  titleFor,
  visualMatches,
} from "@/services/scanService";
import {
  useAddAsset,
  usePortfolio,
  useRemoveAsset,
} from "@/hooks/usePortfolio";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import type {
  Market,
  PriceReport,
  ProductIdentity,
  VisualMatch,
} from "@shared/scan";

type Props = NativeStackScreenProps<RootStackParamList, "Result">;

const HERO = 300;
const ROWS_COLLAPSED = 6;

type ConfIcon = "check-circle" | "circle" | "help-circle";

function confidenceLabel(c: number): {
  label: string;
  color: string;
  icon: ConfIcon;
} {
  if (c >= 85)
    return {
      label: t("Exact match"),
      color: Colors.trustHigh,
      icon: "check-circle",
    };
  if (c >= 60)
    return { label: t("Likely match"), color: Colors.trustMid, icon: "circle" };
  return {
    label: t("Best guess"),
    color: Colors.trustLow,
    icon: "help-circle",
  };
}

export default function ResultScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { scanId, savedId, query, historyId } = route.params;
  const photo = scanId ? getPhoto(scanId) : undefined;
  const past = historyId ? historyEntry(historyId) : undefined;
  // A fresh photo scan is remembered in History under its scan id.
  const historyKey = scanId ?? historyId ?? null;
  const { assets } = usePortfolio();
  const saved = savedId ? assets.find((a) => a.id === savedId) : undefined;
  const addAsset = useAddAsset();
  const removeAsset = useRemoveAsset();
  const { isPro } = useAuth();
  const { homeMarket } = useSettings();

  const [identity, setIdentity] = useState<ProductIdentity | null>(
    saved
      ? (saved.identity ?? identityFromName(saved.itemName))
      : past
        ? past.identity
        : query
          ? identityFromName(query)
          : null,
  );
  const [idError, setIdError] = useState<string | null>(null);
  const [report, setReport] = useState<PriceReport | null>(
    saved?.report ?? past?.report ?? null,
  );
  const [priceState, setPriceState] = useState<
    "idle" | "loading" | "error" | "done"
  >(saved?.report || past?.report ? "done" : "idle");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savedItemId, setSavedItemId] = useState<string | null>(
    savedId ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // The name field is uncontrolled (fast typing never races a re-render):
  // `draft` only seeds it, `typed` holds what is in it now.
  const [draft, setDraft] = useState("");
  const typed = useRef("");
  const [canApply, setCanApply] = useState(false);
  const openEditor = (seed: string) => {
    setDraft(seed);
    typed.current = seed;
    setCanApply(seed.trim().length >= 2);
    setEditing(true);
  };
  const [market, setMarket] = useState<Market>(homeMarket);
  const [expanded, setExpanded] = useState(false);
  const [matches, setMatches] = useState<VisualMatch[]>([]);
  const runToken = useRef(0);
  const refreshed = useRef(false);

  const imageUri =
    photo?.uri ??
    (saved ? imageSource(saved) : (past?.imageUri ?? past?.thumbnailUri));
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const heroStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform: [
        { translateY: y < 0 ? y / 2 : y * 0.4 },
        { scale: y < 0 ? 1 + -y / HERO : 1 },
      ],
    };
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HERO - 120, HERO - 40],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const runPrices = useCallback(
    async (id: ProductIdentity) => {
      const token = ++runToken.current;
      setPriceState("loading");
      setPriceError(null);
      try {
        const r = await fetchPrices(pricesRequestFor(id, homeMarket));
        if (token !== runToken.current) return;
        setReport(r);
        setPriceState("done");
        setExpanded(false);
        if (r.picks.recommended) notify();
        if (historyKey)
          void recordHistory({ id: historyKey, identity: id, report: r });
        setMarket((current) => {
          const has = (m: Market) =>
            (r.markets.find((x) => x.market === m)?.offers.length ?? 0) > 0;
          return has(current)
            ? current
            : (r.markets.find((m) => m.offers.length > 0)?.market ?? current);
        });
      } catch (e) {
        if (token !== runToken.current) return;
        setPriceError(e instanceof Error ? e.message : String(e));
        setPriceState("error");
      }
    },
    [homeMarket, historyKey],
  );

  const runIdentify = useCallback(async () => {
    if (!photo) return;
    // Lens runs alongside identification; it shows up whenever it lands.
    void visualMatches(photo.base64, homeMarket).then((r) =>
      setMatches(r.matches),
    );
    setIdError(null);
    setIdentity(null);
    setReport(null);
    setPriceState("idle");
    try {
      const res = await identify(photo.base64, { barcode: photo.barcode });
      setIdentity(res.identity);
      notify();
      if (scanId)
        void recordHistory({
          id: scanId,
          identity: res.identity,
          photoBase64: photo.base64,
        });
      if (!isPro) void recordScan();
      // Animals, people, places… have nothing to price.
      if (res.identity.kind !== "not_for_sale") void runPrices(res.identity);
    } catch (e) {
      notify("error");
      setIdError(e instanceof Error ? e.message : String(e));
    }
  }, [homeMarket, isPro, photo, runPrices, scanId]);

  useEffect(() => {
    if (photo) void runIdentify();
    else if (identity && !report) void runPrices(identity);
    // Runs once per opened screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A saved item keeps its latest prices after a refresh.
  useEffect(() => {
    if (!saved || !identity || !report || !refreshed.current) return;
    refreshed.current = false;
    addAsset.mutate(
      savedItemFrom({
        id: saved.id,
        identity,
        report,
        dateAdded: saved.dateAdded,
        image: { imageUri: saved.imageUri, thumbnailUri: saved.thumbnailUri },
        previous: saved,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  const applyName = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (clean.length < 2) return;
      if (identity && clean.toLowerCase() !== identity.name.toLowerCase())
        sendFeedback({
          wrong: identity.name,
          right: clean,
          category: identity.category,
          confidence: identity.confidence,
          source: photo
            ? "photo"
            : saved
              ? "saved"
              : past
                ? "history"
                : "typed",
        });
      const next = identityFromName(clean, identity);
      setIdentity(next);
      setIdError(null);
      setEditing(false);
      if (saved) refreshed.current = true;
      void runPrices(next);
    },
    [identity, past, photo, runPrices, saved],
  );

  const onSave = useCallback(async () => {
    if (!identity) return;
    if (savedItemId) {
      Alert.alert(t("Remove this item?"), identity.name, [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Remove"),
          style: "destructive",
          onPress: () => {
            removeAsset.mutate(savedItemId);
            setSavedItemId(null);
            if (saved) navigation.goBack();
          },
        },
      ]);
      return;
    }
    setSaving(true);
    try {
      const id = newSavedId();
      const image = photo
        ? await persistAssetImage(`data:image/jpeg;base64,${photo.base64}`, id)
        : past
          ? { imageUri: past.imageUri, thumbnailUri: past.thumbnailUri }
          : null;
      await addAsset.mutateAsync(
        savedItemFrom({ id, identity, report, image: image ?? undefined }),
      );
      setSavedItemId(id);
      notify();
    } finally {
      setSaving(false);
    }
  }, [
    addAsset,
    identity,
    navigation,
    past,
    photo,
    removeAsset,
    report,
    saved,
    savedItemId,
  ]);

  const onShare = useCallback(() => {
    if (!identity) return;
    const best = report?.picks.recommended;
    const lines = [identity.name];
    if (best && !identity.regulated) {
      lines.push(
        `${t("Recommended")}: ${best.store} · ${best.price} ${best.currency}`,
        best.url,
      );
    }
    lines.push("— SCOPE");
    Share.share({ message: lines.join("\n") }).catch(() => {});
  }, [identity, report]);

  const linkable = !identity?.regulated;
  const typedSearch = !imageUri && !!(query || (saved && !saved.identity));
  const productShot = imageUri
    ? undefined
    : (report?.picks.recommended?.thumbnail ??
      report?.markets.flatMap((m) => m.offers).find((o) => o.thumbnail)
        ?.thumbnail ??
      undefined);
  const selected = report?.markets.find((m) => m.market === market);
  const offers = selected?.offers ?? [];
  const shownOffers = expanded ? offers : offers.slice(0, ROWS_COLLAPSED);
  const picks = report?.picks;
  const conf = identity ? confidenceLabel(identity.confidence) : null;
  const title = identity ? titleFor(identity) : "";
  const subtitle = identity
    ? [
        title !== identity.name ? identity.name : identity.brand,
        identity.variant,
        identity.category !== "Other" ? categoryName(identity.category) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const pricedAt = useMemo(
    () =>
      report
        ? new Date(report.pricedAt).toLocaleTimeString(LOCALE, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    [report],
  );
  const showSideTiles =
    !!picks?.recommended &&
    ((picks.cheapest && picks.cheapest.id !== picks.recommended.id) ||
      (picks.safest && picks.safest.id !== picks.recommended.id));

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.huge }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { height: HERO + insets.top }]}>
          {imageUri ? (
            <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
              />
            </Animated.View>
          ) : productShot ? (
            // No photo (typed search): show the product as the shops picture it.
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[styles.heroEmpty, { paddingTop: insets.top }]}
            >
              <View style={styles.productCard}>
                <Image
                  source={{ uri: productShot }}
                  style={styles.productImage}
                  contentFit="contain"
                  transition={250}
                />
              </View>
            </Animated.View>
          ) : (
            <View style={[styles.heroEmpty, { paddingTop: insets.top }]}>
              <Icon name="search" size={40} color={Colors.textTertiary} />
            </View>
          )}
          {imageUri ? (
            <LinearGradient
              colors={[
                "rgba(0,0,0,0.5)",
                "transparent",
                "rgba(0,0,0,0.15)",
                Colors.bg,
              ]}
              locations={[0, 0.3, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>

        <View style={styles.body}>
          {identity && conf ? (
            <Animated.View
              entering={FadeInDown.duration(420).springify().damping(18)}
              style={styles.identity}
            >
              <View style={styles.chips}>
                {typedSearch ? (
                  <Chip icon="search" label={t("Searched by name")} />
                ) : (
                  <Chip
                    icon={conf.icon}
                    label={conf.label}
                    color={conf.color}
                  />
                )}
                {identity.kind === "generic" ? (
                  <Chip icon="tag" label={t("Brand not visible")} />
                ) : null}
                {identity.barcode ? (
                  <Chip icon="maximize" label={identity.barcode} />
                ) : null}
              </View>
              <Txt variant="display" accessibilityRole="header">
                {title}
              </Txt>
              {subtitle ? (
                <Txt variant="body" color={Colors.textSecondary}>
                  {subtitle}
                </Txt>
              ) : null}
              <Press
                onPress={() => {
                  openEditor(identity.name);
                }}
                haptic
                accessibilityRole="button"
                accessibilityLabel={t("Not right?")}
                style={styles.notRight}
              >
                <Icon name="edit-3" size={14} color={Colors.accent} />
                <Txt variant="calloutStrong" color={Colors.accent}>
                  {t("Not right?")}
                </Txt>
              </Press>
              {(identity.others ?? []).length > 0 ? (
                <View style={styles.alts}>
                  <Txt variant="caption" color={Colors.textTertiary}>
                    {t("Also in this photo")}
                  </Txt>
                  <View style={styles.chips}>
                    {identity.others.map((o) => (
                      <Chip
                        key={o}
                        label={o}
                        icon="plus"
                        onPress={() => applyName(o)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              {identity.alternatives.length > 0 ? (
                <View style={styles.alts}>
                  <Txt variant="caption" color={Colors.textTertiary}>
                    {t("Could also be")}
                  </Txt>
                  <View style={styles.chips}>
                    {identity.alternatives.map((a) => (
                      <Chip
                        key={a}
                        label={a}
                        icon="corner-down-right"
                        onPress={() => applyName(a)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </Animated.View>
          ) : idError ? (
            <View style={styles.errorCard}>
              <Icon name="alert-circle" size={22} color={Colors.trustLow} />
              <Txt variant="headline">{t("Couldn't identify this")}</Txt>
              <Txt
                variant="callout"
                color={Colors.textSecondary}
                style={styles.centerText}
              >
                {idError}
              </Txt>
              <View style={styles.errorActions}>
                <Button
                  title={t("Try again")}
                  icon="refresh-cw"
                  onPress={runIdentify}
                  style={styles.flex}
                />
                <Button
                  title={t("What is it?")}
                  tone="secondary"
                  onPress={() => {
                    openEditor("");
                  }}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : (
            <View
              style={styles.identity}
              accessibilityLabel={t("Identifying…")}
            >
              <Txt variant="overline" color={Colors.accent}>
                {t("Identifying…")}
              </Txt>
              <Skeleton width="86%" height={30} />
              <Skeleton width="54%" height={30} />
              <Skeleton width="40%" height={16} style={{ marginTop: 4 }} />
            </View>
          )}

          {photo &&
          identity &&
          identity.kind !== "not_for_sale" &&
          identity.confidence < 60 ? (
            // Unsure: the fastest fix is a closer photo of the label or logo.
            <Animated.View
              entering={FadeInDown.duration(420)}
              style={styles.notice}
            >
              <Icon name="camera" size={16} color={Colors.trustMid} />
              <View style={styles.flex}>
                <Txt variant="calloutStrong">{t("Not sure yet")}</Txt>
                <Txt variant="callout" color={Colors.textSecondary}>
                  {t(
                    "Take a closer photo of the label, logo or tag and I'll pin down the exact model.",
                  )}
                </Txt>
                <Press
                  onPress={() => navigation.goBack()}
                  haptic
                  accessibilityRole="button"
                  style={styles.notRight}
                >
                  <Icon name="camera" size={14} color={Colors.accent} />
                  <Txt variant="calloutStrong" color={Colors.accent}>
                    {t("Take a closer photo")}
                  </Txt>
                </Press>
              </View>
            </Animated.View>
          ) : null}

          {matches.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(420).delay(80)}>
              <VisualMatches
                matches={matches}
                linkable={!identity?.regulated}
              />
            </Animated.View>
          ) : null}

          {identity?.kind === "not_for_sale" && priceState === "idle" ? (
            <View style={styles.notice}>
              <Icon name="info" size={16} color={Colors.textSecondary} />
              <View style={styles.flex}>
                <Txt variant="calloutStrong">
                  {t("Not something you buy in a shop")}
                </Txt>
                <Txt variant="callout" color={Colors.textSecondary}>
                  {t(
                    "Tap something else in the photo, or type what you're looking for.",
                  )}
                </Txt>
                {identity.searchQuery ? (
                  <Press
                    onPress={() => applyName(identity.searchQuery)}
                    haptic
                    accessibilityRole="button"
                    style={styles.notRight}
                  >
                    <Icon name="search" size={14} color={Colors.accent} />
                    <Txt variant="calloutStrong" color={Colors.accent}>
                      {identity.searchQuery}
                    </Txt>
                  </Press>
                ) : null}
              </View>
            </View>
          ) : null}

          {identity?.regulated ? (
            <View style={styles.notice}>
              <Icon name="slash" size={16} color={Colors.trustMid} />
              <View style={styles.flex}>
                <Txt variant="calloutStrong">{t("Age-restricted product")}</Txt>
                <Txt variant="callout" color={Colors.textSecondary}>
                  {t("Purchase links are hidden for age-restricted items.")}
                </Txt>
              </View>
            </View>
          ) : null}

          {identity && priceState === "loading" ? (
            <View
              style={styles.section}
              accessibilityLabel={t(
                "Finding prices in the US, Europe and Türkiye…",
              )}
            >
              <Txt variant="callout" color={Colors.textSecondary}>
                {t("Finding prices in the US, Europe and Türkiye…")}
              </Txt>
              <Skeleton width="100%" height={196} radius={Radius.xxl} />
              <View style={styles.tiles}>
                <Skeleton width="48%" height={128} radius={Radius.xl} />
                <Skeleton width="48%" height={128} radius={Radius.xl} />
              </View>
              <Skeleton width="100%" height={52} radius={Radius.lg} />
            </View>
          ) : null}

          {priceState === "error" ? (
            <View style={styles.errorCard}>
              <Icon name="wifi-off" size={20} color={Colors.trustLow} />
              <Txt variant="headline">{t("Couldn't load prices")}</Txt>
              <Txt
                variant="callout"
                color={Colors.textSecondary}
                style={styles.centerText}
              >
                {priceError}
              </Txt>
              <Button
                title={t("Try again")}
                icon="refresh-cw"
                onPress={() => identity && runPrices(identity)}
                style={styles.stretch}
              />
            </View>
          ) : null}

          {report && priceState === "done" ? (
            <>
              {picks?.recommended ? (
                <Animated.View
                  entering={FadeInDown.duration(460).springify().damping(18)}
                  style={styles.section}
                >
                  <RecommendedCard
                    offer={picks.recommended}
                    linkable={linkable}
                    local={picks.recommendedIsLocal}
                  />
                  {showSideTiles ? (
                    <View style={styles.tiles}>
                      {picks.cheapest ? (
                        <PickTile
                          label={t("Cheapest")}
                          icon="trending-down"
                          offer={picks.cheapest}
                          linkable={linkable}
                        />
                      ) : null}
                      {picks.safest ? (
                        <PickTile
                          label={t("Most trusted")}
                          icon="shield"
                          offer={picks.safest}
                          linkable={linkable}
                        />
                      ) : null}
                    </View>
                  ) : null}
                  {report.range ? (
                    <RangeBar range={report.range} count={report.sourceCount} />
                  ) : null}
                </Animated.View>
              ) : (
                <View style={styles.notice}>
                  <Icon
                    name={report.live ? "search" : "power"}
                    size={16}
                    color={Colors.textSecondary}
                  />
                  <View style={styles.flex}>
                    <Txt variant="calloutStrong">
                      {report.live
                        ? t("No live prices found")
                        : t("Price check is off")}
                    </Txt>
                    <Txt variant="callout" color={Colors.textSecondary}>
                      {report.live
                        ? t(
                            "Try a more specific name, or search the stores directly.",
                          )
                        : t(
                            "Add a SerpAPI key on the server to see live store prices. Search links still work.",
                          )}
                    </Txt>
                  </View>
                </View>
              )}

              {report.sourceCount === 0 ? (
                linkable ? (
                  <View style={styles.section}>
                    <Txt variant="title">{t("Search the stores")}</Txt>
                    <View style={styles.list}>
                      {report.markets.map((m, i) => (
                        <View key={m.market}>
                          {i > 0 ? <Divider inset={Spacing.lg} /> : null}
                          <Press
                            onPress={() => openStore(m.searchUrl)}
                            haptic
                            scale={0.985}
                            accessibilityRole="link"
                            style={styles.searchRow}
                          >
                            <Txt variant="bodyStrong" style={styles.flex}>
                              {t(m.market)}
                            </Txt>
                            <Txt variant="callout" color={Colors.textTertiary}>
                              Google Shopping
                            </Txt>
                            <Icon
                              name="arrow-up-right"
                              size={16}
                              color={Colors.textTertiary}
                            />
                          </Press>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null
              ) : (
                <Animated.View
                  entering={FadeIn.duration(500).delay(120)}
                  style={styles.section}
                >
                  <Txt variant="title">{t("Where it's sold")}</Txt>
                  <MarketTabs
                    markets={report.markets}
                    selected={market}
                    onSelect={(m) => {
                      setMarket(m);
                      setExpanded(false);
                    }}
                  />
                  <View style={styles.list}>
                    {shownOffers.length === 0 ? (
                      <View style={styles.emptyMarket}>
                        <Txt variant="callout" color={Colors.textTertiary}>
                          {t("No offers found here")}
                        </Txt>
                      </View>
                    ) : (
                      shownOffers.map((o, i) => (
                        <View key={o.id}>
                          {i > 0 ? <Divider inset={64} /> : null}
                          <OfferRow offer={o} linkable={linkable} />
                        </View>
                      ))
                    )}
                    {offers.length > ROWS_COLLAPSED ? (
                      <>
                        <Divider />
                        <Press
                          onPress={() => setExpanded((v) => !v)}
                          style={styles.listFoot}
                          haptic
                        >
                          <Icon
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={15}
                            color={Colors.textSecondary}
                          />
                          <Txt
                            variant="calloutStrong"
                            color={Colors.textSecondary}
                          >
                            {t("{n} offers", { n: offers.length })}
                          </Txt>
                        </Press>
                      </>
                    ) : null}
                    {selected && linkable ? (
                      <>
                        <Divider />
                        <Press
                          onPress={() => openStore(selected.searchUrl)}
                          haptic
                          accessibilityRole="link"
                          style={styles.listFoot}
                        >
                          <Icon
                            name="external-link"
                            size={14}
                            color={Colors.textSecondary}
                          />
                          <Txt
                            variant="calloutStrong"
                            color={Colors.textSecondary}
                          >
                            {t("Search on Google Shopping")}
                          </Txt>
                        </Press>
                      </>
                    ) : null}
                  </View>
                </Animated.View>
              )}

              {report.live && report.sourceCount > 0 ? (
                <Txt
                  variant="caption"
                  color={Colors.textTertiary}
                  style={styles.footnote}
                >
                  {t("Live prices from Google Shopping")} · {pricedAt}
                  {"\n"}
                  {t("Prices may change. Check the store before buying.")}
                </Txt>
              ) : null}
            </>
          ) : null}

          {identity && priceState !== "loading" ? (
            saved || past ? (
              <Button
                title={t("Refresh prices")}
                icon="refresh-cw"
                tone="secondary"
                onPress={() => {
                  refreshed.current = true;
                  void runPrices(identity);
                }}
              />
            ) : (
              <Button
                title={t("Scan again")}
                icon="camera"
                tone="secondary"
                onPress={() => navigation.goBack()}
              />
            )
          ) : null}
        </View>
      </Animated.ScrollView>

      <LinearGradient
        colors={["rgba(0,0,0,0.92)", "rgba(0,0,0,0.6)", "transparent"]}
        locations={[0, 0.6, 1]}
        style={[styles.topScrim, { height: insets.top + 84 }]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.compactBar, { height: insets.top + 60 }, barStyle]}
        pointerEvents="none"
      >
        <BlurView
          intensity={60}
          tint="systemChromeMaterialDark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.compactTitle, { paddingTop: insets.top }]}>
          <Txt variant="headline" numberOfLines={1}>
            {title}
          </Txt>
        </View>
        <View style={styles.compactLine} />
      </Animated.View>
      <View
        style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <IconButton
          icon={saved ? "chevron-left" : "x"}
          label={t("Cancel")}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.topRight}>
          {identity ? (
            <IconButton icon="share" label={t("Share")} onPress={onShare} />
          ) : null}
          {identity ? (
            <Press
              onPress={onSave}
              haptic
              scale={0.94}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={savedItemId ? t("Saved") : t("Save")}
            >
              <Glass
                interactive
                tint={savedItemId ? Colors.accent : undefined}
                style={styles.savePill}
              >
                <Icon
                  name={savedItemId ? "check" : "bookmark"}
                  size={16}
                  color={savedItemId ? Colors.textInverse : Colors.text}
                />
                <Txt
                  variant="calloutStrong"
                  color={savedItemId ? Colors.textInverse : Colors.text}
                >
                  {savedItemId ? t("Saved") : t("Save")}
                </Txt>
              </Glass>
            </Press>
          ) : null}
        </View>
      </View>

      <Modal
        visible={editing}
        transparent
        animationType="fade"
        onRequestClose={() => setEditing(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <Press
            style={StyleSheet.absoluteFill}
            scale={1}
            onPress={() => setEditing(false)}
            accessibilityLabel={t("Cancel")}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
            <Txt variant="title">{t("What is it?")}</Txt>
            <TextInput
              defaultValue={draft}
              onChangeText={(v) => {
                typed.current = v;
                const ok = v.trim().length >= 2;
                if (ok !== canApply) setCanApply(ok);
              }}
              placeholder={t("Type the product name, e.g. iPhone 15 Pro 256GB")}
              placeholderTextColor={Colors.textTertiary}
              style={styles.input}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => applyName(typed.current)}
              selectionColor={Colors.accent}
            />
            <Button
              title={t("Search prices")}
              icon="search"
              onPress={() => applyName(typed.current)}
              disabled={!canApply}
            />
            <Button
              title={t("Cancel")}
              tone="ghost"
              onPress={() => setEditing(false)}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  stretch: { alignSelf: "stretch" },
  centerText: { textAlign: "center" },
  hero: {
    width: "100%",
    backgroundColor: Colors.bg,
    overflow: "hidden",
  },
  body: {
    paddingHorizontal: Spacing.gutter,
    marginTop: -Spacing.xxxl,
    gap: Spacing.xxl,
  },
  identity: { gap: Spacing.sm },
  chips: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  notRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  alts: { gap: 6, marginTop: 2 },
  section: { gap: Spacing.md },
  tiles: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "space-between",
  },
  list: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  listFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md + 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 54,
  },
  emptyMarket: { paddingVertical: Spacing.xxl, alignItems: "center" },
  footnote: { textAlign: "center", lineHeight: 17 },
  notice: {
    flexDirection: "row",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  errorCard: {
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
  },
  errorActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignSelf: "stretch",
    marginTop: Spacing.sm,
  },
  topScrim: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  topRight: { flexDirection: "row", gap: Spacing.sm, alignItems: "center" },
  savePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: 22,
    overflow: "hidden",
  },
  productCard: {
    width: 190,
    height: 190,
    borderRadius: 36,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginTop: Spacing.xl,
  },
  productImage: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
  },
  heroEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  compactBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  // Sits between the close button and the share/save cluster.
  compactTitle: {
    flex: 1,
    justifyContent: "center",
    paddingLeft: 72,
    paddingRight: 196,
  },
  compactLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.line,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  input: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.lg,
    color: Colors.text,
    ...Fonts.medium,
    fontSize: 16,
  },
});
