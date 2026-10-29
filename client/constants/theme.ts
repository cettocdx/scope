import { TextStyle } from "react-native";

/**
 * SCOPE design tokens.
 *
 * Camera-first and dark: the photo is the hero, chrome stays quiet. One signal
 * colour (lime) marks the action and the recommended buy; trust has its own
 * three-step scale so "cheap" and "safe" never get confused.
 */
export const Colors = {
  // iOS system dark: true black canvas, grouped surfaces on top.
  bg: "#000000",
  surface: "#1C1C1E",
  surfaceRaised: "#2C2C2E",
  surfacePressed: "#3A3A3C",
  line: "rgba(84,84,88,0.45)",
  lineStrong: "rgba(255,255,255,0.16)",

  text: "#FFFFFF",
  textSecondary: "rgba(235,235,245,0.62)",
  textTertiary: "rgba(235,235,245,0.32)",
  textInverse: "#000000",

  accent: "#D7FF3A",
  accentPressed: "#C2EB24",
  accentTint: "rgba(215,255,58,0.14)",

  // iOS system green / yellow / red (dark variants).
  trustHigh: "#30D158",
  trustHighTint: "rgba(48,209,88,0.16)",
  trustMid: "#FFD60A",
  trustMidTint: "rgba(255,214,10,0.14)",
  trustLow: "#FF453A",
  trustLowTint: "rgba(255,69,58,0.16)",

  scrim: "rgba(0,0,0,0.5)",
  glass: "rgba(44,44,46,0.62)",
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

/**
 * SF Pro, the system font: iOS switches between Text and Display optical sizes
 * and applies Apple's tracking on its own, so only weights are set here.
 */
export const Fonts = {
  regular: { fontWeight: "400" },
  medium: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
  bold: { fontWeight: "700" },
  extrabold: { fontWeight: "800" },
} satisfies Record<string, TextStyle>;

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

/** Apple's Dynamic Type scale (Large) under the names the screens use. */
export const Type = {
  largeTitle: { ...Fonts.bold, fontSize: 34, lineHeight: 41 },
  display: { ...Fonts.bold, fontSize: 28, lineHeight: 34 },
  title: { ...Fonts.bold, fontSize: 22, lineHeight: 28 },
  title3: { ...Fonts.semibold, fontSize: 20, lineHeight: 25 },
  headline: { ...Fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { ...Fonts.regular, fontSize: 17, lineHeight: 22 },
  bodyStrong: { ...Fonts.semibold, fontSize: 17, lineHeight: 22 },
  subhead: { ...Fonts.regular, fontSize: 15, lineHeight: 20 },
  subheadStrong: { ...Fonts.semibold, fontSize: 15, lineHeight: 20 },
  callout: { ...Fonts.regular, fontSize: 15, lineHeight: 20 },
  calloutStrong: { ...Fonts.semibold, fontSize: 15, lineHeight: 20 },
  footnote: { ...Fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { ...Fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: {
    ...Fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  priceHero: {
    ...Fonts.bold,
    fontSize: 40,
    lineHeight: 46,
    fontVariant: tabular,
  },
  price: {
    ...Fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
    fontVariant: tabular,
  },
  priceSmall: {
    ...Fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: tabular,
  },
} satisfies Record<string, TextStyle>;

export function trustColors(score: number): { fg: string; bg: string } {
  if (score >= 80) return { fg: Colors.trustHigh, bg: Colors.trustHighTint };
  if (score >= 50) return { fg: Colors.trustMid, bg: Colors.trustMidTint };
  return { fg: Colors.trustLow, bg: Colors.trustLowTint };
}
