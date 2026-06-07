import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { Colors, Spacing, Fonts, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ScopeBackground } from "@/components/ScopeBackground";
import { Condition, Country, AssetAttributes } from "@/types";

type Props = NativeStackScreenProps<RootStackParamList, "Confirm">;

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const CONDITIONS: { value: Condition; label: string; icon: FeatherIconName }[] = [
  { value: "NEW", label: "New", icon: "package" },
  { value: "LIKE_NEW", label: "Like New", icon: "check-circle" },
  { value: "USED", label: "Used", icon: "clock" },
];

const COUNTRIES: { value: Country; label: string; flag: FeatherIconName }[] = [
  { value: "USA", label: "USA", flag: "flag" },
  { value: "TURKEY", label: "Turkey", flag: "map-pin" },
  { value: "EUROPE", label: "Europe", flag: "globe" },
];

const CATEGORY_VARIANTS: Record<string, { sizes?: string[]; colors?: string[]; materials?: string[] }> = {
  "Fashion": {
    sizes: ["XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"],
    colors: ["Black", "White", "Brown", "Beige", "Navy", "Gray", "Red", "Blue", "Green", "Pink", "Cream"],
    materials: ["Leather", "Suede", "Canvas", "Nylon", "Cotton", "Wool", "Silk", "Denim", "Synthetic"],
  },
  "Footwear": {
    sizes: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
    colors: ["Black", "White", "Brown", "Beige", "Navy", "Gray", "Red", "Multi"],
    materials: ["Leather", "Suede", "Canvas", "Rubber", "Mesh", "Patent Leather"],
  },
  "Bags": {
    sizes: ["Mini", "Small", "Medium", "Large", "Oversized"],
    colors: ["Black", "White", "Brown", "Beige", "Navy", "Gray", "Red", "Pink", "Cream", "Multi"],
    materials: ["Leather", "Canvas", "Nylon", "Suede", "Vegan Leather", "Exotic"],
  },
  "Watches": {
    sizes: ["34mm", "36mm", "38mm", "40mm", "41mm", "42mm", "44mm", "45mm"],
    colors: ["Silver", "Gold", "Rose Gold", "Black", "Two-Tone"],
    materials: ["Stainless Steel", "Gold", "Titanium", "Ceramic", "Leather Strap", "Rubber Strap"],
  },
  "Electronics": {
    sizes: ["64GB", "128GB", "256GB", "512GB", "1TB"],
    colors: ["Black", "White", "Silver", "Gold", "Blue", "Purple", "Green", "Red"],
    materials: ["Aluminum", "Glass", "Plastic", "Titanium"],
  },
};

export default function ConfirmScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { imageBase64, initialData } = route.params;
  
  const [condition, setCondition] = useState<Condition>("LIKE_NEW");
  const [country, setCountry] = useState<Country>("USA");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);

  const category = initialData?.category || "Fashion";
  const variants = useMemo(() => {
    return CATEGORY_VARIANTS[category] || CATEGORY_VARIANTS["Fashion"];
  }, [category]);

  const handleContinue = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const attributes: AssetAttributes = {};
    if (selectedSize) attributes.size = selectedSize;
    if (selectedColor) attributes.color = selectedColor;
    if (selectedMaterial) attributes.material = selectedMaterial;

    navigation.replace("Analyzing", {
      imageBase64,
      refinements: {
        condition,
        country,
        attributes,
        itemName: initialData?.itemName,
        category: initialData?.category,
      },
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const renderSelector = (
    title: string,
    options: string[],
    selected: string | null,
    onSelect: (value: string) => void
  ) => (
    <View style={styles.selectorSection}>
      <Text style={styles.selectorTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.optionsRow}>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                selected === option && styles.optionChipSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.selectionAsync().catch(() => {});
                }
                onSelect(selected === option ? "" : option);
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={`${title}: ${option}`}
              accessibilityState={{ selected: selected === option }}
            >
              <Text
                style={[
                  styles.optionText,
                  selected === option && styles.optionTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <ScopeBackground>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.categoryLabel}>{category}</Text>
            <Text style={styles.itemName} numberOfLines={2}>
              {initialData?.itemName || "Detected Item"}
            </Text>
            <View style={styles.confidenceRow}>
              <Feather name="check-circle" size={14} color={Colors.dark.accent} />
              <Text style={styles.confidenceText}>
                {initialData?.confidenceScore || 0}% Visual Match
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeader}>CONDITION</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[
                styles.conditionCard,
                condition === c.value && styles.conditionCardSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.selectionAsync().catch(() => {});
                }
                setCondition(c.value);
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={`Condition: ${c.label}`}
              accessibilityState={{ selected: condition === c.value }}
            >
              <Feather
                name={c.icon}
                size={20}
                color={condition === c.value ? Colors.dark.accent : Colors.dark.textSecondary}
              />
              <Text
                style={[
                  styles.conditionLabel,
                  condition === c.value && styles.conditionLabelSelected,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionHeader}>MARKET REGION</Text>
        <View style={styles.countryRow}>
          {COUNTRIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[
                styles.countryCard,
                country === c.value && styles.countryCardSelected,
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.selectionAsync().catch(() => {});
                }
                setCountry(c.value);
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={`Market region: ${c.label}`}
              accessibilityState={{ selected: country === c.value }}
            >
              <Feather
                name={c.flag}
                size={18}
                color={country === c.value ? Colors.dark.accent : Colors.dark.textSecondary}
              />
              <Text
                style={[
                  styles.countryLabel,
                  country === c.value && styles.countryLabelSelected,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionHeader}>VARIANTS (Optional)</Text>
        
        {variants.sizes && renderSelector("Size", variants.sizes, selectedSize, setSelectedSize)}
        {variants.colors && renderSelector("Color", variants.colors, selectedColor, setSelectedColor)}
        {variants.materials && renderSelector("Material", variants.materials, selectedMaterial, setSelectedMaterial)}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Update valuation"
        >
          <Text style={styles.continueButtonText}>UPDATE VALUATION</Text>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
    </ScopeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  itemCard: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  itemInfo: {
    gap: Spacing.xs,
  },
  categoryLabel: {
    fontSize: Typography.micro.fontSize,
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  itemName: {
    fontSize: Typography.h3.fontSize,
    fontWeight: "700",
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
  },
  confidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  confidenceText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.accent,
    fontFamily: Fonts?.mono,
  },
  sectionHeader: {
    fontSize: Typography.micro.fontSize,
    fontWeight: "700",
    color: Colors.dark.textTertiary,
    fontFamily: Fonts?.mono,
    letterSpacing: 1,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  conditionRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  conditionCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  conditionCardSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accentTint,
  },
  conditionLabel: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  conditionLabelSelected: {
    color: Colors.dark.accent,
    fontWeight: "700",
  },
  countryRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  countryCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  countryCardSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accentTint,
  },
  countryLabel: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  countryLabelSelected: {
    color: Colors.dark.accent,
    fontWeight: "700",
  },
  selectorSection: {
    marginBottom: Spacing.lg,
  },
  selectorTitle: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
    marginBottom: Spacing.sm,
  },
  optionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  optionChipSelected: {
    borderColor: Colors.dark.accent,
    backgroundColor: Colors.dark.accentTintStrong,
  },
  optionText: {
    fontSize: Typography.label.fontSize,
    color: Colors.dark.textSecondary,
    fontFamily: Fonts?.mono,
  },
  optionTextSelected: {
    color: Colors.dark.accent,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: "#02040A",
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBorder,
  },
  continueButton: {
    backgroundColor: Colors.dark.accent,
    borderRadius: BorderRadius.lg,
    height: Spacing.buttonHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  continueButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: Fonts?.mono,
  },
});
