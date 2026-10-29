import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import OnboardingScreen from "@/screens/OnboardingScreen";
import ScanScreen from "@/screens/ScanScreen";
import ResultScreen from "@/screens/ResultScreen";
import SavedScreen from "@/screens/SavedScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import AuthScreen from "@/screens/AuthScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import { Colors } from "@/constants/theme";

export type RootStackParamList = {
  Onboarding: undefined;
  Scan: undefined;
  /** Either a fresh scan (photo held in scan-session) or a saved item. */
  Result: { scanId?: string; savedId?: string };
  Saved: undefined;
  Settings: undefined;
  Auth: undefined;
  Paywall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator({
  initialRouteName = "Scan",
}: {
  initialRouteName?: "Onboarding" | "Scan";
}) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ animation: "fade", gestureEnabled: false }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="Result"
        component={ResultScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}
