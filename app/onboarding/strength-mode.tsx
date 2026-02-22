import React, { useMemo } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";
import { useOnboarding, StrengthTrackingMode } from "../../src/onboarding/OnboardingContext";

const MODES: { value: StrengthTrackingMode; title: string; desc: string }[] = [
  { value: "prs", title: "PRs", desc: "Track personal records per exercise." },
  { value: "volume", title: "Total volume", desc: "Track sets × reps × weight over time." },
  { value: "both", title: "Both", desc: "Track PRs and volume." },
];

export default function StrengthModeScreen() {
  const { draft, setStrengthMode } = useOnboarding();
  const canContinue = useMemo(() => Boolean(draft.strengthTrackingMode), [draft.strengthTrackingMode]);

  const onContinue = () => {
    if (!draft.strengthTrackingMode) return;
    router.push("/onboarding/experience");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Strength tracking</Text>
        <Text style={styles.sub}>How should we track your strength progress?</Text>

        <View style={{ height: 12 }} />

        <View style={{ gap: 10 }}>
          {MODES.map((m) => {
            const selected = draft.strengthTrackingMode === m.value;
            return (
              <Pressable
                key={m.value}
                onPress={() => setStrengthMode(m.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {m.title}
                </Text>
                <Text style={styles.optionDesc}>{m.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 16 }} />
        <PrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 14, color: theme.colors.textMuted, textAlign: "center", lineHeight: 20 },
  option: { borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, padding: 14, borderRadius: 14 },
  optionSelected: { borderColor: theme.colors.primary },
  optionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  optionTitleSelected: { color: theme.colors.primary },
  optionDesc: { marginTop: 4, fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
});