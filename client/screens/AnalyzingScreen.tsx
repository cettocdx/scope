import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { Colors, Spacing, Fonts, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { analyzeImage } from "@/services/geminiService";

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
        Alert.alert(
          "Analysis Failed",
          "Could not identify object. Please try again.",
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
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.dark.successGreen} />
      <Text style={styles.stepText}>{ANALYSIS_STEPS[currentStep]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: Colors.dark.successGreen,
    marginTop: Spacing.xl,
    fontSize: Typography.label.fontSize,
    fontFamily: Fonts?.mono,
    letterSpacing: 2,
  },
});
