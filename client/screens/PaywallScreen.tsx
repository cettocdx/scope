import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ScopeBackground } from "@/components/ScopeBackground";
import { useAuth } from "@/contexts/AuthContext";
import { FREE_DAILY_SCANS } from "@/lib/quota";
import {
  isPurchasesAvailable,
  getProPackages,
  purchasePackage,
  restorePurchases,
} from "@/services/purchasesService";

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;

type Pkg = import("react-native-purchases").PurchasesPackage;

const PRO_FEATURES = [
  { icon: "zap", text: "Unlimited scans — no daily cap" },
  { icon: "globe", text: "All 7 regions, every scan" },
  { icon: "trending-up", text: "Full price history & deal alerts" },
  { icon: "cloud", text: "Cross-device Vault sync" },
  { icon: "award", text: "Priority AI recognition" },
] as const;

export default function PaywallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isSignedIn, isPro, setProLocally, refresh } = useAuth();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const available = isPurchasesAvailable();

  useEffect(() => {
    (async () => {
      const pkgs = await getProPackages();
      setPackages(pkgs);
      if (pkgs[0]) setSelected(pkgs[0].identifier);
      setLoading(false);
    })();
  }, []);

  const buy = async () => {
    const pkg = packages.find((p) => p.identifier === selected);
    if (!pkg) return;
    setWorking(true);
    try {
      const ok = await purchasePackage(pkg);
      if (ok) {
        setProLocally(true);
        await refresh();
        Alert.alert("Welcome to Pro 🎉", "You now have unlimited scans.");
        navigation.goBack();
      }
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err?.userCancelled) {
        Alert.alert("Purchase failed", err?.message ?? "Please try again.");
      }
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
      Alert.alert(
        ok ? "Restored ✓" : "Nothing to restore",
        ok ? "Your Pro subscription is active." : "No previous purchase found.",
      );
      if (ok) navigation.goBack();
    } finally {
      setWorking(false);
    }
  };

  return (
    <ScopeBackground glowY={0.25}>
      <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="x" size={22} color={Colors.dark.textSecondary} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.crown}>
            <Feather name="award" size={28} color={Colors.dark.navyGlow ? "#FFD479" : "#FFD479"} />
          </View>
          <Text style={styles.title}>SCOPE Pro</Text>
          <Text style={styles.subtitle}>
            Free gives you {FREE_DAILY_SCANS} scans/day. Go unlimited.
          </Text>

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.text} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Feather name={f.icon as keyof typeof Feather.glyphMap} size={16} color={Colors.dark.accent} />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {isPro ? (
            <View style={styles.alreadyPro}>
              <Feather name="check-circle" size={18} color={Colors.dark.successGreen} />
              <Text style={styles.alreadyProText}>You're on Pro. Thank you! 💙</Text>
            </View>
          ) : loading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.dark.accent} />
          ) : !available || packages.length === 0 ? (
            <View style={styles.unavailable}>
              <Feather name="info" size={16} color={Colors.dark.warningYellow} />
              <Text style={styles.unavailableText}>
                {available
                  ? "No subscription products configured yet."
                  : "In-app purchases require the full app build (not Expo Go)."}
              </Text>
            </View>
          ) : (
            <View style={styles.packages}>
              {packages.map((p) => {
                const isSel = p.identifier === selected;
                return (
                  <TouchableOpacity
                    key={p.identifier}
                    style={[styles.pkg, isSel && styles.pkgSelected]}
                    onPress={() => setSelected(p.identifier)}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSel }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pkgTitle}>{p.product.title || p.identifier}</Text>
                      <Text style={styles.pkgSub}>{p.product.description}</Text>
                    </View>
                    <Text style={styles.pkgPrice}>{p.product.priceString}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>

        {!isPro && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            {!isSignedIn && (
              <TouchableOpacity onPress={() => navigation.navigate("Auth")} style={styles.signInHint}>
                <Feather name="info" size={13} color={Colors.dark.accentIce} />
                <Text style={styles.signInHintText}>
                  Sign in first so Pro follows you across devices.
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.cta, (!available || packages.length === 0 || working) && styles.ctaDisabled]}
              onPress={buy}
              disabled={!available || packages.length === 0 || working}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Subscribe to Pro"
            >
              {working ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.ctaText}>Start Pro</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={restore} disabled={working} style={styles.restore}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing["2xl"] },
  closeButton: { alignSelf: "flex-end", padding: Spacing.sm },
  scroll: { paddingBottom: Spacing.xl },
  crown: { alignSelf: "center", marginTop: Spacing.lg },
  title: {
    fontSize: 34,
    color: Colors.dark.text,
    fontFamily: Fonts?.black,
    textAlign: "center",
    marginTop: Spacing.md,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.sans,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  features: { marginTop: Spacing["3xl"], gap: Spacing.lg },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: Typography.body.fontSize,
    color: Colors.dark.text,
    fontFamily: Fonts?.sans,
  },
  packages: { marginTop: Spacing["3xl"], gap: Spacing.md },
  pkg: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.dark.cardBorder,
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  pkgSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accentTint,
  },
  pkgTitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.dark.text,
    fontFamily: Fonts?.semibold,
    fontWeight: "700",
  },
  pkgSub: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.sans,
    marginTop: 2,
  },
  pkgPrice: {
    fontSize: Typography.h4.fontSize,
    color: Colors.dark.accentIce,
    fontFamily: Fonts?.bold,
    fontWeight: "700",
  },
  alreadyPro: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    justifyContent: "center",
    marginTop: Spacing["3xl"],
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.dark.successTint,
  },
  alreadyProText: {
    color: Colors.dark.successGreen,
    fontFamily: Fonts?.semibold,
    fontSize: Typography.body.fontSize,
  },
  unavailable: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
    marginTop: Spacing["3xl"],
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(250, 204, 21, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.25)",
  },
  unavailableText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.sans,
  },
  footer: { marginTop: Spacing.md },
  signInHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  signInHintText: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.accentIce,
    fontFamily: Fonts?.sans,
  },
  cta: {
    height: Spacing.buttonHeight,
    backgroundColor: Colors.dark.accent,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.bold,
    fontSize: Typography.h4.fontSize,
  },
  restore: { alignSelf: "center", marginTop: Spacing.md, padding: Spacing.sm },
  restoreText: {
    fontSize: Typography.small.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.sans,
  },
});
