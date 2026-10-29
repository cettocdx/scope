import React, { useState } from "react";
import { reloadAppAsync } from "expo";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { Colors, Radius, Spacing } from "@/constants/theme";
import { Button, IconButton, Txt } from "@/components/ui";
import { t } from "@/lib/i18n";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  const restart = async () => {
    try {
      await reloadAppAsync();
    } catch {
      resetError();
    }
  };

  return (
    <View style={styles.root}>
      {__DEV__ ? (
        <IconButton
          icon="alert-circle"
          label="Error details"
          tone="surface"
          onPress={() => setShowDetails(true)}
          style={styles.details}
        />
      ) : null}
      <View style={styles.icon}>
        <Feather name="alert-triangle" size={24} color={Colors.trustMid} />
      </View>
      <Txt variant="title" style={styles.center}>
        Something went wrong
      </Txt>
      <Txt variant="body" color={Colors.textSecondary} style={styles.center}>
        Restart SCOPE to continue.
      </Txt>
      <Button
        title={t("Try again")}
        icon="refresh-cw"
        onPress={restart}
        style={styles.button}
      />

      <Modal
        visible={showDetails}
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={styles.modal}>
          <IconButton
            icon="x"
            label={t("Close")}
            tone="surface"
            onPress={() => setShowDetails(false)}
          />
          <ScrollView style={styles.flex}>
            <Txt variant="callout" selectable>
              {`${error.message}\n\n${error.stack ?? ""}`}
            </Txt>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  flex: { flex: 1 },
  details: { position: "absolute", top: 60, right: Spacing.lg },
  icon: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    backgroundColor: Colors.trustMidTint,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  button: { alignSelf: "stretch", marginTop: Spacing.md },
  modal: {
    flex: 1,
    backgroundColor: Colors.bg,
    paddingTop: 60,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
});
