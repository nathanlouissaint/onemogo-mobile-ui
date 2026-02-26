// app/onboarding/strength-mode.tsx
import React, { useMemo, useState, useEffect } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";
import {
  useOnboarding,
  StrengthTrackingMode,
} from "../../src/onboarding/OnboardingContext";
import { BackToLogin } from "../../src/components/BackToLogin";

const OPTIONS: { value: StrengthTrackingMode; title: string; desc: string }[] = [
  { value: "prs", title: "PRs", desc: "Track max lifts and personal records." },
  { value: "volume", title: "Volume", desc: "Track sets, reps, and total work." },
  { value: "both", title: "Both", desc: "Track PRs and volume together." },
];

export default function StrengthModeScreen() {
  const { draft, setStrengthMode } = useOnboarding();
  const [mode, setMode] = useState<StrengthTrackingMode | null>(
    draft.strengthTrackingMode ?? null
  );

  useEffect(() => {
    if (!draft.goal) {
      router.replace("/onboarding/goal");
      return;
    }
    if (typeof draft.trainingDaysPerWeek !== "number") {
      router.replace("/onboarding/frequency");
      return;
    }
  }, [draft.goal, draft.trainingDaysPerWeek]);

  const canContinue = useMemo(() => Boolean(mode), [mode]);

  const onContinue = () => {
    if (!mode) return;
    setStrengthMode(mode);
    router.push("/onboarding/experience");
  };

  const onBack = () => {
    router.replace("/onboarding/frequency");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Strength tracking</Text>
        <Text style={styles.sub}>How should we track your progress?</Text>

        <View style={{ height: 12 }} />

        <View style={{ gap: 10 }}>
          {OPTIONS.map((o) => {
            const selected = mode === o.value;

            return (
              <Pressable
                key={o.value}
                onPress={() => setMode(o.value)}
                style={({ pressed }) => [
                  styles.option,
                  (pressed || selected) && styles.optionActive,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                {({ pressed }) => (
                  <>
                    <Text
                      style={[
                        styles.optionTitle,
                        (pressed || selected) && styles.optionTitleActive,
                      ]}
                    >
                      {o.title}
                    </Text>
                    <Text
                      style={[
                        styles.optionDesc,
                        (pressed || selected) && styles.optionDescActive,
                      ]}
                    >
                      {o.desc}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 16 }} />

        {/* Navigation Row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Back" onPress={onBack} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label="Continue"
              onPress={onContinue}
              disabled={!canContinue}
            />
          </View>
        </View>

        <View style={{ height: 10 }} />
        <BackToLogin />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 14, color: theme.colors.textMuted, textAlign: "center" },

  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14,
    borderRadius: 14,
  },
  optionActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },

  optionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  optionTitleActive: { color: "#000000" },

  optionDesc: { marginTop: 4, fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  optionDescActive: { color: "#333333" },
});