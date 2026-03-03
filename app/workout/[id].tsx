// app/workout/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import {
  completeWorkoutSession,
  getWorkoutSessionById,
} from "../../src/lib/workouts";
import type { WorkoutSession } from "../../src/lib/workouts";

import { useSession } from "../../src/session/SessionContext";

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string")
      return anyErr.error_description;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const sessionId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return (raw ?? "").toString();
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [session, setSession] = useState<WorkoutSession | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId || !user?.id) {
      setErr(!sessionId ? "Missing session id." : "Not authenticated.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      // RLS should ensure user can only read their own session
      const data = await getWorkoutSessionById(sessionId);
      setSession(data);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to load workout session"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const isCompleted = !!session?.ended_at;

  const onComplete = useCallback(() => {
    if (!session?.id) return;
    if (isCompleted) return;

    Alert.alert(
      "Mark complete?",
      "This will end the current session and compute duration.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          style: "default",
          onPress: async () => {
            setCompleting(true);
            setErr(null);
            try {
              await completeWorkoutSession({ sessionId: session.id });
              await fetchSession();
              Alert.alert("Completed", "Workout session marked complete.");
            } catch (e: unknown) {
              setErr(getErrMsg(e, "Failed to complete workout session"));
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  }, [session?.id, isCompleted, fetchSession, session]);

  const onRetry = async () => {
    await fetchSession();
  };

  const title = session?.title?.trim() ? session.title : "Workout";
  const sub =
    `${formatActivityType(session?.activity_type)}` +
    (typeof session?.duration_min === "number" ? ` • ${session.duration_min} min` : "");

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Workout</Text>
          <Text style={styles.title} numberOfLines={2}>
            {loading ? "Loading..." : title}
          </Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>

        {loading ? (
          <Card>
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading session…</Text>
            </View>
          </Card>
        ) : err ? (
          <Card>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={onRetry} />
            </View>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </Card>
        ) : session ? (
          <>
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Status</Text>
              <Text style={styles.body}>
                {session.ended_at ? "Completed" : "Active"}
              </Text>

              <Text style={styles.meta}>
                Started:{" "}
                {session.started_at
                  ? new Date(session.started_at).toLocaleString()
                  : "—"}
              </Text>

              <Text style={styles.meta}>
                Ended:{" "}
                {session.ended_at ? new Date(session.ended_at).toLocaleString() : "—"}
              </Text>

              {session.plan_id ? (
                <Text style={styles.meta}>Linked plan: {session.plan_id}</Text>
              ) : null}
            </Card>

            <Card>
              <Text style={styles.section}>Actions</Text>

              <View style={{ marginTop: theme.spacing.lg }}>
                <PrimaryButton
                  label={
                    completing
                      ? "Completing…"
                      : session.ended_at
                      ? "Completed"
                      : "Mark Complete"
                  }
                  onPress={onComplete}
                  disabled={completing || !!session.ended_at}
                />
                <View style={{ height: 12 }} />
                <PrimaryButton label="Back" onPress={() => router.back()} />
              </View>
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.meta}>Session not found.</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Back" onPress={() => router.back()} />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  header: { marginBottom: theme.spacing.lg },
  kicker: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xxl,
    fontWeight: "900",
    marginTop: 8,
  },
  sub: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  center: { alignItems: "center", paddingVertical: 10 },
  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },
  body: {
    color: theme.colors.text,
    marginTop: 10,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorText: { color: "#ff6b6b", fontWeight: "800" },
});