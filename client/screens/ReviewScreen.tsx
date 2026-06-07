import React from "react";
import { View, Image, StyleSheet, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Fonts, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export default function ReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { imageBase64 } = route.params;

  const handleRetake = () => {
    navigation.replace("Scanner");
  };

  const handleQuickAnalyze = () => {
    navigation.replace("Analyzing", { imageBase64 });
  };

  const handleRefine = () => {
    navigation.replace("Confirm", { imageBase64 });
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageBase64 }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
      />
      
      <View style={[styles.topOverlay, { paddingTop: insets.top + Spacing.md }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleRetake}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Photo</Text>
        <View style={{ width: 40 }} />
      </View>

      <View
        style={[
          styles.overlay,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Text style={styles.choiceLabel}>Choose Analysis Type</Text>
        
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleQuickAnalyze}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Quick analyze"
          accessibilityHint="AI identifies the item instantly"
        >
          <View style={styles.buttonContent}>
            <Feather name="zap" size={20} color="#000" />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.primaryButtonText}>QUICK ANALYZE</Text>
              <Text style={styles.buttonSubtext}>AI identifies item instantly</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refineButton}
          onPress={handleRefine}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Confirm and refine"
          accessibilityHint="Add condition, size and color for better accuracy"
        >
          <View style={styles.buttonContent}>
            <Feather name="sliders" size={20} color={Colors.dark.successGreen} />
            <View style={styles.buttonTextContainer}>
              <Text style={styles.refineButtonText}>CONFIRM & REFINE</Text>
              <Text style={styles.buttonSubtextLight}>Add condition, size, color for better accuracy</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retakeLink}
          onPress={handleRetake}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Retake photo"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="refresh-cw" size={14} color={Colors.dark.textTertiary} />
          <Text style={styles.retakeLinkText}>Retake Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  choiceLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  primaryButton: {
    height: 70,
    backgroundColor: Colors.dark.successGreen,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  refineButton: {
    height: 70,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    marginBottom: Spacing.lg,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  buttonTextContainer: {
    flex: 1,
  },
  primaryButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    fontSize: Typography.body.fontSize,
  },
  refineButtonText: {
    color: Colors.dark.text,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    fontSize: Typography.body.fontSize,
  },
  buttonSubtext: {
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: Typography.micro.fontSize,
    fontFamily: Fonts?.mono,
    marginTop: 2,
  },
  buttonSubtextLight: {
    color: Colors.dark.textTertiary,
    fontSize: Typography.micro.fontSize,
    fontFamily: Fonts?.mono,
    marginTop: 2,
  },
  retakeLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  retakeLinkText: {
    color: Colors.dark.textTertiary,
    fontSize: Typography.label.fontSize,
    fontFamily: Fonts?.mono,
  },
});
