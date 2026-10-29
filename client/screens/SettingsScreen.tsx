import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Divider, IconButton, Press, Txt } from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { DISPLAY_CURRENCIES, useSettings } from "@/contexts/SettingsContext";
import { quotaStatus } from "@/lib/quota";
import { setOnboarded } from "@/lib/onboarding";
import { t } from "@/lib/i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
  GBP: "£",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Txt
        variant="overline"
        color={Colors.textTertiary}
        style={styles.sectionTitle}
      >
        {title}
      </Txt>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function LinkRow({
  icon,
  label,
  detail,
  value,
  onPress,
  tone,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  /** Secondary line under the label. */
  detail?: string;
  /** Short value on the right. */
  value?: string;
  onPress?: () => void;
  tone?: "accent";
}) {
  const content = (
    <>
      <Feather
        name={icon}
        size={18}
        color={tone === "accent" ? Colors.accent : Colors.textSecondary}
      />
      <View style={styles.flex}>
        <Txt
          variant="bodyStrong"
          color={tone === "accent" ? Colors.accent : Colors.text}
        >
          {label}
        </Txt>
        {detail ? (
          <Txt variant="callout" color={Colors.textTertiary}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="bodyStrong" color={Colors.textSecondary}>
          {value}
        </Txt>
      ) : null}
      {onPress ? (
        <Feather name="chevron-right" size={18} color={Colors.textTertiary} />
      ) : null}
    </>
  );
  return onPress ? (
    <Press
      onPress={onPress}
      scale={0.99}
      haptic
      style={styles.row}
      accessibilityRole="button"
    >
      {content}
    </Press>
  ) : (
    <View style={styles.row} accessible>
      {content}
    </View>
  );
}

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { currency, setCurrency } = useSettings();
  const { isPro, isSignedIn, user, signOut } = useAuth();
  const [left, setLeft] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      quotaStatus()
        .then((q) => setLeft(q.remaining))
        .catch(() => {});
    }, []),
  );

  const version = Constants.expoConfig?.version ?? "";

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
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
        <Txt variant="display" accessibilityRole="header">
          {t("Settings")}
        </Txt>

        <Section title={t("Show prices in")}>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {DISPLAY_CURRENCIES.map((c) => {
              const active = c === currency;
              return (
                <Press
                  key={c}
                  onPress={() => setCurrency(c)}
                  haptic
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={c}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <Txt
                    variant="headline"
                    color={active ? Colors.textInverse : Colors.text}
                  >
                    {CURRENCY_SYMBOL[c]}
                  </Txt>
                  <Txt
                    variant="caption"
                    color={active ? "rgba(10,10,11,0.6)" : Colors.textTertiary}
                  >
                    {c}
                  </Txt>
                </Press>
              );
            })}
          </View>
        </Section>

        <Section title={t("SCOPE Pro")}>
          <LinkRow
            icon="activity"
            label={t("Scans left today")}
            value={isPro ? t("Unlimited") : left === null ? "…" : String(left)}
          />
          <Divider inset={48} />
          {isPro ? (
            <LinkRow icon="check-circle" label={t("You're on Pro")} />
          ) : (
            <LinkRow
              icon="zap"
              label={t("Get Pro")}
              tone="accent"
              onPress={() => navigation.navigate("Paywall")}
            />
          )}
        </Section>

        <Section title={t("Account")}>
          {isSignedIn ? (
            <>
              <LinkRow
                icon="user"
                label={t("Signed in as {name}", {
                  name: user?.displayName || user?.email || "SCOPE",
                })}
              />
              <Divider inset={48} />
              <LinkRow
                icon="log-out"
                label={t("Sign out")}
                onPress={() => void signOut()}
              />
            </>
          ) : (
            <LinkRow
              icon="log-in"
              label={t("Sign in")}
              detail={t("Sync saved items across devices.")}
              onPress={() => navigation.navigate("Auth")}
            />
          )}
        </Section>

        <Section title={t("About")}>
          <LinkRow
            icon="play-circle"
            label={t("Show the intro again")}
            onPress={async () => {
              await setOnboarded(false);
              navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
            }}
          />
          <Divider inset={48} />
          <View style={styles.about}>
            <Txt variant="callout" color={Colors.textSecondary}>
              {t("Live prices from Google Shopping")}.{" "}
              {t("Prices are for guidance only.")}
            </Txt>
            <Txt variant="caption" color={Colors.textTertiary}>
              SCOPE · {t("Version {v}", { v: version })}
            </Txt>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, flexDirection: "row" },
  scroll: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.lg,
    gap: Spacing.xxl,
  },
  section: { gap: Spacing.sm },
  sectionTitle: { paddingHorizontal: Spacing.xs },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    minHeight: 54,
    paddingVertical: Spacing.md,
  },
  segment: { flexDirection: "row", padding: 4, gap: 4 },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
  },
  segmentActive: { backgroundColor: Colors.text },
  about: { padding: Spacing.lg, gap: Spacing.sm },
});
