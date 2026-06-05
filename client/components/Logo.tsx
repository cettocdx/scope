import React from "react";
import Svg, { Circle, Line, G } from "react-native-svg";

import { Colors } from "@/constants/theme";

interface LogoMarkProps {
  /** Rendered width/height in px (square). */
  size?: number;
  /** Primary stroke color (ring + ticks). */
  color?: string;
  /** Single accent color (index mark + center dot). */
  accent?: string;
  /** Stroke weight relative to the 64px artboard. */
  strokeWidth?: number;
}

/**
 * SCOPE logo mark — a precision "scope reticle":
 * a clean ring, gapped cardinal ticks, a top index mark and a center dot.
 * Minimal, geometric, single-accent — designed to scale from app icon to favicon.
 *
 * Artboard is a 64×64 viewBox; everything scales with `size`.
 */
export function LogoMark({
  size = 64,
  color = Colors.dark.text,
  accent = Colors.dark.successGreen,
  strokeWidth = 2.5,
}: LogoMarkProps) {
  const c = 32; // center of 64×64 artboard
  const r = 23; // ring radius
  const tickOuter = r - 2.5;
  const tickInner = r - 8;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Outer ring */}
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={0.92}
      />

      {/* Top index mark — extends just beyond the ring (the single accent detail) */}
      <Line
        x1={c}
        y1={c - r - 5}
        x2={c}
        y2={c - tickInner}
        stroke={accent}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Cardinal ticks (right / bottom / left) — gapped crosshair, never reaching center */}
      <G stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
        <Line x1={c + tickInner} y1={c} x2={c + tickOuter} y2={c} />
        <Line x1={c} y1={c + tickInner} x2={c} y2={c + tickOuter} />
        <Line x1={c - tickInner} y1={c} x2={c - tickOuter} y2={c} />
      </G>

      {/* Center dot — accent */}
      <Circle cx={c} cy={c} r={3.2} fill={accent} />
    </Svg>
  );
}

export default LogoMark;
