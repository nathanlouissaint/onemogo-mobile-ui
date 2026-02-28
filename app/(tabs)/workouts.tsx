// app/(tabs)/workouts.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import {
  startWorkoutSession,
  listWorkoutSessions,
  getActiveWorkoutSession,
} from "../../src/lib/workouts";
import type { WorkoutSession } from "../../src/lib/workouts";

import { useSession } from "../../src/session/SessionContext";

type ActivityOption = {
  key: string;
  label: string;
};

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { key: "lifting", label: "Lifting" },
  { key: "swimming", label: "Swimming" },
  { key: "boxing", label: "Boxing" },
  { key: "running", label: "Running" },
];

function formatDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function WorkoutsScreen() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const [selectedActivity, setSelectedActivity] = useState<string>("lifting");

  const hasSessions = sessions.length > 0;

  const load = async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const data = await listWorkoutSessions(userId);
      setSessions(data || []);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load workout sessions";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  };

  // SINGLE ACTIVE SESSION ENFORCEMENT:
  // - If an active session exists, route to it
  // - Otherwise create a new session and route to it
  const onStartWorkout = async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);

      if (active?.id) {
        router.push(`/workout/${encodeURIComponent(active.id)}`);
        return;
      }

      const label =
        ACTIVITY_OPTIONS.find((o) => o.key === selectedActivity)?.label ??
        "Workout";

      const created = await startWorkoutSession({
        userId,
        title: `${label} Session`,
        activityType: selectedActivity,
      });

      router.push(`/workout/${encodeURIComponent(created.id)}`);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to start workout session";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, userId]);

  const title = useMemo(() => {
    if (loading) return "Workouts";
    if (err) return "Workouts";
    return hasSessions ? `Workouts (${sessions.length})` : "Workouts";
  }, [loading, err, hasSessions, sessions.length]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Choose an activity, then start</Text>
      </View>

      {/* Activity chooser */}
      <Card style={{ marginBottom: theme.spacing.md }}>
        <Text style={styles.section}>Workout Type</Text>

        <View style={styles.choices}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const active = opt.key === selectedActivity;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setSelectedActivity(opt.key)}
                style={({ pressed }) => [
                  styles.choice,
                  active && styles.choiceActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: theme.spacing.md }}>
          <PrimaryButton
            label="Start Workout"
            onPress={onStartWorkout}
            loading={loading}
          />
        </View>

        {err ? <Text style={styles.errorText}>{err}</Text> : null}
      </Card>

      {/* Sessions list */}
      {loading ? (
        <Card>
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.meta}>
              {sessionLoading ? "Loading session…" : "Loading workouts…"}
            </Text>
          </View>
        </Card>
      ) : !hasSessions ? (
        <Card>
          <Text style={styles.meta}>No workouts yet.</Text>
          <Text style={[styles.meta, { marginTop: 6 }]}>
            Start a session and it will appear here.
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton label="Refresh" onPress={load} />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {sessions.map((s) => {
            const started = s.started_at ?? s.created_at ?? null;

            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/workout/${encodeURIComponent(s.id)}`)}
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              >
                <Card>
                  <Text style={styles.rowTitle}>{s.title ?? "Workout Session"}</Text>

                  <Text style={styles.meta}>
                    {s.activity_type}
                    {started ? ` • ${formatDate(started)}` : ""}
                    {s.ended_at ? ` • ended ${formatDate(s.ended_at)}` : " • active"}
                  </Text>

                  {typeof s.duration_min === "number" ? (
                    <Text style={styles.meta}>{s.duration_min} min</Text>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}

          <View style={{ height: 4 }} />
          <PrimaryButton label="Refresh" onPress={load} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "900" },
  sub: { color: theme.colors.textMuted, marginTop: 6, fontWeight: "700" },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  choices: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  choiceActive: {
    borderColor: theme.colors.accent,
  },
  choiceText: {
    color: theme.colors.textMuted,
    fontWeight: "900",
  },
  choiceTextActive: {
    color: theme.colors.text,
  },

  center: { alignItems: "center", paddingVertical: 10 },
  meta: { color: theme.colors.textMuted, marginTop: 8, fontWeight: "700" },
  errorText: { color: "#ff6b6b", fontWeight: "800", marginTop: 10 },

  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
});