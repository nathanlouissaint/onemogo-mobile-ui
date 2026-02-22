// app/onboarding/goal.tsx
import React, { useMemo, useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";

type GoalValue =
  | "lose_fat"
  | "build_muscle"
  | "improve_strength"
  | "general_fitness";

const GOALS: { value: GoalValue; title: string; desc: string }[] = [
  { value: "lose_fat", title: "Lose fat", desc: "Focus on weight trend and consistency." },
  { value: "build_muscle", title: "Build muscle", desc: "Emphasis on volume and progressive overload." },
  { value: "improve_strength", title: "Improve strength", desc: "Track PRs and heavy lifts." },
  { value: "general_fitness", title: "General fitness", desc: "Balanced approach across metrics." },
];

export default function OnboardingGoalScreen() {
  const [goal, setGoal] = useState<GoalValue | null>(null);

  const canContinue = useMemo(() => Boolean(goal), [goal]);

  const onContinue = () => {
    if (!goal) return;
    router.push({
      pathname: "/onboarding/frequency",
      params: { goal },
    });
  };

  const onBackToLogin = () => {
    // Replace so onboarding is not kept in the back stack.
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
                onPress={() => setGoal(g.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {g.title}
                </Text>
                <Text style={styles.optionDesc}>{g.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ height: 16 }} />

        <PrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} />

        <View style={{ height: 10 }} />

        <Pressable
          onPress={onBackToLogin}
          style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
  },
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
  optionSelected: {
    borderColor: theme.colors.primary,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
  },
  optionTitleSelected: {
    color: theme.colors.primary,
  },
  optionDesc: {
    marginTop: 4,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  linkBtn: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  linkText: {
    color: theme.colors.textMuted,
    textDecorationLine: "underline",
    fontSize: 13,
  },
});