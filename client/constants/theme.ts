import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    textDim: "rgba(255, 255, 255, 0.2)",
    buttonText: "#000000",
    tabIconDefault: "rgba(255, 255, 255, 0.4)",
    tabIconSelected: "#00FF94",
    link: "#00FF94",
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
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.6)",
    textTertiary: "rgba(255, 255, 255, 0.4)",
    textDim: "rgba(255, 255, 255, 0.2)",
    buttonText: "#000000",
    tabIconDefault: "rgba(255, 255, 255, 0.4)",
    tabIconSelected: "#00FF94",
    link: "#00FF94",
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

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "'JetBrains Mono', SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
