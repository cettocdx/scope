import { TextStyle } from "react-native";

/**
 * SCOPE design tokens.
 *
 * Camera-first and dark: the photo is the hero, chrome stays quiet. One signal
 * colour (lime) marks the action and the recommended buy; trust has its own
 * three-step scale so "cheap" and "safe" never get confused.
 */
export const Colors = {
  bg: "#0A0A0B",
  surface: "#141416",
  surfaceRaised: "#1C1C1F",
  surfacePressed: "#242428",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",

  text: "#F5F5F2",
  textSecondary: "rgba(245,245,242,0.64)",
  textTertiary: "rgba(245,245,242,0.40)",
  textInverse: "#0A0A0B",

  accent: "#D7FF3A",
  accentPressed: "#C2EB24",
  accentTint: "rgba(215,255,58,0.12)",

  trustHigh: "#8BE3A0",
  trustHighTint: "rgba(139,227,160,0.12)",
  trustMid: "#F4C55A",
  trustMidTint: "rgba(244,197,90,0.12)",
  trustLow: "#FF7A66",
  trustLowTint: "rgba(255,122,102,0.12)",

  scrim: "rgba(0,0,0,0.55)",
  glass: "rgba(20,20,22,0.72)",
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  gutter: 20,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
  full: 999,
} as const;

export const Fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

export const Type = {
  display: {
    fontFamily: Fonts.bold,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: Fonts.semibold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  headline: {
    fontFamily: Fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 21 },
  callout: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  calloutStrong: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  overline: {
    fontFamily: Fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  priceHero: {
    fontFamily: Fonts.bold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -1,
    fontVariant: tabular,
  },
  price: {
    fontFamily: Fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: tabular,
  },
  priceSmall: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: tabular,
  },
} satisfies Record<string, TextStyle>;

export function trustColors(score: number): { fg: string; bg: string } {
  if (score >= 80) return { fg: Colors.trustHigh, bg: Colors.trustHighTint };
  if (score >= 50) return { fg: Colors.trustMid, bg: Colors.trustMidTint };
  return { fg: Colors.trustLow, bg: Colors.trustLowTint };
}
