import React from "react";
import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";

export type IconName = React.ComponentProps<typeof Feather>["name"];

/**
 * The app names icons in Feather's vocabulary; on iOS each one is drawn with
 * the matching SF Symbol so it sits on the text baseline like Apple's own UI.
 * Anything without a mapping (and Android/web) falls back to Feather.
 */
const SF: Partial<Record<IconName, SFSymbol>> = {
  activity: "waveform.path.ecg",
  "alert-circle": "exclamationmark.circle",
  "alert-triangle": "exclamationmark.triangle.fill",
  award: "rosette",
  bell: "bell.badge",
  bookmark: "bookmark",
  camera: "camera",
  "camera-off": "video.slash",
  check: "checkmark",
  "check-circle": "checkmark.seal.fill",
  "chevron-down": "chevron.down",
  "chevron-left": "chevron.left",
  "chevron-right": "chevron.right",
  "chevron-up": "chevron.up",
  circle: "circle.dashed",
  clock: "clock",
  cloud: "icloud",
  copy: "doc.on.doc",
  "corner-down-right": "arrow.turn.down.right",
  "edit-3": "pencil",
  "external-link": "safari",
  "arrow-up-right": "arrow.up.right",
  globe: "globe",
  heart: "heart",
  "help-circle": "questionmark.circle",
  image: "photo.on.rectangle",
  info: "info.circle",
  "log-in": "person.crop.circle.badge.plus",
  "log-out": "rectangle.portrait.and.arrow.right",
  maximize: "barcode.viewfinder",
  package: "shippingbox",
  "play-circle": "play.circle",
  plus: "plus",
  power: "power",
  "refresh-cw": "arrow.clockwise",
  search: "magnifyingglass",
  share: "square.and.arrow.up",
  shield: "checkmark.shield",
  slash: "nosign",
  sliders: "gearshape",
  tag: "tag",
  "trash-2": "trash",
  "trending-down": "arrow.down.right",
  "trending-up": "arrow.up.right",
  type: "character.cursor.ibeam",
  user: "person.crop.circle",
  "wifi-off": "wifi.slash",
  x: "xmark",
  zap: "bolt.fill",
  "zap-off": "bolt.slash",
};

export function Icon({
  name,
  size = 17,
  color,
  weight = "medium",
}: {
  name: IconName;
  size?: number;
  color: string;
  weight?: SymbolWeight;
}) {
  const symbol = Platform.OS === "ios" ? SF[name] : undefined;
  const fallback = <Feather name={name} size={size} color={color} />;
  if (!symbol) return fallback;
  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      fallback={fallback}
      style={{ width: size, height: size }}
    />
  );
}
