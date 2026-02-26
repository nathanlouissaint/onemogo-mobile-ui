// app/onboarding/goal.tsx
import React, { useMemo, useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";
import { useOnboarding, GoalValue } from "../../src/onboarding/OnboardingContext";
import { BackToLogin } from "../../src/components/BackToLogin";

const GOALS: { value: GoalValue; title: string; desc: string }[] = [
  { value: "lose_fat", title: "Lose fat", desc: "Focus on weight trend and consistency." },
  { value: "build_muscle", title: "Build muscle", desc: "Emphasis on volume and progressive overload." },
  { value: "improve_strength", title: "Improve strength", desc: "Track PRs and heavy lifts." },
  { value: "general_fitness", title: "General fitness", desc: "Balanced approach across metrics." },
];

export default function OnboardingGoalScreen() {
  const { setGoal } = useOnboarding();
  const [goal, pickGoal] = useState<GoalValue | null>(null);

  const canContinue = useMemo(() => Boolean(goal), [goal]);

  const onContinue = () => {
    if (!goal) return;
    setGoal(goal);
    router.push("/onboarding/frequency");
  };

  const onBack = () => {
    router.replace("/login");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Set your goal</Text>
        <Text style={styles.sub}>
          This helps us prioritize your dashboard metrics and progress tracking.
        </Text>

        <View style={{ height: 12 }} />

        <View style={{ gap: 10 }}>
          {GOALS.map((g) => {
            const selected = goal === g.value;

            return (
              <Pressable
                key={g.value}
                onPress={() => pickGoal(g.value)}
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
                      {g.title}
                    </Text>
                    <Text
                      style={[
                        styles.optionDesc,
                        (pressed || selected) && styles.optionDescActive,
                      ]}
                    >
                      {g.desc}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 16 }} />

        {/* Navigation */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Back" onPress={onBack} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} />
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
  sub: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
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
  optionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  optionTitleActive: { color: "#000000" },
  optionDesc: { marginTop: 4, fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  optionDescActive: { color: "#333333" },
});