// app/onboarding/review.tsx
import React from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { theme } from "../../src/constants/theme";
import { BackToLogin } from "../../src/components/BackToLogin";

export default function ReviewScreen() {
  const onBack = () => {
    router.replace("/onboarding/experience");
  };

  const onContinue = () => {
    // Placeholder until implemented
    router.replace("/(tabs)");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Review</Text>

        <View style={{ height: 8 }} />

        <Text style={styles.sub}>
          This screen is coming next. It must have a default export so Expo Router can load it.
        </Text>

        <View style={{ height: 16 }} />

        {/* Navigation (arrows) */}
        <View style={styles.navRow}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>

          <Pressable
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={{ height: 10 }} />
        <BackToLogin />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  sub: { color: theme.colors.textMuted },

  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconBtn: {
    height: 48,
    width: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});