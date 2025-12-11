import React from "react";
import { View, Image, StyleSheet, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Fonts, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Review">;

export default function ReviewScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { imageBase64 } = route.params;

  const handleRetake = () => {
    navigation.replace("Scanner");
  };

  const handleAnalyze = () => {
    navigation.replace("Analyzing", { imageBase64 });
  };

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: imageBase64 }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
      />
      <View
        style={[
          styles.overlay,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleRetake}
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={20} color="#FFF" />
          <Text style={styles.buttonText}>RETAKE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAnalyze}
          activeOpacity={0.8}
        >
          <Feather name="check" size={20} color="#000" />
          <Text style={styles.primaryButtonText}>ANALYZE</Text>
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
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing["3xl"],
    flexDirection: "row",
    gap: Spacing.lg,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
  },
  primaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.dark.successGreen,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: Colors.dark.cardBorderLight,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  primaryButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
});
