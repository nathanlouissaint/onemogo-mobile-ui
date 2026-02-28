// app/workout/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getWorkoutSession,
} from "../../src/lib/workouts";

// Keep this local so the screen doesn’t depend on hidden exports/types
type WorkoutSessionDetail = {
  id: string;
  user_id: string;
  title?: string | null;
  activity_type?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_min?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

export default function WorkoutSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const sessionId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return (raw ?? "").toString();
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workout, setWorkout] = useState<WorkoutSessionDetail | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) {
      setErr("Missing session id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = (await getWorkoutSession(sessionId)) as WorkoutSessionDetail;
      setWorkout(data);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to load session"));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  // ----- Timer state (UI-only pause/resume) -----
  const [isRunning, setIsRunning] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  // tracks total paused time so elapsed stays accurate
  const pausedTotalMsRef = useRef(0);
  const pauseStartedAtMsRef = useRef<number | null>(null);

  // helper
  const computeElapsedSec = useCallback(() => {
    if (!workout?.started_at) return 0;

    const startMs = new Date(workout.started_at).getTime();
    if (Number.isNaN(startMs)) return 0;

    // if completed, lock to ended_at
    const endMs = workout.ended_at ? new Date(workout.ended_at).getTime() : Date.now();
    const pausedMs = pausedTotalMsRef.current;

    const raw = Math.max(0, endMs - startMs - pausedMs);
    return Math.floor(raw / 1000);
  }, [workout?.started_at, workout?.ended_at]);

  // initialize timer when workout loads/changes
  useEffect(() => {
    if (!workout?.id) return;

    // completed sessions should not "run"
    if (workout.ended_at) {
      setIsRunning(false);
      setElapsedSec(computeElapsedSec());
      return;
    }

    // active sessions start running by default
    setIsRunning(true);
    setElapsedSec(computeElapsedSec());
    // reset pause tracking when switching sessions
    pausedTotalMsRef.current = 0;
    pauseStartedAtMsRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout?.id]);

  // tick
  useEffect(() => {
    if (!workout?.id) return;
    if (workout.ended_at) return;
    if (!isRunning) return;

    const t = setInterval(() => {
      setElapsedSec(computeElapsedSec());
    }, 250);

    return () => clearInterval(t);
  }, [workout?.id, workout?.ended_at, isRunning, computeElapsedSec]);

  const onPauseTimer = () => {
    if (workout?.ended_at) return;
    if (!isRunning) return;
    pauseStartedAtMsRef.current = Date.now();
    setIsRunning(false);
  };

  const onResumeTimer = () => {
    if (workout?.ended_at) return;
    if (isRunning) return;

    const pauseStarted = pauseStartedAtMsRef.current;
    if (pauseStarted) {
      pausedTotalMsRef.current += Date.now() - pauseStarted;
    }
    pauseStartedAtMsRef.current = null;
    setIsRunning(true);
  };

  const timerLabel = useMemo(() => {
    const mm = Math.floor(elapsedSec / 60);
    const ss = elapsedSec % 60;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  }, [elapsedSec]);

  const statusLabel = workout?.ended_at ? "Completed" : isRunning ? "Running" : "Stopped";

  const durationLabel = useMemo(() => {
    if (!workout) return "—";
    if (typeof workout.duration_min === "number") return `${workout.duration_min} min`;
    // fallback from timer (rounded up to minutes like your UI)
    const mins = Math.max(0, Math.round(elapsedSec / 60));
    return mins ? `${mins} min` : "—";
  }, [workout, elapsedSec]);

  const onCompleteWorkout = async () => {
    if (!workout?.id) return;
    if (workout.ended_at) return;

    Alert.alert(
      "Complete workout?",
      "This will stop the session and mark it as completed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              setErr(null);
              await completeWorkoutSession(workout.id);
              await load();
            } catch (e: unknown) {
              setErr(getErrMsg(e, "Failed to complete workout"));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const title =
    (workout?.title && String(workout.title).trim()) || "Workout Session";

  const subtitle = `${formatActivityType(workout?.activity_type)} • ${
    workout?.ended_at ? "Completed" : "Active"
  }`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Workout</Text>
          <Text style={styles.title} numberOfLines={2}>
            {loading ? "Loading..." : title}
          </Text>
          <Text style={styles.sub}>{subtitle}</Text>
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
              <PrimaryButton label="Retry" onPress={load} />
            </View>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </Card>
        ) : workout ? (
          <>
            {/* Timer */}
            <Card style={{ marginBottom: theme.spacing.md }}>
              <View style={styles.timerTop}>
                <Text style={styles.section}>Timer</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{statusLabel}</Text>
                </View>
              </View>

              <Text style={styles.timerValue}>{timerLabel}</Text>

              <Text style={styles.meta}>Started: {formatDateTime(workout.started_at)}</Text>
              <Text style={styles.meta}>Ended: {formatDateTime(workout.ended_at)}</Text>
              <Text style={styles.meta}>Duration: {durationLabel}</Text>

              <View style={{ marginTop: theme.spacing.md, gap: 12 }}>
                {!workout.ended_at ? (
                  <>
                    {isRunning ? (
                      <PrimaryButton label="Pause Timer" onPress={onPauseTimer} />
                    ) : (
                      <PrimaryButton label="Resume Timer" onPress={onResumeTimer} />
                    )}

                    <PrimaryButton label="Complete Workout" onPress={onCompleteWorkout} />
                  </>
                ) : (
                  <Text style={[styles.meta, { marginTop: 6, fontWeight: "900" }]}>
                    Completed
                  </Text>
                )}
              </View>
            </Card>

            {/* Details / actions */}
            <Card>
              <Text style={styles.section}>Details</Text>
              <Text style={styles.meta}>Status: {workout.ended_at ? "Completed" : "Active"}</Text>
              <Text style={styles.meta}>Activity: {formatActivityType(workout.activity_type)}</Text>

              <View style={{ marginTop: theme.spacing.md, gap: 12 }}>
                <PrimaryButton label="Refresh" onPress={load} />
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

  timerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerValue: {
    color: theme.colors.text,
    fontSize: 56,
    fontWeight: "900",
    marginTop: 10,
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 8,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  pill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: theme.colors.textMuted, fontWeight: "900" },

  errorText: { color: "#ff6b6b", fontWeight: "800" },
});