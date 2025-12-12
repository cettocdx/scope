import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PortfolioAsset, AssetData, Condition, Country, AssetAttributes } from "@/types";

import HomeScreen from "@/screens/HomeScreen";
import VaultScreen from "@/screens/VaultScreen";
import ScannerScreen from "@/screens/ScannerScreen";
import ReviewScreen from "@/screens/ReviewScreen";
import ConfirmScreen from "@/screens/ConfirmScreen";
import AnalyzingScreen from "@/screens/AnalyzingScreen";
import ResultScreen from "@/screens/ResultScreen";
import AssetDetailScreen from "@/screens/AssetDetailScreen";
import AnalyticsScreen from "@/screens/AnalyticsScreen";

export interface RefinementData {
  condition: Condition;
  country: Country;
  attributes?: AssetAttributes;
  itemName?: string;
  category?: string;
}

export type RootStackParamList = {
  Home: undefined;
  Vault: undefined;
  Scanner: undefined;
  Review: { imageBase64: string };
  Confirm: { imageBase64: string; initialData?: Partial<AssetData> };
  Analyzing: { imageBase64: string; refinements?: RefinementData };
  Result: { imageBase64: string; assetData: AssetData };
  AssetDetail: { asset: PortfolioAsset };
  Analytics: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#000000" },
        animation: "fade",
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="Review" component={ReviewScreen} />
      <Stack.Screen 
        name="Confirm" 
        component={ConfirmScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen name="Analyzing" component={AnalyzingScreen} />
      <Stack.Screen 
        name="Result" 
        component={ResultScreen}
        options={{ 
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen 
        name="AssetDetail" 
        component={AssetDetailScreen}
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="Analytics" 
        component={AnalyticsScreen}
        options={{ animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}
