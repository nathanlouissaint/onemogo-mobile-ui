// app/(tabs)/index.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import { getWorkouts } from "../../src/lib/workouts";
import type { WorkoutSession } from "../../src/lib/workouts";

import { useSession } from "../../src/session/SessionContext";

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") return anyErr.error_description;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
    if (typeof anyErr.code === "string" && typeof anyErr.message === "string")
      return `${anyErr.code}: ${anyErr.message}`;
  }
  return fallback;
}

export default function HomeScreen() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id;

  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Placeholder metrics for now (replace later with real endpoints)
  const data = useMemo(() => {
    return {
      name: user?.firstName || user?.username || "—",
      streak: 6,
      weeklyWorkouts: 4,
      minutesThisWeek: 138,
      weeklyGoalMin: 180,
    };
  }, [user]);

  const progress = Math.min(1, data.minutesThisWeek / data.weeklyGoalMin);
  const pct = Math.round(progress * 100);

  const fetchWorkouts = async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const list = await getWorkouts(userId);
      setWorkouts(list || []);
    } catch (e: unknown) {
      console.log("Dashboard fetchWorkouts error:", e);
      setErr(getErrMsg(e, "Failed to load workouts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && userId) fetchWorkouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, userId]);

  const today = workouts?.[0];

  const onStart = () => {
    if (!today?.id) return;

    router.push({
      pathname: "/workout/[id]",
      params: { id: String(today.id) },
    });
  };

  // Standardized to snake_case schema
  const todayTitle =
    (today?.title && String(today.title).trim()) ||
    (today?.activity_type ? `${formatActivityType(today.activity_type)} session` : "Workout session");

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>Dashboard</Text>
        <Text style={styles.title}>Welcome back, {data.name}</Text>
        <Text style={styles.sub}>Stay consistent. Small wins compound.</Text>
      </View>

      <View style={styles.row}>
        <Card style={styles.half}>
          <Text style={styles.label}>Streak</Text>
          <Text style={styles.value}>{data.streak}</Text>
          <Text style={styles.meta}>days</Text>
        </Card>

        <Card style={styles.half}>
          <Text style={styles.label}>Workouts</Text>
          <Text style={styles.value}>{data.weeklyWorkouts}</Text>
          <Text style={styles.meta}>this week</Text>
        </Card>
      </View>

      <Card style={styles.progress}>
        <View style={styles.progressTop}>
          <View>
            <Text style={styles.label}>Weekly minutes</Text>
            <Text style={styles.value}>{data.minutesThisWeek}</Text>
            <Text style={styles.meta}>of {data.weeklyGoalMin} min goal</Text>
          </View>

          <View style={styles.pill}>
            <Text style={styles.pillText}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </Card>

      <Card style={styles.today}>
        <View style={styles.todayHeaderRow}>
          <Text style={styles.section}>Today</Text>
          {loading ? (
            <View style={styles.todayStatus}>
              <ActivityIndicator />
            </View>
          ) : null}
        </View>

        {!loading && err ? (
          <>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={fetchWorkouts} />
            </View>
          </>
        ) : null}

        {!loading && !err && !today ? (
          <>
            <Text style={styles.meta}>No workout sessions available yet.</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Refresh" onPress={fetchWorkouts} />
            </View>
          </>
        ) : null}

        {!loading && !err && today ? (
          <>
            <View style={styles.todayRow}>
              <Text style={styles.workoutTitle}>{todayTitle}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {today.activity_type ? formatActivityType(today.activity_type) : "—"}
                </Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {typeof today.duration_min === "number" ? `${today.duration_min} minutes` : "Duration —"}
            </Text>

            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Start Workout" onPress={onStart} />
            </View>
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  },

  row: { flexDirection: "row", gap: theme.spacing.sm },
  half: { flex: 1 },

  label: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },
  value: {
    color: theme.colors.text,
    fontSize: theme.font.size.xl,
    fontWeight: "900",
    marginTop: 10,
  },
  meta: {
    color: theme.colors.textMuted,
    marginTop: 6,
    fontSize: theme.font.size.sm,
  },

  progress: { marginTop: theme.spacing.sm },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pill: {
    backgroundColor: "rgba(10,132,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { color: theme.colors.text, fontWeight: "800" },

  track: {
    height: 10,
    backgroundColor: theme.colors.surface2,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  fill: { height: "100%", backgroundColor: theme.colors.accent },

  today: { marginTop: theme.spacing.lg },
  todayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  todayStatus: { paddingLeft: 12 },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  workoutTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
    flex: 1,
    paddingRight: 10,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  errorText: {
    marginTop: 10,
    color: "#ff6b6b",
    fontWeight: "800",
  },
});