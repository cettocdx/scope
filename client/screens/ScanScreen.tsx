import React, { useCallback, useRef, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { Icon } from "@/components/Icon";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import {
  Button,
  Chip,
  Glass,
  IconButton,
  Press,
  Txt,
  select,
  tap,
} from "@/components/ui";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { putPhoto } from "@/lib/scan-session";
import { quotaStatus, FREE_DAILY_SCANS } from "@/lib/quota";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useAuth } from "@/contexts/AuthContext";
import { t } from "@/lib/i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

/** Long edge we send to the AI: sharp enough to read labels, small enough to be fast. */
const MAX_EDGE = 1280;

async function prepare(uri: string, width?: number, height?: number) {
  const landscape = (width ?? 0) > (height ?? 0);
  const resize =
    !width || !height || Math.max(width, height) > MAX_EDGE
      ? [{ resize: landscape ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
      : [];
  const out = await manipulateAsync(uri, resize, {
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
  const { assets } = usePortfolio();
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
      {cameraUsable && focused ? (
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
            if (data && /^\d{8,14}$/.test(data) && data !== barcode)
              setBarcode(data);
          }}
        />
      ) : null}

      {cameraUsable ? (
        <GestureDetector gesture={pinch}>
          <View style={styles.center}>
            <View style={styles.frame} pointerEvents="none">
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
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
                <Glass style={styles.zoomPillInner}>
                  <Txt variant="caption" color={Colors.accent}>
                    {`${(1 + zoom * 9).toFixed(1)}×`}
                  </Txt>
                </Glass>
              </Press>
            ) : null}
          </View>
        </GestureDetector>
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
            <>
              <Txt variant="headline">{t("Point at a product")}</Txt>
              <Txt variant="callout" color={Colors.textSecondary}>
                {t("Tap to scan · or pick a photo")}
              </Txt>
            </>
          ) : null}
        </View>

        <View style={styles.controls}>
          <IconButton
            icon="image"
            label={t("Pick a photo instead")}
            onPress={pick}
            size={52}
          />
          <Press
            onPress={capture}
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
            icon="type"
            label={t("Search by name")}
            onPress={() => setSearching(true)}
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
  frame: { width: 260, height: 260, marginTop: -40 },
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
