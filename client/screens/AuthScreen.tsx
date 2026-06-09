import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ScopeBackground } from "@/components/ScopeBackground";
import { useAuth } from "@/contexts/AuthContext";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, "Auth">;

export default function AuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { appleAvailable, signInWithApple, completeGoogleSignIn } = useAuth();
  const [busy, setBusy] = useState<null | "apple" | "google">(null);

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
          .then(() => navigation.goBack())
          .catch((e) => Alert.alert("Sign-in failed", String(e?.message ?? e)))
          .finally(() => setBusy(null));
      } else {
        setBusy(null);
      }
    } else if (response) {
      // cancel / dismiss / error — clear the spinner.
      setBusy(null);
    }
  }, [response]);

  const handleApple = async () => {
    setBusy("apple");
    try {
      await signInWithApple();
      navigation.goBack();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      // The user cancelling the native sheet is not an error worth alerting.
      if (err?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign-in failed", err?.message ?? "Could not sign in with Apple");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy("google");
    try {
      await promptAsync();
    } catch {
      setBusy(null);
    }
  };

  return (
    <ScopeBackground glowY={0.35}>
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

        <View style={styles.hero}>
          <Text style={styles.wordmark}>SCOPE</Text>
          <Text style={styles.tagline}>Sync your Vault across every device.</Text>
        </View>

        <View style={styles.benefits}>
          {[
            "Your Vault on all your devices",
            "Never lose a saved item",
            "Unlock Pro: unlimited scans",
          ].map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Feather name="check" size={16} color={Colors.dark.accent} />
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {Platform.OS === "ios" && appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={BorderRadius.lg}
              style={styles.appleButton}
              onPress={handleApple}
            />
          )}

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogle}
            disabled={!request || busy !== null}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {busy === "google" ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="chrome" size={18} color="#000" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {busy === "apple" && (
            <ActivityIndicator style={{ marginTop: Spacing.md }} color={Colors.dark.accent} />
          )}

          <Text style={styles.legal}>
            By continuing you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing["2xl"] },
  closeButton: { alignSelf: "flex-end", padding: Spacing.sm },
  hero: { marginTop: Spacing["4xl"], alignItems: "center" },
  wordmark: {
    fontSize: 40,
    color: Colors.dark.text,
    fontFamily: Fonts?.black,
    letterSpacing: 4,
  },
  tagline: {
    marginTop: Spacing.md,
    fontSize: Typography.body.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.sans,
    textAlign: "center",
  },
  benefits: { marginTop: Spacing["4xl"], gap: Spacing.lg, alignSelf: "center" },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  benefitText: {
    fontSize: Typography.body.fontSize,
    color: Colors.dark.text,
    fontFamily: Fonts?.sans,
  },
  actions: { marginTop: "auto", gap: Spacing.md },
  appleButton: { height: 52, width: "100%" },
  googleButton: {
    height: 52,
    backgroundColor: "#FFF",
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  googleButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.semibold,
    fontSize: Typography.body.fontSize,
  },
  legal: {
    fontSize: 11,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.sans,
    textAlign: "center",
    marginTop: Spacing.md,
  },
});
