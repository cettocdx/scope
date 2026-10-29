import React, { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Icon } from "@/components/Icon";

import { Colors, Radius, Spacing } from "@/constants/theme";
import {
  Button,
  Divider,
  IconButton,
  notify,
  Press,
  select,
  tap,
  Txt,
} from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  useAddAsset,
  usePortfolio,
  useRemoveAsset,
} from "@/hooks/usePortfolio";
import { useSettings } from "@/contexts/SettingsContext";
import { imageSource } from "@/lib/image-store";
import { bestPriceOf, savedItemFrom } from "@/lib/saved";
import {
  clearHistory,
  removeHistory,
  useHistory,
  type HistoryEntry,
} from "@/lib/history";
import {
  fetchPrices,
  identityFromName,
  pricesRequestFor,
  titleFor,
} from "@/services/scanService";
import { LOCALE, t } from "@/lib/i18n";
import type { SavedItem } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "Saved">;
type Tab = "saved" | "history";

/** Long press: the short menu a row in Apple's own lists offers. */
function rowMenu(
  title: string,
  actions: { label: string; destructive?: boolean; run: () => void }[],
): void {
  tap("medium");
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), t("Cancel")],
        cancelButtonIndex: actions.length,
        destructiveButtonIndex: actions.findIndex((a) => a.destructive),
      },
      (i) => actions[i]?.run(),
    );
  } else {
    Alert.alert(title, undefined, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ("destructive" as const) : undefined,
        onPress: a.run,
      })),
      { text: t("Cancel"), style: "cancel" as const },
    ]);
  }
}

function Thumb({ uri }: { uri?: string }) {
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <Icon name="package" size={20} color={Colors.textTertiary} />
      )}
    </View>
  );
}

/** How the recommended price moved since the item was saved; green = cheaper. */
function Trend({ pct }: { pct: number }) {
  if (!pct || Math.abs(pct) < 0.5) return null;
  const down = pct < 0;
  const color = down ? Colors.trustHigh : Colors.trustLow;
  const n = Math.abs(pct).toFixed(1);
  return (
    <View
      style={[
        styles.trend,
        { backgroundColor: down ? Colors.trustHighTint : Colors.trustLowTint },
      ]}
      accessibilityLabel={
        down
          ? t("Cheaper by {n}% since saved", { n })
          : t("Pricier by {n}% since saved", { n })
      }
    >
      <Icon
        name={down ? "trending-down" : "trending-up"}
        size={11}
        color={color}
      />
      <Txt variant="caption" color={color}>
        {`${n}%`}
      </Txt>
    </View>
  );
}

function SavedRow({
  item,
  onOpen,
  onMenu,
}: {
  item: SavedItem;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const { formatUSD } = useSettings();
  const best = bestPriceOf(item);
  const date = new Date(item.dateAdded).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });
  return (
    <Press
      onPress={onOpen}
      onLongPress={onMenu}
      haptic
      scale={0.985}
      accessibilityRole="button"
      accessibilityLabel={item.itemName}
      style={styles.row}
    >
      <Thumb uri={imageSource(item, { thumbnail: true })} />
      <View style={styles.rowMiddle}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {item.identity ? titleFor(item.identity) : item.itemName}
        </Txt>
        <Txt variant="footnote" color={Colors.textTertiary} numberOfLines={1}>
          {best?.store ? `${best.store} · ${date}` : date}
        </Txt>
      </View>
      <View style={styles.rowPrice}>
        {best ? (
          <>
            <Txt variant="price">{formatUSD(best.usd)}</Txt>
            <Trend pct={item.trendPercentage} />
          </>
        ) : (
          <Txt variant="callout" color={Colors.textTertiary}>
            —
          </Txt>
        )}
      </View>
    </Press>
  );
}

function HistoryRow({
  entry,
  onOpen,
  onMenu,
}: {
  entry: HistoryEntry;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const { formatUSD } = useSettings();
  const rec = entry.report?.picks.recommended;
  const when = new Date(entry.date).toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Press
      onPress={onOpen}
      onLongPress={onMenu}
      haptic
      scale={0.985}
      accessibilityRole="button"
      accessibilityLabel={entry.identity.name}
      style={styles.row}
    >
      <Thumb uri={entry.thumbnailUri ?? entry.imageUri} />
      <View style={styles.rowMiddle}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {titleFor(entry.identity)}
        </Txt>
        <Txt variant="footnote" color={Colors.textTertiary} numberOfLines={1}>
          {rec ? `${rec.store} · ${when}` : when}
        </Txt>
      </View>
      {rec ? <Txt variant="price">{formatUSD(rec.priceUSD)}</Txt> : null}
    </Press>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { key: Tab; label: string }[] = [
    { key: "saved", label: t("Saved items") },
    { key: "history", label: t("History") },
  ];
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <Press
            key={it.key}
            scale={0.98}
            onPress={() => {
              if (!active) select();
              onChange(it.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Txt variant="subheadStrong">{it.label}</Txt>
          </Press>
        );
      })}
    </View>
  );
}

function Empty({
  icon,
  title,
  body,
  onScan,
}: {
  icon: "bookmark" | "clock";
  title: string;
  body: string;
  onScan: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={Colors.textSecondary} />
      </View>
      <Txt variant="title3">{title}</Txt>
      <Txt variant="subhead" color={Colors.textSecondary} style={styles.center}>
        {body}
      </Txt>
      <Button
        title={t("Scan again")}
        icon="camera"
        onPress={onScan}
        style={styles.emptyButton}
      />
    </Animated.View>
  );
}

export default function SavedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { assets } = usePortfolio();
  const history = useHistory();
  const remove = useRemoveAsset();
  const addAsset = useAddAsset();
  const { homeMarket } = useSettings();
  const [tab, setTab] = useState<Tab>("saved");
  const [refreshing, setRefreshing] = useState(false);

  const confirmRemove = (item: SavedItem) =>
    Alert.alert(t("Remove this item?"), item.itemName, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: () => remove.mutate(item.id),
      },
    ]);

  // Pull to refresh: re-price every saved item; the trend chip shows the move.
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      for (const item of assets) {
        const identity = item.identity ?? identityFromName(item.itemName);
        try {
          const report = await fetchPrices(
            pricesRequestFor(identity, homeMarket),
          );
          await addAsset.mutateAsync(
            savedItemFrom({
              id: item.id,
              identity,
              report,
              dateAdded: item.dateAdded,
              image: {
                imageUri: item.imageUri,
                thumbnailUri: item.thumbnailUri,
              },
              previous: item,
            }),
          );
        } catch {
          // One failing item shouldn't stop the rest.
        }
      }
      notify();
    } finally {
      setRefreshing(false);
    }
  }, [addAsset, assets, homeMarket]);

  const openSaved = (id: string) =>
    navigation.navigate("Result", { savedId: id });
  const openPast = (id: string) =>
    navigation.navigate("Result", { historyId: id });

  const header = (
    <View style={styles.headerBlock}>
      <Txt variant="largeTitle" accessibilityRole="header">
        {tab === "saved" ? t("Saved items") : t("History")}
      </Txt>
      <Segmented value={tab} onChange={setTab} />
      {tab === "saved" && assets.length > 0 ? (
        <Txt variant="footnote" color={Colors.textTertiary}>
          {t("Pull down to refresh every price.")}
        </Txt>
      ) : null}
      {tab === "history" && history.length > 0 ? (
        <Press
          onPress={() =>
            Alert.alert(t("Clear history?"), undefined, [
              { text: t("Cancel"), style: "cancel" },
              {
                text: t("Clear"),
                style: "destructive",
                onPress: clearHistory,
              },
            ])
          }
          style={styles.clear}
          accessibilityRole="button"
        >
          <Txt variant="subhead" color={Colors.accent}>
            {t("Clear history")}
          </Txt>
        </Press>
      ) : null}
    </View>
  );

  const cellStyle = (index: number, count: number) => [
    styles.cell,
    index === 0 && styles.cellFirst,
    index === count - 1 && styles.cellLast,
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.nav}>
        <IconButton
          icon="chevron-left"
          label={t("Cancel")}
          onPress={() => navigation.goBack()}
        />
      </View>
      {tab === "saved" ? (
        <FlatList
          key="saved"
          data={assets}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          ListHeaderComponent={header}
          refreshControl={
            assets.length > 0 ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refreshAll}
                tintColor={Colors.textSecondary}
              />
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <Animated.View
              layout={LinearTransition}
              style={cellStyle(index, assets.length)}
            >
              {index > 0 ? <Divider inset={72} /> : null}
              <SavedRow
                item={item}
                onOpen={() => openSaved(item.id)}
                onMenu={() =>
                  rowMenu(item.itemName, [
                    { label: t("Open"), run: () => openSaved(item.id) },
                    {
                      label: t("Remove"),
                      destructive: true,
                      run: () => confirmRemove(item),
                    },
                  ])
                }
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <Empty
              icon="bookmark"
              title={t("Nothing saved yet")}
              body={t("Scan something and tap Save to keep its prices here.")}
              onScan={() => navigation.goBack()}
            />
          }
        />
      ) : (
        <FlatList
          key="history"
          data={history}
          keyExtractor={(e) => e.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <Animated.View
              layout={LinearTransition}
              style={cellStyle(index, history.length)}
            >
              {index > 0 ? <Divider inset={72} /> : null}
              <HistoryRow
                entry={item}
                onOpen={() => openPast(item.id)}
                onMenu={() =>
                  rowMenu(item.identity.name, [
                    { label: t("Open"), run: () => openPast(item.id) },
                    {
                      label: t("Remove"),
                      destructive: true,
                      run: () => removeHistory(item.id),
                    },
                  ])
                }
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <Empty
              icon="clock"
              title={t("No scans yet")}
              body={t("Every scan shows up here, even if you don't save it.")}
              onScan={() => navigation.goBack()}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  nav: { paddingHorizontal: Spacing.lg, flexDirection: "row" },
  list: { paddingHorizontal: Spacing.lg, flexGrow: 1 },
  headerBlock: {
    gap: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  clear: { alignSelf: "flex-start" },
  segmented: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: Colors.surfacePressed,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  cell: { backgroundColor: Colors.surface, paddingHorizontal: Spacing.md },
  cellFirst: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  cellLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMiddle: { flex: 1, gap: 3 },
  rowPrice: { alignItems: "flex-end", gap: 4 },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingBottom: 80,
    paddingTop: Spacing.huge,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center", paddingHorizontal: Spacing.xl },
  emptyButton: { alignSelf: "stretch", marginTop: Spacing.md },
});
