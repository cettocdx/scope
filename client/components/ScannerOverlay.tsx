import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors, Fonts, Typography, Spacing } from "@/constants/theme";

interface ScannerOverlayProps {
  scanStatus: "SEARCHING" | "STABILIZING" | "LOCKED";
  stability: number;
}

const { width } = Dimensions.get("window");

export default function ScannerOverlay({ scanStatus, stability }: ScannerOverlayProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isLocked = scanStatus === "LOCKED";
  const color = isLocked
    ? Colors.dark.successGreen
    : scanStatus === "STABILIZING"
    ? Colors.dark.warningYellow
    : Colors.dark.textSecondary;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.topHud}>
        <View>
          <View style={styles.row}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isLocked ? Colors.dark.successGreen : Colors.dark.alertRed },
              ]}
            />
            <Text style={[styles.statusLabel, { color }]}>
              {isLocked ? "SIGNAL_CLEAR" : "ACQUIRING..."}
            </Text>
          </View>
          <Text style={styles.subText}>
            STABILITY {Math.floor(stability)}%
          </Text>
        </View>
        <View style={styles.rightInfo}>
          <View style={styles.row}>
            <Feather name="aperture" size={12} color={Colors.dark.textSecondary} />
            <Text style={styles.statusLabel}> SCOPE</Text>
          </View>
          <Text style={styles.subText}>SCAN MODE</Text>
        </View>
      </View>

      <View style={styles.centerContainer}>
        <View
          style={[
            styles.reticle,
            {
              width: isLocked ? 250 : 280,
              height: isLocked ? 250 : 280,
              borderColor: color,
            },
          ]}
        >
          <View style={[styles.corner, styles.tl, { borderColor: color }]} />
          <View style={[styles.corner, styles.tr, { borderColor: color }]} />
          <View style={[styles.corner, styles.bl, { borderColor: color }]} />
          <View style={[styles.corner, styles.br, { borderColor: color }]} />

          {isLocked ? (
            <Feather
              name="lock"
              size={32}
              color={Colors.dark.successGreen}
              style={styles.lockIcon}
            />
          ) : (
            <View style={styles.crosshair}>
              <View style={styles.vLine} />
              <View style={styles.hLine} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.bottomHud}>
        <View>
          <Text style={[styles.statusLabel, { color, fontSize: 12 }]}>
            {scanStatus === "SEARCHING"
              ? "HOLD DEVICE STEADY"
              : scanStatus === "STABILIZING"
              ? "CALIBRATING..."
              : "READY FOR CAPTURE"}
          </Text>
          <View style={styles.barContainer}>
            <View
              style={[styles.barFill, { width: `${stability}%`, backgroundColor: color }]}
            />
          </View>
        </View>
        <Text style={styles.timeText}>
          {now.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topHud: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.xl,
    paddingTop: 60,
  },
  bottomHud: {
    position: "absolute",
    bottom: 120,
    left: Spacing.xl,
    right: Spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rightInfo: {
    alignItems: "flex-end",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    letterSpacing: 1,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  subText: {
    fontSize: Typography.metadata.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    marginTop: 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  reticle: {
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  tl: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tr: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  br: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  lockIcon: {
    alignSelf: "center",
  },
  crosshair: {
    position: "absolute",
    opacity: 0.5,
  },
  vLine: {
    width: 1,
    height: 20,
    backgroundColor: "#FFF",
    alignSelf: "center",
  },
  hLine: {
    height: 1,
    width: 20,
    backgroundColor: "#FFF",
    position: "absolute",
    top: 10,
    left: -10,
  },
  barContainer: {
    height: 2,
    width: 100,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginTop: Spacing.xs,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: Colors.dark.successGreen,
  },
  timeText: {
    fontSize: Typography.label.fontSize,
    fontWeight: "700",
    color: "#FFF",
    fontFamily: Fonts?.mono,
  },
});
