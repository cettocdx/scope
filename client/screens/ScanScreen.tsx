import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import {
  Button,
  Chip,
  Glass,
  IconButton,
  notify,
  Press,
  Txt,
  select,
  tap,
} from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { putPhoto } from "@/lib/scan-session";
import { quotaStatus, FREE_DAILY_SCANS } from "@/lib/quota";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useHistory } from "@/lib/history";
import { autoCaptureEnabled } from "@/lib/camera-prefs";
import { useSteady } from "@/lib/use-steady";
import { DetectionOverlay } from "@/components/Detection";
import {
  ScopeCamera,
  scopeCameraAvailable,
  type DetectedObject,
  type ScopeCameraHandle,
} from "../../modules/scope-camera";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "@/lib/i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

/** Long edge we send to the AI: sharp enough to read labels, small enough to be fast. */
const MAX_EDGE = 1280;

type Crop = { originX: number; originY: number; width: number; height: number };

async function prepare(
  uri: string,
  width?: number,
  height?: number,
  crop?: Crop,
) {
  const w = crop?.width ?? width;
  const h = crop?.height ?? height;
  const landscape = (w ?? 0) > (h ?? 0);
  const resize =
    !w || !h || Math.max(w, h) > MAX_EDGE
      ? [{ resize: landscape ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];
  const actions = crop ? [{ crop }, ...resize] : resize;
  const out = await manipulateAsync(uri, actions, {
    compress: 0.72,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: out.uri, base64: out.base64 ?? "" };
}

export default function ScanScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [barcode, setBarcode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const pinchStart = useRef(0);
  const [searching, setSearching] = useState(false);
  // Our own iOS camera (Apple Vision detection); expo-camera elsewhere.
  const native = scopeCameraAvailable;
  const nativeCam = useRef<ScopeCameraHandle>(null);
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [stable, setStable] = useState(false);
  const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
  const [autoCapture, setAutoCapture] = useState(true);
  // Auto-capture fires once per lock; the scene must change before the next.
  const armed = useRef(true);
  const { assets } = usePortfolio();
  const history = useHistory();
  const last = history[0];
  const { isPro } = useAuth();

  const go = useCallback(
    async (photo: { uri: string; base64: string }) => {
      if (!isPro) {
        const quota = await quotaStatus();
        if (!quota.allowed) {
          Alert.alert(
            t("Daily limit reached"),
            t("You've used today's {n} free scans. Pro has no limit.", {
              n: FREE_DAILY_SCANS,
            }),
            [
              { text: t("Maybe later"), style: "cancel" },
              {
                text: t("Get Pro"),
                onPress: () => navigation.navigate("Paywall"),
              },
            ],
          );
          return;
        }
      }
      const scanId = putPhoto({ ...photo, barcode });
      setBarcode(null);
      navigation.navigate("Result", { scanId });
    },
    [barcode, isPro, navigation],
  );

  const capture = useCallback(async () => {
    if (!camera.current || busy) return;
    tap("medium");
    setBusy(true);
    try {
      const shot = await camera.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (!shot) throw new Error("no photo");
      await go(await prepare(shot.uri, shot.width, shot.height));
    } catch {
      Alert.alert(t("Couldn't take the photo"));
    } finally {
      setBusy(false);
    }
  }, [busy, go]);

  /** Native capture; crops to `target` (a tapped object or the locked one). */
  const captureNative = useCallback(
    async (target?: DetectedObject) => {
      if (!nativeCam.current || busy) return;
      tap("medium");
      setBusy(true);
      armed.current = false;
      try {
        const shot = await nativeCam.current.takePhoto();
        const crop =
          target && viewSize.width > 0
            ? cropFor(target, viewSize, shot, 0.15)
            : undefined;
        await go(await prepare(shot.uri, shot.width, shot.height, crop));
      } catch {
        Alert.alert(t("Couldn't take the photo"));
      } finally {
        setBusy(false);
      }
    },
    [busy, go, viewSize],
  );

  const primary = objects.find((o) => o.primary);
  const steady = useSteady(!native && focused);
  const shutter = useCallback(() => {
    if (native) void captureNative(stable ? primary : undefined);
    else void capture();
  }, [capture, captureNative, native, primary, stable]);

  // Hold still on something for a moment and it takes the photo itself.
  useEffect(() => {
    if (!native || !autoCapture || !focused || busy) return;
    if (!stable) {
      armed.current = true;
      return;
    }
    if (!armed.current || !primary) return;
    select();
    const timer = setTimeout(() => {
      if (armed.current) void captureNative(primary);
    }, 900);
    return () => clearTimeout(timer);
    // The latest primary box is read when the timer fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stable, autoCapture, focused, busy, native]);

  useEffect(() => {
    autoCaptureEnabled().then(setAutoCapture);
  }, [focused]);

  // The newest screenshot (Instagram, TikTok, a shop app…) in one tap.
  const scanScreenshot = useCallback(async () => {
    if (busy) return;
    const perm = await MediaLibrary.requestPermissionsAsync(false, ["photo"]);
    if (!perm.granted) {
      Alert.alert(
        t("Photo access is off"),
        t("Allow photo access in Settings to scan screenshots."),
        [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Open Settings"), onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const page = await MediaLibrary.getAssetsAsync({
      first: 20,
      mediaType: "photo",
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    const shot = page.assets.find((a) =>
      (a.mediaSubtypes ?? []).includes("screenshot"),
    );
    if (!shot) {
      Alert.alert(
        t("No recent screenshot"),
        t("Take a screenshot of the product, then come back."),
      );
      return;
    }
    const info = await MediaLibrary.getAssetInfoAsync(shot);
    setBusy(true);
    try {
      await go(
        await prepare(info.localUri ?? shot.uri, shot.width, shot.height),
      );
    } catch {
      Alert.alert(t("Couldn't take the photo"));
    } finally {
      setBusy(false);
    }
  }, [busy, go]);

  const pick = useCallback(async () => {
    if (busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    setBusy(true);
    try {
      await go(await prepare(a.uri, a.width, a.height));
    } finally {
      setBusy(false);
    }
  }, [busy, go]);

  const pickMenu = useCallback(() => {
    tap();
    const options = [
      t("Choose a photo"),
      t("Scan latest screenshot"),
      t("Cancel"),
    ];
    const run = (i: number) => {
      if (i === 0) void pick();
      if (i === 1) void scanScreenshot();
    };
    if (Platform.OS === "ios")
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2 },
        run,
      );
    else
      Alert.alert(t("Pick a photo instead"), undefined, [
        { text: options[0], onPress: () => run(0) },
        { text: options[1], onPress: () => run(1) },
        { text: options[2], style: "cancel" },
      ]);
  }, [pick, scanScreenshot]);

  const cameraUsable = permission?.granted && !cameraFailed;

  // Pinch to zoom, like the Camera app. expo-camera's zoom runs 0…1.
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      pinchStart.current = zoom;
    })
    .onUpdate((e) => {
      const next = Math.min(
        1,
        Math.max(0, pinchStart.current + (e.scale - 1) * 0.12),
      );
      setZoom(next);
    });

  return (
    <View style={styles.root}>
      {cameraUsable && native ? (
        <ScopeCamera
          ref={nativeCam}
          style={StyleSheet.absoluteFill}
          active={focused}
          torch={torch}
          zoom={1 + zoom * 5}
          onLayout={(e) => setViewSize(e.nativeEvent.layout)}
          onReady={() => setReady(true)}
          onError={() => setCameraFailed(true)}
          onObjects={(e) => {
            setObjects(e.nativeEvent.objects);
            setStable(e.nativeEvent.stable);
          }}
          onBarcode={({ nativeEvent: { data } }) => {
            if (data && /^\d{8,14}$/.test(data) && data !== barcode) {
              notify();
              setBarcode(data);
            }
          }}
        />
      ) : cameraUsable && focused ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          zoom={zoom}
          enableTorch={torch}
          onCameraReady={() => setReady(true)}
          onMountError={() => setCameraFailed(true)}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
          }}
          onBarcodeScanned={({ data }) => {
            if (data && /^\d{8,14}$/.test(data) && data !== barcode) {
              notify();
              setBarcode(data);
            }
          }}
        />
      ) : null}

      {cameraUsable ? (
        <GestureDetector gesture={pinch}>
          <View style={styles.center}>
            {native && objects.length > 0 && !barcode ? null : (
              <ScanFrame locked={!!barcode} steady={steady} />
            )}
            {zoom > 0.005 ? (
              <Press
                onPress={() => {
                  select();
                  setZoom(0);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("Reset zoom")}
                style={styles.zoomPill}
              >
                <Glass interactive style={styles.zoomPillInner}>
                  <Txt variant="subheadStrong" color={Colors.accent}>
                    1×
                  </Txt>
                </Glass>
              </Press>
            ) : null}
          </View>
        </GestureDetector>
      ) : null}

      {cameraUsable && native && focused && !barcode ? (
        <DetectionOverlay
          objects={objects}
          stable={stable}
          autoCapture={autoCapture}
          onPick={(o) => void captureNative(o)}
        />
      ) : null}

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "transparent"]}
        style={[styles.fadeTop, { height: insets.top + 110 }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.7)"]}
        style={[styles.fadeBottom, { height: insets.bottom + 220 }]}
        pointerEvents="none"
      />

      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
        <IconButton
          icon="sliders"
          label={t("Settings")}
          onPress={() => navigation.navigate("Settings")}
        />
        <Txt style={styles.wordmark}>SCOPE</Txt>
        <View style={styles.topRight}>
          {cameraUsable ? (
            <IconButton
              icon={torch ? "zap" : "zap-off"}
              label={t("Flash")}
              color={torch ? Colors.accent : Colors.text}
              onPress={() => setTorch((v) => !v)}
            />
          ) : null}
          <View>
            <IconButton
              icon="bookmark"
              label={t("Saved items")}
              onPress={() => navigation.navigate("Saved")}
            />
            {assets.length > 0 ? (
              <View style={styles.count} pointerEvents="none">
                <Txt variant="caption" color={Colors.textInverse}>
                  {assets.length > 99 ? "99+" : assets.length}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {cameraUsable ? null : permission === null ? null : (
        <View style={styles.blocked}>
          <View style={styles.blockedIcon}>
            <Icon name="camera-off" size={26} color={Colors.textSecondary} />
          </View>
          <Txt variant="title" style={styles.centerText}>
            {t("Camera access is off")}
          </Txt>
          <Txt
            variant="body"
            color={Colors.textSecondary}
            style={styles.centerText}
          >
            {t("SCOPE needs the camera to see what you're pointing at.")}
          </Txt>
          {!cameraFailed ? (
            <Button
              title={
                permission.canAskAgain ? t("Allow camera") : t("Open Settings")
              }
              onPress={() =>
                permission.canAskAgain
                  ? requestPermission()
                  : Linking.openSettings()
              }
              style={styles.blockedButton}
            />
          ) : null}
          <Button
            title={t("Pick a photo instead")}
            icon="image"
            tone="secondary"
            onPress={pick}
            style={styles.blockedButton}
          />
        </View>
      )}

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.hint}>
          {barcode ? (
            <Chip
              icon="maximize"
              label={`${t("Barcode found")} · ${barcode}`}
              color={Colors.textInverse}
              bg={Colors.accent}
            />
          ) : cameraUsable ? (
            <Txt variant="headline">
              {native
                ? primary
                  ? stable
                    ? t("Got it")
                    : t("Hold steady…")
                  : t("Point at a product")
                : steady
                  ? t("Ready · tap to scan")
                  : t("Point at a product")}
            </Txt>
          ) : null}
          <Press
            onPress={() => setSearching(true)}
            haptic
            scale={0.95}
            accessibilityRole="button"
            accessibilityLabel={t("Search by name")}
          >
            <Glass interactive style={styles.searchPill}>
              <Icon name="search" size={14} color={Colors.textSecondary} />
              <Txt variant="subhead" color={Colors.textSecondary}>
                {t("or type its name")}
              </Txt>
            </Glass>
          </Press>
        </View>

        <View style={styles.controls}>
          {last ? (
            // Like the Camera app: the last capture, one tap from History.
            <Press
              onPress={() => navigation.navigate("Saved", { tab: "history" })}
              haptic
              scale={0.92}
              accessibilityRole="button"
              accessibilityLabel={t("History")}
              style={styles.recent}
            >
              <Animated.View
                key={last.id}
                entering={FadeIn.duration(350)}
                style={StyleSheet.absoluteFill}
              >
                <Image
                  source={{ uri: last.thumbnailUri ?? last.imageUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </Animated.View>
            </Press>
          ) : (
            <View style={styles.recentEmpty} />
          )}
          <Press
            onPress={shutter}
            disabled={!cameraUsable || !ready || busy}
            scale={0.92}
            accessibilityRole="button"
            accessibilityLabel={t("Point at a product")}
            style={styles.shutter}
          >
            <View style={styles.shutterInner}>
              {busy ? <ActivityIndicator color={Colors.textInverse} /> : null}
            </View>
          </Press>
          <IconButton
            icon="image"
            label={t("Pick a photo instead")}
            onPress={pickMenu}
            size={52}
          />
        </View>
      </View>

      <SearchSheet
        visible={searching}
        onClose={() => setSearching(false)}
        onSearch={(q) => {
          setSearching(false);
          navigation.navigate("Result", { query: q });
        }}
      />
    </View>
  );
}

const FRAME = 260;

/**
 * The viewfinder: four corners with a soft light line sweeping through, which
 * turn green (like a lock) once a barcode is found.
 */
function ScanFrame({
  locked,
  steady = false,
}: {
  locked: boolean;
  /** Fallback camera: the phone is held still. */
  steady?: boolean;
}) {
  const sweep = useSharedValue(0);
  const lock = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [sweep]);

  useEffect(() => {
    lock.value = withTiming(locked ? 1 : 0, { duration: 220 });
  }, [lock, locked]);

  const lineStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - lock.value),
    transform: [{ translateY: 18 + sweep.value * (FRAME - 36) }],
  }));
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - lock.value * 0.06 }],
  }));

  const corner = locked
    ? Colors.trustHigh
    : steady
      ? Colors.text
      : "rgba(255,255,255,0.7)";
  return (
    <Animated.View style={[styles.frame, frameStyle]} pointerEvents="none">
      <Animated.View style={[styles.scanLine, lineStyle]}>
        <LinearGradient
          colors={["transparent", Colors.accent, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={[styles.corner, styles.tl, { borderColor: corner }]} />
      <View style={[styles.corner, styles.tr, { borderColor: corner }]} />
      <View style={[styles.corner, styles.bl, { borderColor: corner }]} />
      <View style={[styles.corner, styles.br, { borderColor: corner }]} />
    </Animated.View>
  );
}

/** Type-to-search sheet. Holds its own text so typing never re-renders the camera. */
function SearchSheet({
  visible,
  onClose,
  onSearch,
}: {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}) {
  const insets = useSafeAreaInsets();
  // Uncontrolled: the native field owns the text, so fast typing never races
  // a re-render. State only flips when the button's enabled state changes.
  const text = useRef("");
  const [ready, setReady] = useState(false);
  const search = () => {
    const q = text.current.trim();
    if (q.length < 2) return;
    text.current = "";
    setReady(false);
    onSearch(q);
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <Press
          style={StyleSheet.absoluteFill}
          scale={1}
          onPress={onClose}
          accessibilityLabel={t("Cancel")}
        />
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}
        >
          <View style={styles.grabber} />
          <Txt variant="title">{t("Search by name")}</Txt>
          <Txt variant="subhead" color={Colors.textSecondary}>
            {t("No photo needed — type a product to compare its prices.")}
          </Txt>
          <View style={styles.searchField}>
            <Icon name="search" size={17} color={Colors.textTertiary} />
            <TextInput
              onChangeText={(v) => {
                text.current = v;
                const ok = v.trim().length >= 2;
                if (ok !== ready) setReady(ok);
              }}
              placeholder={t("Type the product name, e.g. iPhone 15 Pro 256GB")}
              placeholderTextColor={Colors.textTertiary}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={search}
              selectionColor={Colors.accent}
              clearButtonMode="while-editing"
            />
          </View>
          <Button
            title={t("Search prices")}
            onPress={search}
            disabled={!ready}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Map a box seen on screen (aspect-filled preview) to pixels in the photo,
 * with some padding so the AI still gets a little context.
 */
function cropFor(
  box: DetectedObject,
  view: { width: number; height: number },
  photo: { width: number; height: number },
  pad: number,
): Crop {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const offX = (photo.width * scale - view.width) / 2;
  const offY = (photo.height * scale - view.height) / 2;
  const px = box.width * pad;
  const py = box.height * pad;
  const x0 = Math.max(0, (box.x - px + offX) / scale);
  const y0 = Math.max(0, (box.y - py + offY) / scale);
  const x1 = Math.min(photo.width, (box.x + box.width + px + offX) / scale);
  const y1 = Math.min(photo.height, (box.y + box.height + py + offY) / scale);
  return {
    originX: Math.round(x0),
    originY: Math.round(y0),
    width: Math.round(x1 - x0),
    height: Math.round(y1 - y0),
  };
}

const CORNER = 34;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  fadeTop: { position: "absolute", top: 0, left: 0, right: 0 },
  fadeBottom: { position: "absolute", bottom: 0, left: 0, right: 0 },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: {
    ...Fonts.extrabold,
    fontSize: 15,
    letterSpacing: 5,
    color: Colors.text,
    paddingLeft: 5,
  },
  topRight: { flexDirection: "row", gap: Spacing.sm },
  zoomPill: { position: "absolute", bottom: 230 },
  zoomPillInner: {
    height: 30,
    minWidth: 46,
    paddingHorizontal: Spacing.md,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.lineStrong,
    marginBottom: Spacing.sm,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceRaised,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 17, height: 48 },
  count: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: { width: FRAME, height: FRAME, marginTop: -40 },
  scanLine: {
    position: "absolute",
    left: 14,
    right: 14,
    height: 2,
    shadowColor: Colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: 17,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  recent: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: Colors.surfaceRaised,
  },
  recentEmpty: { width: 52, height: 52 },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: "rgba(255,255,255,0.9)",
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 18,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 18,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 18,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 18,
  },
  blocked: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.md,
    marginTop: -60,
  },
  blockedIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  centerText: { textAlign: "center" },
  blockedButton: { alignSelf: "stretch", marginTop: Spacing.xs },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.xl,
  },
  hint: {
    alignItems: "center",
    gap: 2,
    minHeight: 42,
    justifyContent: "flex-end",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xxxl,
  },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
});
