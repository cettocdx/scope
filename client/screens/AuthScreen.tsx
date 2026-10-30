import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Icon } from "@/components/Icon";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Button, IconButton, Txt } from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "@/lib/i18n";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

// Google needs a client id for the platform it runs on.
const GOOGLE_CONFIGURED = Boolean(
  Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  }),
);

/**
 * Google's auth hook throws when no client id exists for this platform, so it
 * lives in its own component that only renders when Google is configured.
 */
function GoogleButton({
  busy,
  setBusy,
  onDone,
}: {
  busy: null | "apple" | "google";
  setBusy: (b: null | "apple" | "google") => void;
  onDone: () => void;
}) {
  const { completeGoogleSignIn } = useAuth();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken =
        response.params?.id_token ?? response.authentication?.idToken;
      if (idToken) {
        completeGoogleSignIn(idToken)
          .then(onDone)
          .catch((e) =>
            Alert.alert(t("Sign-in failed"), String(e?.message ?? e)),
          )
          .finally(() => setBusy(null));
      } else {
        setBusy(null);
      }
    } else if (response) {
      setBusy(null);
    }
  }, [completeGoogleSignIn, onDone, response, setBusy]);

  return (
    <Button
      title={t("Continue with Google")}
      tone="secondary"
      onPress={async () => {
        setBusy("google");
        try {
          await promptAsync();
        } catch {
          setBusy(null);
        }
      }}
      loading={busy === "google"}
      disabled={!request || busy !== null}
    />
  );
}

export default function AuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { appleAvailable, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<null | "apple" | "google">(null);

  const handleApple = async () => {
    setBusy("apple");
    try {
      await signInWithApple();
      navigation.goBack();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert(t("Sign-in failed"), err?.message ?? "");
      }
    } finally {
      setBusy(null);
    }
  };

  const nothingAvailable =
    !(Platform.OS === "ios" && appleAvailable) && !GOOGLE_CONFIGURED;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop:
            Platform.OS === "ios" ? Spacing.lg : insets.top + Spacing.sm,
          paddingBottom: insets.bottom + Spacing.xl,
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

      <View style={styles.hero}>
        <View style={styles.icon}>
          <Icon name="cloud" size={24} color={Colors.accent} />
        </View>
        <Txt variant="display" style={styles.center} accessibilityRole="header">
          {t("Your saved items, on every device.")}
        </Txt>
        <Txt variant="body" color={Colors.textSecondary} style={styles.center}>
          {t("Sync saved items across devices.")}
        </Txt>
      </View>

      <View style={styles.actions}>
        {Platform.OS === "ios" && appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={Radius.lg}
            style={styles.apple}
            onPress={handleApple}
          />
        ) : null}
        {GOOGLE_CONFIGURED ? (
          <GoogleButton
            busy={busy}
            setBusy={setBusy}
            onDone={() => navigation.goBack()}
          />
        ) : null}
        {nothingAvailable ? (
          <View style={styles.notice}>
            <Icon name="info" size={16} color={Colors.trustMid} />
            <Txt
              variant="callout"
              color={Colors.textSecondary}
              style={{ flex: 1 }}
            >
              {t("Sign-in needs a development build.")}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: "space-between",
  },
  header: { paddingHorizontal: Spacing.lg, flexDirection: "row" },
  hero: {
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  center: { textAlign: "center" },
  actions: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  apple: { height: 54, width: "100%" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
});
