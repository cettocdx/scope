import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { Colors, Spacing, Fonts, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { analyzeImage } from "@/services/geminiService";
import { getApiUrl } from "@/lib/query-client";
import { ScopeBackground } from "@/components/ScopeBackground";
import { quotaStatus, recordScan, FREE_DAILY_SCANS } from "@/lib/quota";

type Props = NativeStackScreenProps<RootStackParamList, "Analyzing">;

const ANALYSIS_STEPS = [
  "EXTRACTING DATA...",
  "MAPPING GEOMETRY...",
  "CHECKING ID...",
  "VERIFYING MARKET...",
  "CALCULATING VALUE...",
];

export default function AnalyzingScreen({ navigation, route }: Props) {
  const { imageBase64, refinements } = route.params;
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < ANALYSIS_STEPS.length) {
        setCurrentStep(stepIndex);
      }
    }, 700);

    const analyze = async () => {
      try {
        // Free daily quota gate — every scan costs money upstream.
        const quota = await quotaStatus();
        if (!quota.allowed) {
          clearInterval(interval);
          Alert.alert(
            "Daily limit reached",
            `You've used all ${FREE_DAILY_SCANS} free scans today. They reset tomorrow.`,
            [{ text: "OK", onPress: () => navigation.popToTop() }],
          );
          return;
        }
        await recordScan();

        const result = await analyzeImage(imageBase64, refinements);
        
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }

        clearInterval(interval);
        navigation.replace("Result", {
          imageBase64,
          assetData: result,
        });
      } catch (e) {
        clearInterval(interval);
        const detail = e instanceof Error ? e.message : String(e);
        Alert.alert(
          "Analysis Failed",
          `Could not identify object.\n\nDetay: ${detail}\n\nAPI: ${getApiUrl()}`,
          [
            {
              text: "OK",
              onPress: () => navigation.replace("Scanner"),
            },
          ]
        );
      }
    };

    analyze();

    return () => clearInterval(interval);
  }, [imageBase64, navigation]);

  return (
    <ScopeBackground>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.stepText}>{ANALYSIS_STEPS[currentStep]}</Text>
      </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: Colors.dark.accentIce,
    marginTop: Spacing.xl,
    fontSize: Typography.label.fontSize,
    fontFamily: Fonts?.mono,
    letterSpacing: 2,
  },
});
