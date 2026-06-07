import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

interface LogoMarkProps {
  /** Rendered width/height in px (square). */
  size?: number;
}

/**
 * SCOPE logo mark — a bold hexagonal aperture.
 * A solid gradient hex "lens" ring with a bright center node: geometric,
 * modern and premium (no thin gimmicky lines). Scales cleanly from app icon
 * to favicon. Artboard is a 64×64 viewBox.
 */
export function LogoMark({ size = 72 }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="scopeGrad" x1="12" y1="6" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#5BFFC0" />
          <Stop offset="0.5" stopColor="#00FF94" />
          <Stop offset="1" stopColor="#00B36A" />
        </LinearGradient>
      </Defs>

      {/* Hexagonal aperture ring (outer hex + inner hex hole, even-odd fill) */}
      <Path
        d="M32,6 L54.52,19 L54.52,45 L32,58 L9.48,45 L9.48,19 Z
           M32,18 L44.39,25.15 L44.39,39.45 L32,46.6 L19.61,39.45 L19.61,25.15 Z"
        fill="url(#scopeGrad)"
        fillRule="evenodd"
      />

      {/* Center node */}
      <Circle cx="32" cy="32" r="4.2" fill="#5BFFC0" />
    </Svg>
  );
}

export default LogoMark;
