import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCameraPermissions } from "expo-camera";
import { Icon } from "@/components/Icon";

import { Colors, Fonts, Radius, Spacing } from "@/constants/theme";
import { Button, Press, Txt, tap } from "@/components/ui";
import { Welcome } from "@/components/Welcome";
import Reanimated, { FadeIn } from "react-native-reanimated";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { setOnboarded } from "@/lib/onboarding";
import { t, type StringKey } from "@/lib/i18n";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const PAGES: { title: StringKey; body: StringKey }[] = [
  {
    title: "Knows what anything is.",
    body: "Point at any product — brand, model and variant in seconds.",
  },
  {
    title: "Finds the cheapest and the safest.",
    body: "Searches shops in the US, Europe and Türkiye at once and scores every seller.",
  },
  {
    title: "The exact item, one tap away.",
    body: "Finds the same item in shops and opens the seller's own page.",
  },
];

/** Loops `run` while `active`, restarting it each time the page comes back. */
function useLoop(active: boolean, build: () => Animated.CompositeAnimation) {
  const buildRef = useRef(build);
  buildRef.current = build;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(buildRef.current());
    loop.start();
    return () => loop.stop();
  }, [active]);
}

const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

function timing(
  v: Animated.Value,
  toValue: number,
  duration: number,
  delay = 0,
) {
  return Animated.timing(v, {
    toValue,
    duration,
    delay,
    easing: ease,
    useNativeDriver: true,
  });
}

// ---------------------------------------------------------------------------
// 1 · Recognise: the scan frame locks onto a point, the match lands.
// ---------------------------------------------------------------------------

function RecogniseArt({ active }: { active: boolean }) {
  const lock = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const chip = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useLoop(active, () =>
    Animated.sequence([
      Animated.parallel([
        timing(lock, 0, 0),
        timing(dot, 0, 0),
        timing(chip, 0, 0),
      ]),
      timing(lock, 1, 700, 250),
      Animated.spring(dot, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.parallel([
        timing(chip, 1, 380, 80),
        // Two soft rings ripple out from the locked point.
        Animated.stagger(260, [
          Animated.timing(ring1, {
            toValue: 1,
            duration: 1300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(ring2, {
            toValue: 1,
            duration: 1300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.delay(500),
      Animated.parallel([
        timing(dot, 0, 260),
        timing(chip, 0, 260),
        timing(lock, 0, 320),
        timing(ring1, 0, 0),
        timing(ring2, 0, 0),
      ]),
      Animated.delay(250),
    ]),
  );

  const frameScale = lock.interpolate({
    inputRange: [0, 1],
    outputRange: [1.22, 1],
  });
  const frameOpacity = lock.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <View style={art.center}>
      {[ring1, ring2].map((r, i) => (
        <Animated.View
          key={i}
          style={[
            art.ring,
            {
              opacity: r.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.55, 0],
              }),
              transform: [
                {
                  scale: r.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.25, 1.35],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
      <Animated.View
        style={[
          art.frame,
          { opacity: frameOpacity, transform: [{ scale: frameScale }] },
        ]}
      >
        <View style={[art.corner, art.tl]} />
        <View style={[art.corner, art.tr]} />
        <View style={[art.corner, art.bl]} />
        <View style={[art.corner, art.br]} />
        <Animated.View style={[art.dot, { transform: [{ scale: dot }] }]} />
      </Animated.View>
      <Animated.View
        style={[
          art.matchCard,
          {
            opacity: chip,
            transform: [
              {
                translateY: chip.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={art.matchChip}>
          <Icon name="check-circle" size={12} color={Colors.trustHigh} />
          <Txt variant="caption" color={Colors.trustHigh}>
            {t("Exact match")}
          </Txt>
        </View>
        <View style={[art.bar, { width: 168 }]} />
        <View style={[art.bar, art.barDim, { width: 104 }]} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2 · Compare: three markets fill in, the trusted local pick gets the badge.
// ---------------------------------------------------------------------------

const MARKET_ROWS: {
  flag: string;
  label: StringKey;
  fill: number;
  pick?: boolean;
}[] = [
  { flag: "🇺🇸", label: "US", fill: 0.82 },
  { flag: "🇪🇺", label: "EU", fill: 0.58 },
  { flag: "🇹🇷", label: "TR", fill: 0.66, pick: true },
];

function CompareArt({ active }: { active: boolean }) {
  const fills = useRef(MARKET_ROWS.map(() => new Animated.Value(0))).current;
  const badge = useRef(new Animated.Value(0)).current;

  useLoop(active, () =>
    Animated.sequence([
      Animated.parallel([
        ...fills.map((f) => timing(f, 0, 0)),
        timing(badge, 0, 0),
      ]),
      Animated.stagger(
        160,
        fills.map((f) => timing(f, 1, 700, 200)),
      ),
      Animated.spring(badge, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.delay(1700),
      Animated.parallel([
        ...fills.map((f) => timing(f, 0, 320)),
        timing(badge, 0, 240),
      ]),
      Animated.delay(200),
    ]),
  );

  return (
    <View style={art.center}>
      <View style={art.compareCard}>
        {MARKET_ROWS.map((row, i) => (
          <Animated.View
            key={row.label}
            style={[
              art.marketRow,
              row.pick && {
                borderColor: badge.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(255,255,255,0)", "rgba(255,255,255,0.5)"],
                }),
              },
            ]}
          >
            <Txt style={art.flag}>{row.flag}</Txt>
            <View style={art.marketText}>
              <Txt variant="calloutStrong">{t(row.label)}</Txt>
              <View style={art.track}>
                <Animated.View
                  style={[
                    art.fill,
                    row.pick && { backgroundColor: Colors.accent },
                    {
                      width: `${row.fill * 100}%`,
                      transform: [{ scaleX: fills[i] }],
                    },
                  ]}
                />
              </View>
            </View>
            <Icon name="shield" size={15} color={Colors.trustHigh} />
            {row.pick ? (
              <Animated.View
                style={[
                  art.pickBadge,
                  { opacity: badge, transform: [{ scale: badge }] },
                ]}
              >
                <Icon name="award" size={10} color={Colors.textInverse} />
                <Txt
                  variant="caption"
                  color={Colors.textInverse}
                  style={art.pickText}
                >
                  {t("Recommended")}
                </Txt>
              </Animated.View>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3 · Same item: shop cards fan out, the match is confirmed.
// ---------------------------------------------------------------------------

function SameItemArt({ active }: { active: boolean }) {
  const fan = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  useLoop(active, () =>
    Animated.sequence([
      Animated.parallel([timing(fan, 0, 0), timing(check, 0, 0)]),
      timing(fan, 1, 800, 250),
      Animated.spring(check, {
        toValue: 1,
        friction: 5,
        tension: 130,
        useNativeDriver: true,
      }),
      Animated.delay(1700),
      Animated.parallel([timing(check, 0, 240), timing(fan, 0, 420)]),
      Animated.delay(200),
    ]),
  );

  const cards = [
    { x: -84, r: "-9deg", z: 1 },
    { x: 84, r: "9deg", z: 1 },
    { x: 0, r: "0deg", z: 2 },
  ];

  return (
    <View style={art.center}>
      <View style={art.fanStage}>
        {cards.map((c, i) => (
          <Animated.View
            key={i}
            style={[
              art.shopCard,
              {
                zIndex: c.z,
                transform: [
                  {
                    translateX: fan.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, c.x],
                    }),
                  },
                  {
                    rotate: fan.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", c.r],
                    }),
                  },
                  { scale: c.z === 2 ? 1.06 : 0.94 },
                ],
              },
            ]}
          >
            <View style={art.shopThumb}>
              <Icon name="shopping-bag" size={26} color="rgba(0,0,0,0.28)" />
            </View>
            <View style={art.shopBody}>
              <View style={[art.bar, { width: 74, height: 8 }]} />
              <View style={[art.bar, art.barDim, { width: 52, height: 8 }]} />
              <View style={[art.bar, art.priceBar]} />
            </View>
            {c.z === 2 ? (
              <Animated.View
                style={[art.checkBadge, { transform: [{ scale: check }] }]}
              >
                <Icon name="check" size={14} color={Colors.textInverse} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ))}
      </View>
      <Animated.View style={[art.sameChip, { opacity: check }]}>
        <Icon name="external-link" size={12} color={Colors.textSecondary} />
        <Txt variant="caption" color={Colors.textSecondary}>
          {t("Opens the seller's page")}
        </Txt>
      </Animated.View>
    </View>
  );
}

const ARTS = [RecogniseArt, CompareArt, SameItemArt];

// ---------------------------------------------------------------------------

export default function OnboardingScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [stage, setStage] = useState<"welcome" | "tour">("welcome");
  const [, requestCamera] = useCameraPermissions();
  const last = page === PAGES.length - 1;

  const finish = useCallback(
    async (askCamera: boolean) => {
      if (askCamera) await requestCamera().catch(() => null);
      await setOnboarded(true);
      navigation.reset({ index: 0, routes: [{ name: "Scan" }] });
    },
    [navigation, requestCamera],
  );

  const next = () => {
    if (last) {
      void finish(true);
      return;
    }
    tap();
    pager.current?.scrollTo({ x: width * (page + 1), animated: true });
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (stage === "welcome") {
    return (
      <Welcome
        onStart={() => {
          tap();
          setStage("tour");
        }}
        onSkip={() => void finish(true)}
      />
    );
  }

  return (
    <Reanimated.View entering={FadeIn.duration(450)} style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
        <Txt style={styles.wordmark}>SCOPE</Txt>
        {!last ? (
          <Press
            onPress={() => finish(false)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t("Skip")}
          >
            <Txt variant="bodyStrong" color={Colors.textSecondary}>
              {t("Skip")}
            </Txt>
          </Press>
        ) : (
          <View />
        )}
      </View>

      <Animated.ScrollView
        ref={pager}
        style={styles.pager}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
          },
        )}
        onMomentumScrollEnd={onEnd}
      >
        {PAGES.map((p, i) => {
          const Art = ARTS[i];
          const range = [(i - 1) * width, i * width, (i + 1) * width];
          const textOpacity = scrollX.interpolate({
            inputRange: range,
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });
          const textShift = scrollX.interpolate({
            inputRange: range,
            outputRange: [48, 0, -48],
            extrapolate: "clamp",
          });
          return (
            <View key={p.title} style={{ width }}>
              <View style={styles.art}>
                <Art active={page === i} />
              </View>
              <Animated.View
                style={[
                  styles.copy,
                  {
                    opacity: textOpacity,
                    transform: [{ translateX: textShift }],
                  },
                ]}
              >
                <Txt style={styles.title} accessibilityRole="header">
                  {t(p.title)}
                </Txt>
                <Txt
                  variant="body"
                  color={Colors.textSecondary}
                  style={styles.body}
                >
                  {t(p.body)}
                </Txt>
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <View
          style={styles.dots}
          accessibilityLabel={`${page + 1} / ${PAGES.length}`}
        >
          {PAGES.map((_, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: scrollX.interpolate({
                      inputRange: range,
                      outputRange: [8, 26, 8],
                      extrapolate: "clamp",
                    }),
                    backgroundColor: scrollX.interpolate({
                      inputRange: range,
                      outputRange: [
                        Colors.lineStrong,
                        Colors.accent,
                        Colors.lineStrong,
                      ],
                      extrapolate: "clamp",
                    }),
                  },
                ]}
              />
            );
          })}
        </View>
        <Button
          title={last ? t("Start scanning") : t("Continue")}
          icon={last ? "camera" : undefined}
          onPress={next}
        />
        <Txt variant="caption" color={Colors.textTertiary} style={styles.note}>
          {last
            ? t(
                "Your photos are only used to find the product. We don't keep them.",
              )
            : " "}
        </Txt>
      </View>
    </Reanimated.View>
  );
}

const CORNER = 40;

const art = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    top: "50%",
    width: 240,
    height: 240,
    marginTop: -120 - 42,
    borderRadius: 120,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  frame: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: Colors.text,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 6,
    borderLeftWidth: 6,
    borderTopLeftRadius: 22,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 6,
    borderRightWidth: 6,
    borderTopRightRadius: 22,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 6,
    borderLeftWidth: 6,
    borderBottomLeftRadius: 22,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 6,
    borderRightWidth: 6,
    borderBottomRightRadius: 22,
  },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
  },
  matchCard: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
    width: 200,
  },
  matchChip: { flexDirection: "row", alignItems: "center", gap: 5 },
  bar: { height: 10, borderRadius: 5, backgroundColor: Colors.surfacePressed },
  barDim: { backgroundColor: Colors.surfaceRaised },
  compareCard: { width: 292, gap: Spacing.sm },
  marketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  flag: { fontSize: 22 },
  marketText: { flex: 1, gap: 7 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceRaised,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textTertiary,
    transformOrigin: "left",
  },
  pickBadge: {
    position: "absolute",
    top: -10,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
  },
  pickText: { ...Fonts.semibold },
  fanStage: {
    width: 300,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
  },
  shopCard: {
    position: "absolute",
    width: 124,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: "visible",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  shopThumb: {
    height: 104,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    backgroundColor: "#F5F5F2",
    alignItems: "center",
    justifyContent: "center",
  },
  shopBody: { padding: Spacing.md, gap: 7 },
  priceBar: {
    width: 46,
    height: 12,
    backgroundColor: Colors.textSecondary,
    marginTop: 2,
  },
  checkBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.bg,
  },
  sameChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.xl,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.sm,
  },
  wordmark: {
    ...Fonts.extrabold,
    fontSize: 15,
    letterSpacing: 5,
    color: Colors.text,
  },
  pager: { flex: 1 },
  art: { flex: 1, justifyContent: "center" },
  copy: {
    paddingHorizontal: Spacing.xxl + 4,
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl,
    minHeight: 190,
    justifyContent: "flex-end",
  },
  title: {
    ...Fonts.bold,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -1,
    color: Colors.text,
  },
  body: { fontSize: 16, lineHeight: 23 },
  bottom: { paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  dots: { flexDirection: "row", gap: 6, alignSelf: "center" },
  dot: { height: 8, borderRadius: 4 },
  note: { textAlign: "center", minHeight: 14 },
});
