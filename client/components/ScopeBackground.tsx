import React from "react";
import { StyleSheet, useWindowDimensions, View, ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Colors } from "@/constants/theme";

/**
 * The shared Scope canvas: a near-black background with a soft navy radial glow,
 * matching the home screen. Drop it as the root of any screen so the whole app
 * shares one cinematic, premium backdrop.
 *
 * `glowY` shifts the glow's vertical center (0 = top, 1 = bottom) so each screen
 * can place the light where its focal point is.
 */
export function ScopeBackground({
  children,
  glowY = 0.5,
  style,
}: {
  children?: React.ReactNode;
  glowY?: number;
  style?: ViewStyle;
}) {
  const { width, height } = useWindowDimensions();
  return (
    <View style={[styles.root, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="scopeBg" cx="50%" cy={`${glowY * 100}%`} r="65%">
              <Stop offset="0%" stopColor={Colors.dark.navyGlow} stopOpacity={0.85} />
              <Stop offset="45%" stopColor="#02040A" stopOpacity={1} />
              <Stop offset="100%" stopColor="#000104" stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#scopeBg)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000104",
  },
});
