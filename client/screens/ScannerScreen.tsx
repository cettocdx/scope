import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Colors, Spacing, Fonts, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import ScannerOverlay from "@/components/ScannerOverlay";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

const safeHaptics = {
  selection: () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  },
  heavy: () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  },
};

export default function ScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [stability, setStability] = useState(0);
  const [scanStatus, setScanStatus] = useState<"SEARCHING" | "STABILIZING" | "LOCKED">("SEARCHING");
  const prevStatusRef = useRef(scanStatus);

  useEffect(() => {
    if (Platform.OS === "web") {
      const timer = setTimeout(() => setStability(100), 500);
      return () => clearTimeout(timer);
    }

    let lastData = { x: 0, y: 0, z: 0 };
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener((data) => {
      const delta =
        Math.abs(data.x - lastData.x) +
        Math.abs(data.y - lastData.y) +
        Math.abs(data.z - lastData.z);
      lastData = data;
      const stabilityScore = Math.max(0, Math.min(100, (1 - delta * 5) * 100));
      setStability((prev) => prev * 0.7 + stabilityScore * 0.3);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let newStatus: typeof scanStatus = "SEARCHING";
    if (stability > 85) newStatus = "LOCKED";
    else if (stability > 50) newStatus = "STABILIZING";

    if (newStatus !== prevStatusRef.current) {
      prevStatusRef.current = newStatus;
      setScanStatus(newStatus);
      if (newStatus === "LOCKED") {
        safeHaptics.heavy();
      }
    }
  }, [stability]);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    safeHaptics.selection();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
      });
      if (photo?.base64) {
        navigation.replace("Review", {
          imageBase64: `data:image/jpeg;base64,${photo.base64}`,
        });
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to capture image");
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView
        style={StyleSheet.absoluteFill}
        ref={cameraRef}
        facing="back"
        animateShutter={false}
        autofocus="on"
      />
      <ScannerOverlay scanStatus={scanStatus} stability={stability} />

      <View style={styles.controls}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel scan"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.captureBtn}
          onPress={handleCapture}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
        >
          <View
            style={[
              styles.captureInner,
              scanStatus === "LOCKED" && styles.captureInnerLocked,
            ]}
          />
        </TouchableOpacity>
        <View style={styles.placeholder} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  permissionText: {
    color: Colors.dark.text,
    fontSize: Typography.body.fontSize,
    textAlign: "center",
    marginBottom: Spacing.xl,
    fontFamily: Fonts?.mono,
  },
  permissionButton: {
    backgroundColor: Colors.dark.successGreen,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: Spacing.md,
    marginBottom: Spacing.md,
  },
  permissionButtonText: {
    color: "#000",
    fontWeight: "700",
    fontFamily: Fonts?.mono,
  },
  cancelButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.lg,
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing["3xl"],
  },
  cancelBtn: {
    width: 80,
  },
  cancelText: {
    color: Colors.dark.text,
    fontWeight: "700",
    fontFamily: Fonts?.mono,
    fontSize: Typography.label.fontSize,
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFF",
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  captureInner: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  captureInnerLocked: {
    backgroundColor: Colors.dark.successGreen,
  },
  placeholder: {
    width: 80,
  },
});
