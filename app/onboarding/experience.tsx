// app/onboarding/experience.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "../../src/components/Card";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import { BackToLogin } from "../../src/components/BackToLogin";
import { submitOnboarding } from "../../src/lib/supabase";
import { ExperienceLevel, useOnboarding } from "../../src/onboarding/OnboardingContext";
import { useSession } from "../../src/session/SessionContext";

const LEVELS: { value: ExperienceLevel; title: string; desc: string }[] = [
  { value: "beginner", title: "Beginner", desc: "New or returning after a long break." },
  { value: "intermediate", title: "Intermediate", desc: "Consistent training for months/years." },
  { value: "advanced", title: "Advanced", desc: "Highly consistent with structured training." },
];

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") return anyErr.error_description;
  }
  return fallback;
}

export default function ExperienceScreen() {
  const { draft, setExperience, setBaselineWeight, reset } = useOnboarding();
  const { refresh } = useSession();

  const [level, setLevel] = useState<ExperienceLevel | null>(draft.experienceLevel ?? null);
  const [weightRaw, setWeightRaw] = useState(
    typeof draft.baselineWeight === "number" ? String(draft.baselineWeight) : ""
  );

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!draft.goal) {
      router.replace("/onboarding/goal");
      return;
    }
    if (typeof draft.trainingDaysPerWeek !== "number") {
      router.replace("/onboarding/frequency");
      return;
    }
    if (!draft.strengthTrackingMode) {
      router.replace("/onboarding/strength-mode");
      return;
    }
  }, [draft.goal, draft.trainingDaysPerWeek, draft.strengthTrackingMode]);

  const weight = useMemo(() => {
    const n = Number(weightRaw);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [weightRaw]);

  const valid = useMemo(() => {
    return (
      !!draft.goal &&
      typeof draft.trainingDaysPerWeek === "number" &&
      !!draft.strengthTrackingMode &&
      !!level &&
      weight !== null &&
      weight > 0
    );
  }, [draft.goal, draft.trainingDaysPerWeek, draft.strengthTrackingMode, level, weight]);

  const onBack = () => {
    router.replace("/onboarding/strength-mode");
  };

  const onFinish = async () => {
    setErr(null);
    if (!valid || !level || weight === null) return;

    setExperience(level);
    setBaselineWeight(weight);

    setSubmitting(true);
    try {
      await submitOnboarding({
        goal: draft.goal!,
        trainingDaysPerWeek: draft.trainingDaysPerWeek!,
        strengthTrackingMode: draft.strengthTrackingMode!,
        experienceLevel: level,
        baselineWeight: weight,
      });

      await refresh();
      reset();
    } catch (e: unknown) {
      const msg = getErrMsg(e, "Failed to finish onboarding");
      setErr(msg);
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Experience & baseline</Text>
        <Text style={styles.sub}>We use this to personalize your dashboard.</Text>

        <View style={{ height: 12 }} />

        <Text style={styles.section}>Experience level</Text>
        <View style={{ gap: 10, marginTop: 10 }}>
          {LEVELS.map((o) => {
            const selected = level === o.value;

            return (
              <Pressable
                key={o.value}
                onPress={() => setLevel(o.value)}
                disabled={submitting}
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

        <Text style={styles.section}>Baseline weight</Text>
        <TextInput
          value={weightRaw}
          onChangeText={setWeightRaw}
          placeholder="e.g., 185"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          style={styles.input}
          editable={!submitting}
        />

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <View style={{ height: 16 }} />

        {/* Navigation (arrows) */}
        <View style={styles.navRow}>
          <Pressable
            onPress={onBack}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              (submitting || pressed) && { opacity: submitting ? 0.4 : 0.85 },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </Pressable>

          <Pressable
            onPress={onFinish}
            disabled={!valid || submitting}
            accessibilityRole="button"
            accessibilityLabel={submitting ? "Finishing" : "Finish"}
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              (!valid || submitting || pressed) && {
                opacity: !valid || submitting ? 0.4 : 0.85,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator />
            ) : (
              <Ionicons name="chevron-forward" size={24} color={theme.colors.text} />
            )}
          </Pressable>
        </View>

        <View style={{ height: 10 }} />
        <BackToLogin />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "900", color: theme.colors.text, textAlign: "center" },
  sub: { marginTop: 8, fontSize: 14, color: theme.colors.textMuted, textAlign: "center" },
  section: { marginTop: 6, color: theme.colors.textFaint, fontWeight: "800" },

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

  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    padding: 14,
    borderRadius: 14,
    fontSize: 16,
    textAlign: "center",
  },

  error: {
    marginTop: 10,
    color: theme.colors.danger ?? "red",
    textAlign: "center",
    fontWeight: "800",
  },

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