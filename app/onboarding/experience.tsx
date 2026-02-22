import React, { useMemo } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";
import { useOnboarding, ExperienceLevel } from "../../src/onboarding/OnboardingContext";

const LEVELS: { value: ExperienceLevel; title: string; desc: string }[] = [
  { value: "beginner", title: "Beginner", desc: "New or inconsistent training." },
  { value: "intermediate", title: "Intermediate", desc: "Consistent training, some progression." },
  { value: "advanced", title: "Advanced", desc: "Years of training, structured programming." },
];

export default function ExperienceScreen() {
  const { draft, setExperience } = useOnboarding();
  const canContinue = useMemo(() => Boolean(draft.experienceLevel), [draft.experienceLevel]);

  const onContinue = () => {
    if (!draft.experienceLevel) return;
    router.push("/onboarding/weight");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Experience level</Text>
        <Text style={styles.sub}>This helps us interpret strength progress correctly.</Text>

        <View style={{ height: 12 }} />

        <View style={{ gap: 10 }}>
          {LEVELS.map((l) => {
            const selected = draft.experienceLevel === l.value;
            return (
              <Pressable
                key={l.value}
                onPress={() => setExperience(l.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                  {l.title}
                </Text>
                <Text style={styles.optionDesc}>{l.desc}</Text>
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