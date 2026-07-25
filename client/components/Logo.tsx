import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

import { useTheme } from "@/hooks/useTheme";

interface LogoMarkProps {
  /** Rendered width/height in px (square). */
  size?: number;
}

/**
 * SCOPE logo mark — a hexagonal aperture.
 *
 * The hexagon IS the aperture: a six-blade lens opening. A solid gradient ring
 * with a bright center node — the ring carries ~46% of the radius as mass, so
 * the mark survives being scaled down to a favicon without thinning out.
 *
 * Geometry is kept identical to branding/logo-mark.svg (64×64 artboard, outer
 * R=26, inner r=14, node r=4.5). Colors come from the theme accent ramp rather
 * than hardcoded hex, so the mark cannot drift away from the palette the rest
 * of the app uses — which is exactly how it ended up stranded on the old green.
 */
export function LogoMark({ size = 72 }: LogoMarkProps) {
  const { theme } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient
          id="scopeGrad"
          x1="9.48"
          y1="6"
          x2="54.52"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={theme.accent} />
          <Stop offset="0.5" stopColor={theme.accentIce} />
          <Stop offset="1" stopColor={theme.accentDeep} />
        </LinearGradient>
      </Defs>

      {/* Aperture ring: outer hex + inner hex hole, even-odd fill */}
      <Path
        d="M32,6 L54.52,19 L54.52,45 L32,58 L9.48,45 L9.48,19 Z
           M32,18 L44.12,25 L44.12,39 L32,46 L19.88,39 L19.88,25 Z"
        fill="url(#scopeGrad)"
        fillRule="evenodd"
      />

      {/* Center node — the asset being scoped */}
      <Circle cx="32" cy="32" r="4.5" fill={theme.accentIce} />
    </Svg>
  );
}

export default LogoMark;
