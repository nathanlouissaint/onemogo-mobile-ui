import React, { useMemo, useState } from "react";
import { Text, View, TextInput, StyleSheet } from "react-native";
import { router } from "expo-router";

import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";
import { useOnboarding } from "../../src/onboarding/OnboardingContext";

export default function FrequencyScreen() {
  const { draft, setDays } = useOnboarding();
  const [raw, setRaw] = useState(draft.trainingDaysPerWeek?.toString() ?? "");

  const days = useMemo(() => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [raw]);

  const valid = useMemo(() => days !== null && days >= 1 && days <= 7, [days]);

  const onContinue = () => {
    if (!valid || days === null) return;
    setDays(days);
    router.push("/onboarding/strength-mode");
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Training frequency</Text>
        <Text style={styles.sub}>How many days per week will you train?</Text>

        <View style={{ height: 12 }} />

        <TextInput
          value={raw}
          onChangeText={setRaw}
          placeholder="1 - 7"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
          style={styles.input}
        />

        <View style={{ height: 16 }} />
        <PrimaryButton label="Continue" onPress={onContinue} disabled={!valid} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 14, color: theme.colors.textMuted, textAlign: "center" },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    textAlign: "center",
  },
});