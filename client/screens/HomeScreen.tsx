import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { RootStackParamList } from "@/navigation/RootStackNavigator";

/**
 * Scope home screen — a single, cinematic call-to-action.
 *
 * Pure-black canvas, a quiet navy radial glow, the SCOPE wordmark, and one large
 * glassy "SCOPE IT" orb that breathes softly and dips on press. Intentionally
 * minimal: no tabs, cards, or chrome. Tapping the orb opens the camera scanner.
 */

const C = {
  black: "#000104",
  ink: "#02040A",
  navyGlow: "#07122A",
  electric: "#5B7CFF",
  ice: "#B9D4FF",
  violet: "#8B5CFF",
  white: "#F5F7FF",
  muted: "rgba(245, 247, 255, 0.58)",
  faint: "rgba(245, 247, 255, 0.30)",
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Orb diameter: responsive, clamped to the premium 260–300 band.
  const ORB = Math.max(260, Math.min(width * 0.76, 300));

  const press = useRef(new Animated.Value(0)).current; // 0 = rest, 1 = pressed
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const onPressIn = () =>
    Animated.spring(press, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(press, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();

  const handleScope = () => navigation.navigate("Scanner");

  const orbScale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.82] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const GLOW = ORB * 1.7;

  return (
    <View style={styles.root}>
      {/* Ambient navy radial glow behind everything */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <RadialGradient id="bg" cx="50%" cy="52%" r="62%">
              <Stop offset="0%" stopColor={C.navyGlow} stopOpacity={0.9} />
              <Stop offset="42%" stopColor={C.ink} stopOpacity={1} />
              <Stop offset="100%" stopColor={C.black} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#bg)" />
        </Svg>
      </View>

      <View
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 18 },
        ]}
      >
        {/* Wordmark */}
        <View style={[styles.hero, { marginTop: height * 0.11 }]}>
          <View style={styles.wordmarkWrap}>
            <View style={styles.wordmarkGlow} pointerEvents="none">
              <Svg width={220} height={120}>
                <Defs>
                  <RadialGradient id="oglow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={C.violet} stopOpacity={0.55} />
                    <Stop offset="45%" stopColor={C.electric} stopOpacity={0.22} />
                    <Stop offset="100%" stopColor={C.electric} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx={110} cy={60} rx={74} ry={42} fill="url(#oglow)" />
              </Svg>
            </View>
            <Text style={styles.wordmark} accessibilityRole="header">
              SCOPE
            </Text>
          </View>
          <Text style={styles.subtitle}>Know the real price of anything.</Text>
        </View>

        {/* The orb */}
        <View style={styles.orbZone}>
          <Pressable
            onPress={handleScope}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Scope it. Open the camera to scan an item."
            style={{ width: ORB, height: ORB }}
          >
            {/* Breathing outer glow */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.glowLayer,
                {
                  width: GLOW,
                  height: GLOW,
                  left: (ORB - GLOW) / 2,
                  top: (ORB - GLOW) / 2,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            >
              <Svg width={GLOW} height={GLOW}>
                <Defs>
                  <RadialGradient id="orbGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={C.electric} stopOpacity={0.5} />
                    <Stop offset="38%" stopColor={C.violet} stopOpacity={0.28} />
                    <Stop offset="70%" stopColor={C.electric} stopOpacity={0.06} />
                    <Stop offset="100%" stopColor={C.electric} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2} fill="url(#orbGlow)" />
              </Svg>
            </Animated.View>

            {/* Orb body */}
            <Animated.View style={{ transform: [{ scale: orbScale }] }}>
              <OrbFace size={ORB} />
            </Animated.View>
          </Pressable>
        </View>

        {/* Footer hint */}
        <View style={styles.footer}>
          <Text style={styles.hint}>Tap to open camera scan</Text>
          <ScanReticle size={22} color={C.faint} />
        </View>
      </View>
    </View>
  );
}

/** The glassy orb: concentric rings, a top-lit dark surface, lens flares, label. */
function OrbFace({ size }: { size: number }) {
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="surface" cx="50%" cy="36%" r="72%">
          <Stop offset="0%" stopColor="#0C1A35" stopOpacity={1} />
          <Stop offset="55%" stopColor="#050B1A" stopOpacity={1} />
          <Stop offset="100%" stopColor="#01030A" stopOpacity={1} />
        </RadialGradient>
        <LinearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={C.electric} stopOpacity={0.9} />
          <Stop offset="50%" stopColor={C.ice} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={C.violet} stopOpacity={0.9} />
        </LinearGradient>
        <LinearGradient id="label" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={C.white} stopOpacity={1} />
          <Stop offset="55%" stopColor={C.ice} stopOpacity={1} />
          <Stop offset="100%" stopColor={C.electric} stopOpacity={1} />
        </LinearGradient>
        <RadialGradient id="flare" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={C.ice} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={C.ice} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* glassy surface */}
      <Circle cx={c} cy={c} r={size * 0.44} fill="url(#surface)" />

      {/* lens-flare highlights left & right of the rim */}
      <Ellipse cx={size * 0.1} cy={c} rx={size * 0.07} ry={size * 0.16} fill="url(#flare)" />
      <Ellipse cx={size * 0.9} cy={c} rx={size * 0.07} ry={size * 0.16} fill="url(#flare)" />

      {/* concentric rings */}
      <Circle cx={c} cy={c} r={size * 0.44} stroke="url(#rim)" strokeWidth={1.6} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={size * 0.37}
        stroke={C.electric}
        strokeOpacity={0.22}
        strokeWidth={1}
        fill="none"
      />
      <Circle
        cx={c}
        cy={c}
        r={size * 0.3}
        stroke={C.violet}
        strokeOpacity={0.16}
        strokeWidth={1}
        fill="none"
      />

      {/* top sheen */}
      <Ellipse cx={c} cy={size * 0.3} rx={size * 0.26} ry={size * 0.1} fill="url(#flare)" opacity={0.5} />

      {/* label */}
      <SvgText
        x={c}
        y={c + size * 0.045}
        fill="url(#label)"
        fontSize={size * 0.115}
        fontWeight="600"
        letterSpacing={size * 0.018}
        textAnchor="middle"
      >
        SCOPE IT
      </SvgText>
    </Svg>
  );
}

/** Minimal camera focus reticle: four corner brackets around a center dot. */
function ScanReticle({ size, color }: { size: number; color: string }) {
  const s = size;
  const g = s * 0.16; // corner arm length
  const r = s * 0.22; // bracket inset
  const o = s * 0.5; // center
  const sw = Math.max(1.4, s * 0.07);
  const corner = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
  return (
    <Svg width={s} height={s} style={{ marginTop: 10 }}>
      <Path
        d={corner(r, r + g, r, r, r + g, r)}
        stroke={color}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={corner(s - r - g, r, s - r, r, s - r, r + g)}
        stroke={color}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={corner(r, s - r - g, r, s - r, r + g, s - r)}
        stroke={color}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d={corner(s - r - g, s - r, s - r, s - r, s - r, s - r - g)}
        stroke={color}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
      <G>
        <Circle cx={o} cy={o} r={s * 0.05} fill={color} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.black,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: "center",
  },
  wordmarkWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkGlow: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontSize: 40,
    fontWeight: "300",
    letterSpacing: 16,
    color: C.white,
    // optical centering for the wide letter-spacing (trailing space)
    paddingLeft: 16,
  },
  subtitle: {
    marginTop: 18,
    fontSize: 15,
    letterSpacing: 0.3,
    color: C.muted,
    fontWeight: "400",
  },
  orbZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    alignItems: "center",
  },
  hint: {
    fontSize: 12.5,
    letterSpacing: 0.6,
    color: C.muted,
  },
});
