import React, { useEffect, useState } from "react";
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { Colors } from "@/constants/theme";
import { hasOnboarded } from "@/lib/onboarding";

// Bridge React Native's AppState into React Query's focus manager so queries
// refresh when the app returns to the foreground (RN has no window focus event).
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.bg,
    card: Colors.bg,
    primary: Colors.accent,
  },
};

export default function App() {
  // First launch opens on the intro; afterwards straight on the camera.
  const [firstRoute, setFirstRoute] = useState<"Onboarding" | "Scan" | null>(
    null,
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    hasOnboarded().then((done) => setFirstRoute(done ? "Scan" : "Onboarding"));
    return () => subscription.remove();
  }, []);

  // Hold on the dark canvas until we know which screen opens first.
  if (!firstRoute) {
    return <View style={styles.splash} />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView style={styles.root}>
                <KeyboardProvider>
                  <NavigationContainer theme={navTheme}>
                    <RootStackNavigator initialRouteName={firstRoute} />
                  </NavigationContainer>
                  <StatusBar style="light" />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
});
