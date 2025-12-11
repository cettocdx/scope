import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PortfolioAsset, AssetData } from "@/types";

import HomeScreen from "@/screens/HomeScreen";
import VaultScreen from "@/screens/VaultScreen";
import ScannerScreen from "@/screens/ScannerScreen";
import ReviewScreen from "@/screens/ReviewScreen";
import AnalyzingScreen from "@/screens/AnalyzingScreen";
import ResultScreen from "@/screens/ResultScreen";
import AssetDetailScreen from "@/screens/AssetDetailScreen";

export type RootStackParamList = {
  Home: undefined;
  Vault: undefined;
  Scanner: undefined;
  Review: { imageBase64: string };
  Analyzing: { imageBase64: string };
  Result: { imageBase64: string; assetData: AssetData };
  AssetDetail: { asset: PortfolioAsset };
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
      <Stack.Screen name="Analyzing" component={AnalyzingScreen} />
      <Stack.Screen 
        name="Result" 
        component={ResultScreen}
        options={{ 
          presentation: "transparentModal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen 
        name="AssetDetail" 
        component={AssetDetailScreen}
        options={{ animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}
