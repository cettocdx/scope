import React, { forwardRef } from "react";
import { Platform, type ViewProps } from "react-native";
import { requireNativeView, requireOptionalNativeModule } from "expo";

/** A detected object, in view points. `primary` is the main one. */
export interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export interface ScopeCameraProps extends ViewProps {
  torch?: boolean;
  /** 1 = the wide lens ("1×"). */
  zoom?: number;
  active?: boolean;
  onObjects?: (e: {
    nativeEvent: { objects: DetectedObject[]; stable: boolean };
  }) => void;
  onBarcode?: (e: { nativeEvent: { data: string } }) => void;
  onReady?: () => void;
  onError?: (e: { nativeEvent: { message: string } }) => void;
}

export interface ScopeCameraHandle {
  takePhoto(): Promise<{ uri: string; width: number; height: number }>;
}

type NativeViewType = React.ComponentType<
  ScopeCameraProps & React.RefAttributes<ScopeCameraHandle>
>;

// Only in our own iOS builds; Expo Go and Android fall back to expo-camera.
let NativeView: NativeViewType | null = null;
if (Platform.OS === "ios" && requireOptionalNativeModule("ScopeCamera")) {
  try {
    NativeView = requireNativeView<ScopeCameraProps>(
      "ScopeCamera",
    ) as NativeViewType;
  } catch {
    NativeView = null;
  }
}

export const scopeCameraAvailable = NativeView !== null;

export const ScopeCamera = forwardRef<ScopeCameraHandle, ScopeCameraProps>(
  function ScopeCamera(props, ref) {
    if (!NativeView) return null;
    return React.createElement(NativeView, { ...props, ref });
  },
);
