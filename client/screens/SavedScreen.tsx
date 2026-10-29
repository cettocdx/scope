import React from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Button, Divider, IconButton, Press, Txt } from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { usePortfolio, useRemoveAsset } from "@/hooks/usePortfolio";
import { useSettings } from "@/contexts/SettingsContext";
import { imageSource } from "@/lib/image-store";
import { bestPriceOf } from "@/lib/saved";
import { titleFor } from "@/services/scanService";
import { LOCALE, t } from "@/lib/i18n";
import type { SavedItem } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "Saved">;

function Row({
  item,
  onOpen,
  onRemove,
}: {
  item: SavedItem;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { formatUSD } = useSettings();
  const best = bestPriceOf(item);
  const thumb = imageSource(item, { thumbnail: true });
  const date = new Date(item.dateAdded).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
  });
  return (
    <Press
      onPress={onOpen}
      onLongPress={onRemove}
      haptic
      scale={0.985}
      accessibilityRole="button"
      accessibilityLabel={item.itemName}
      accessibilityHint={t("Remove this item?")}
      style={styles.row}
    >
      <View style={styles.thumb}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Feather name="package" size={20} color={Colors.textTertiary} />
        )}
      </View>
      <View style={styles.rowMiddle}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {item.identity ? titleFor(item.identity) : item.itemName}
        </Txt>
        <Txt variant="caption" color={Colors.textTertiary} numberOfLines={1}>
          {best?.store ? `${best.store} · ${date}` : date}
        </Txt>
      </View>
      <View style={styles.rowPrice}>
        {best ? (
          <>
            <Txt variant="caption" color={Colors.textTertiary}>
              {t("Best price")}
            </Txt>
            <Txt variant="price">{formatUSD(best.usd)}</Txt>
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

export default function SavedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { assets } = usePortfolio();
  const remove = useRemoveAsset();

  const confirmRemove = (item: SavedItem) =>
    Alert.alert(t("Remove this item?"), item.itemName, [
      { text: t("Cancel"), style: "cancel" },
      {
        text: t("Remove"),
        style: "destructive",
        onPress: () => remove.mutate(item.id),
      },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          label={t("Cancel")}
          tone="surface"
          onPress={() => navigation.goBack()}
        />
      </View>
      <FlatList
        data={assets}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{
          paddingHorizontal: Spacing.gutter,
          paddingBottom: insets.bottom + Spacing.xxl,
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <Txt
            variant="display"
            style={styles.title}
            accessibilityRole="header"
          >
            {t("Saved items")}
          </Txt>
        }
        ItemSeparatorComponent={() => <Divider inset={76} />}
        renderItem={({ item }) => (
          <Row
            item={item}
            onOpen={() => navigation.navigate("Result", { savedId: item.id })}
            onRemove={() => confirmRemove(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="bookmark" size={24} color={Colors.textSecondary} />
            </View>
            <Txt variant="title">{t("Nothing saved yet")}</Txt>
            <Txt
              variant="body"
              color={Colors.textSecondary}
              style={styles.centerText}
            >
              {t("Scan something and tap Save to keep its prices here.")}
            </Txt>
            <Button
              title={t("Scan again")}
              icon="camera"
              onPress={() => navigation.goBack()}
              style={styles.emptyButton}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: Spacing.lg, flexDirection: "row" },
  title: { marginTop: Spacing.lg, marginBottom: Spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  thumb: {
    width: 62,
    height: 62,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowMiddle: { flex: 1, gap: 3 },
  rowPrice: { alignItems: "flex-end", gap: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { textAlign: "center", paddingHorizontal: Spacing.xl },
  emptyButton: { alignSelf: "stretch", marginTop: Spacing.md },
});
