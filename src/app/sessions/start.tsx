import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Screen } from "../../components/Screen";
import { theme } from "../../constants/theme";

import { getActiveWorkoutSession } from "../../lib/workouts";
import { createWorkoutSessionFromTemplate } from "../../lib/workouts.mutations";

import { useSession } from "../../session/SessionContext";

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as Record<string, unknown>;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") {
      return anyErr.error_description;
    }
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

export default function StartWorkoutScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const { user, loading: sessionLoading } = useSession();

  const tid = useMemo(() => {
    const raw = Array.isArray(templateId) ? templateId[0] : templateId;
    return (raw ?? "").toString().trim();
  }, [templateId]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onStart = useCallback(async () => {
    if (sessionLoading) return;

    if (!user?.id) {
      setErr("Not authenticated.");
      return;
    }

    if (!tid) {
      setErr("Missing templateId.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const active = await getActiveWorkoutSession(user.id);

      if (active?.id) {
        router.replace(`/sessions/${encodeURIComponent(active.id)}`);
        return;
      }

      const created = await createWorkoutSessionFromTemplate({
        userId: user.id,
        templateId: tid,
      });

      if (!created?.id) {
        throw new Error("Session creation failed (missing id).");
      }

      router.replace(`/sessions/${encodeURIComponent(created.id)}`);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to start workout"));
    } finally {
      setLoading(false);
    }
  }, [sessionLoading, user?.id, tid]);

  return (
    <Screen>
      <Card>
        <Text style={styles.title}>Start Workout</Text>

        <Text style={styles.meta}>Template ID: {tid || "—"}</Text>

        {err ? <Text style={styles.error}>{err}</Text> : null}

        <View style={{ marginTop: theme.spacing.lg }}>
          <PrimaryButton
            label={loading ? "Starting…" : "Start"}
            onPress={onStart}
            disabled={loading || sessionLoading}
          />
          <View style={{ height: 12 }} />
          <PrimaryButton label="Back" onPress={() => router.back()} />
        </View>

        {(loading || sessionLoading) && (
          <View style={{ marginTop: theme.spacing.md, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={styles.meta}>
              {sessionLoading ? "Loading session…" : "Starting workout…"}
            </Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: "900",
  },
  meta: {
    marginTop: 10,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },
  error: {
    marginTop: 12,
    color: "#ff6b6b",
    fontWeight: "800",
  },
});