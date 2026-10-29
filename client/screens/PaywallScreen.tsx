import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, Radius, Spacing, READABLE } from "@/constants/theme";
import { Button, IconButton, Press, Txt, type IconName } from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { FREE_DAILY_SCANS } from "@/lib/quota";
import { t, type StringKey } from "@/lib/i18n";
import {
  isPurchasesAvailable,
  getProPackages,
  purchasePackage,
  restorePurchases,
} from "@/services/purchasesService";

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;
type Pkg = import("react-native-purchases").PurchasesPackage;

const HERO = require("../../assets/images/pro-hero.jpg");

const FEATURES: { icon: IconName; title: StringKey; body: StringKey }[] = [
  {
    icon: "zap",
    title: "Unlimited scans",
    body: "Scan as many products as you like, every day.",
  },
  {
    icon: "globe",
    title: "Every market, every scan",
    body: "US, Europe and Türkiye prices side by side.",
  },
  {
    icon: "heart",
    title: "Supports live price search",
    body: "Each scan runs paid AI and shopping searches.",
  },
];

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isPro, setProLocally, refresh } = useAuth();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const available = isPurchasesAvailable();

  useEffect(() => {
    getProPackages()
      .then((pkgs) => {
        setPackages(pkgs);
        if (pkgs[0]) setSelected(pkgs[0].identifier);
      })
      .finally(() => setLoading(false));
  }, []);

  const buy = async () => {
    const pkg = packages.find((p) => p.identifier === selected);
    if (!pkg) return;
    setWorking(true);
    try {
      if (await purchasePackage(pkg)) {
        setProLocally(true);
        await refresh();
        Alert.alert(t("Welcome to Pro"));
        navigation.goBack();
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled)
        Alert.alert(
          t("Purchase failed"),
          err?.message ?? t("Please try again."),
        );
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    setWorking(true);
    try {
      const ok = await restorePurchases();
      setProLocally(ok);
      await refresh();
      Alert.alert(ok ? t("Restored") : t("Nothing to restore"));
      if (ok) navigation.goBack();
    } finally {
      setWorking(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop:
            Platform.OS === "ios" ? Spacing.lg : insets.top + Spacing.sm,
        },
      ]}
    >
      <View style={styles.header}>
        <IconButton
          icon="x"
          label={t("Close")}
          tone="surface"
          onPress={() => navigation.goBack()}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
      >
        <View style={styles.hero}>
          <Image
            source={HERO}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
          />
          <LinearGradient
            colors={["transparent", Colors.bg]}
            locations={[0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <Txt variant="overline" color={Colors.accent}>
          {t("SCOPE Pro")}
        </Txt>
        <Txt variant="display" accessibilityRole="header">
          {t("Unlimited scans, every day.")}
        </Txt>
        <Txt variant="body" color={Colors.textSecondary}>
          {t("Free includes {n} scans a day.", { n: FREE_DAILY_SCANS })}
        </Txt>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <View style={styles.featureIcon}>
                <Icon name={f.icon} size={16} color={Colors.accent} />
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">{t(f.title)}</Txt>
                <Txt variant="callout" color={Colors.textSecondary}>
                  {t(f.body)}
                </Txt>
              </View>
            </View>
          ))}
        </View>

        {isPro ? (
          <View style={styles.notice}>
            <Icon name="check-circle" size={18} color={Colors.trustHigh} />
            <Txt variant="bodyStrong">{t("You're on Pro")}</Txt>
          </View>
        ) : loading ? (
          <ActivityIndicator
            color={Colors.accent}
            style={{ marginTop: Spacing.xl }}
          />
        ) : !available || packages.length === 0 ? (
          <View style={styles.notice}>
            <Icon name="info" size={16} color={Colors.trustMid} />
            <Txt
              variant="callout"
              color={Colors.textSecondary}
              style={styles.flex}
            >
              {available
                ? t("Subscription products aren't set up yet.")
                : t("Subscriptions aren't available in this build.")}
            </Txt>
          </View>
        ) : (
          <View style={styles.packages}>
            {packages.map((p) => {
              const active = p.identifier === selected;
              return (
                <Press
                  key={p.identifier}
                  onPress={() => setSelected(p.identifier)}
                  haptic
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.pkg, active && styles.pkgActive]}
                >
                  <View style={styles.flex}>
                    <Txt variant="bodyStrong">
                      {p.product.title || p.identifier}
                    </Txt>
                    {p.product.description ? (
                      <Txt variant="caption" color={Colors.textTertiary}>
                        {p.product.description}
                      </Txt>
                    ) : null}
                  </View>
                  <Txt variant="price">{p.product.priceString}</Txt>
                </Press>
              );
            })}
            <Button title={t("Get Pro")} onPress={buy} loading={working} />
          </View>
        )}

        {available && !isPro ? (
          <Button
            title={t("Restore purchases")}
            tone="ghost"
            onPress={restore}
            disabled={working}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, flexDirection: "row" },
  scroll: {
    ...READABLE,
    paddingHorizontal: Spacing.gutter,
    gap: Spacing.md,
  },
  hero: {
    height: 260,
    marginHorizontal: -Spacing.gutter,
    marginTop: -Spacing.md,
  },
  features: { gap: Spacing.lg, marginVertical: Spacing.xl },
  feature: { flexDirection: "row", gap: Spacing.md, alignItems: "flex-start" },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
  packages: { gap: Spacing.md },
  pkg: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  pkgActive: { borderColor: Colors.accent },
});
