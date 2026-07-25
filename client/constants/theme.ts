import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    textDim: "rgba(255, 255, 255, 0.2)",
    buttonText: "#000000",
    tabIconDefault: "rgba(255, 255, 255, 0.4)",
    // Interaction colors are BRAND, not semantic: they point at the accent, not
    // at successGreen. These drove Button, ErrorFallback and ThemedText
    // type="link" green while every screen hardcoded accent blue.
    tabIconSelected: "#5B7CFF",
    link: "#5B7CFF",
    backgroundRoot: "#000000",
    backgroundDefault: "#0A0A0A",
    backgroundSecondary: "#111111",
    backgroundTertiary: "#141414",
    successGreen: "#00FF94",
    alertRed: "#FF3B30",
    warningYellow: "#FACC15",
    // Semantic tints derived from successGreen / alertRed, so screens stop
    // hand-writing the same rgba() literals for status pills and badges.
    successTint: "rgba(0, 255, 148, 0.1)",
    successTintStrong: "rgba(0, 255, 148, 0.15)",
    alertTint: "rgba(255, 59, 48, 0.1)",
    alertTintStrong: "rgba(255, 59, 48, 0.15)",
    overlayLight: "rgba(255, 255, 255, 0.1)",
    glassSurface: "rgba(20, 20, 20, 0.6)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
    cardBorder: "#222222",
    cardBorderLight: "#333333",
    // --- Scope brand palette (matches the home screen) ---
    // Blue/violet is the BRAND accent (buttons, highlights, active states);
    // successGreen / alertRed stay reserved for gain/loss semantics.
    accent: "#5B7CFF",
    accentDeep: "#8B5CFF",
    accentIce: "#B9D4FF",
    accentTint: "rgba(91, 124, 255, 0.12)",
    accentTintStrong: "rgba(91, 124, 255, 0.18)",
    accentBorder: "rgba(91, 124, 255, 0.35)",
    navyGlow: "#07122A",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    textDim: "rgba(255, 255, 255, 0.2)",
    buttonText: "#000000",
    tabIconDefault: "rgba(255, 255, 255, 0.4)",
    // Interaction colors are BRAND, not semantic: they point at the accent, not
    // at successGreen. These drove Button, ErrorFallback and ThemedText
    // type="link" green while every screen hardcoded accent blue.
    tabIconSelected: "#5B7CFF",
    link: "#5B7CFF",
    backgroundRoot: "#000000",
    backgroundDefault: "#0A0A0A",
    backgroundSecondary: "#111111",
    backgroundTertiary: "#141414",
    successGreen: "#00FF94",
    alertRed: "#FF3B30",
    warningYellow: "#FACC15",
    // Semantic tints derived from successGreen / alertRed, so screens stop
    // hand-writing the same rgba() literals for status pills and badges.
    successTint: "rgba(0, 255, 148, 0.1)",
    successTintStrong: "rgba(0, 255, 148, 0.15)",
    alertTint: "rgba(255, 59, 48, 0.1)",
    alertTintStrong: "rgba(255, 59, 48, 0.15)",
    overlayLight: "rgba(255, 255, 255, 0.1)",
    glassSurface: "rgba(20, 20, 20, 0.6)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
    cardBorder: "#222222",
    cardBorderLight: "#333333",
    // --- Scope brand palette (matches the home screen) ---
    // Blue/violet is the BRAND accent (buttons, highlights, active states);
    // successGreen / alertRed stay reserved for gain/loss semantics.
    accent: "#5B7CFF",
    accentDeep: "#8B5CFF",
    accentIce: "#B9D4FF",
    accentTint: "rgba(91, 124, 255, 0.12)",
    accentTintStrong: "rgba(91, 124, 255, 0.18)",
    accentBorder: "rgba(91, 124, 255, 0.35)",
    navyGlow: "#07122A",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 56,
  buttonHeightLarge: 64,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 64,
    fontWeight: "900" as const,
    letterSpacing: -2,
  },
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  label: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  micro: {
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
  metadata: {
    fontSize: 9,
    fontWeight: "400" as const,
  },
  price: {
    fontSize: 42,
    fontWeight: "700" as const,
  },
  priceSmall: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

// Inter is the product typeface (loaded in App.tsx). Because @expo-google-fonts
// ships one file per weight, we reference the exact weight family rather than
// relying on fontWeight (which native ignores for a specific-weight family).
//
// `mono` is kept as a key for backward-compat with existing styles, but now maps
// to Inter Medium — the app moves from a "tactical monospace" look to a clean,
// premium AI-native typographic system. Letter-spacing on labels is preserved.
const isWeb = Platform.OS === "web";
const interSans = isWeb ? "Inter, system-ui, sans-serif" : "Inter_400Regular";

export const Fonts = {
  sans: interSans,
  serif: interSans,
  rounded: interSans,
  mono: isWeb ? "Inter, system-ui, sans-serif" : "Inter_500Medium",
  medium: isWeb ? "Inter, system-ui, sans-serif" : "Inter_500Medium",
  semibold: isWeb ? "Inter, system-ui, sans-serif" : "Inter_600SemiBold",
  bold: isWeb ? "Inter, system-ui, sans-serif" : "Inter_700Bold",
  black: isWeb ? "Inter, system-ui, sans-serif" : "Inter_800ExtraBold",
};
