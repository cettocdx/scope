import { useEffect, useState } from "react";
import { DeviceMotion } from "expo-sensors";

/**
 * True once the phone has been held still for a moment. The fallback camera
 * (Expo Go, Android) has no object detection, so steadiness is its "ready".
 */
export function useSteady(enabled: boolean, holdMs = 700): boolean {
  const [steady, setSteady] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setSteady(false);
      return;
    }
    let since: number | null = null;
    DeviceMotion.setUpdateInterval(100);
    const sub = DeviceMotion.addListener(({ rotationRate }) => {
      const r = rotationRate
        ? Math.abs(rotationRate.alpha) +
          Math.abs(rotationRate.beta) +
          Math.abs(rotationRate.gamma)
        : 0;
      const now = Date.now();
      if (r < 25) {
        since ??= now;
        setSteady(now - since >= holdMs);
      } else {
        since = null;
        setSteady(false);
      }
    });
    return () => sub.remove();
  }, [enabled, holdMs]);
  return steady;
}
