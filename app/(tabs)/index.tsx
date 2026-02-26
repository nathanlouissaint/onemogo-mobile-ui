// app/(tabs)/index.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import { ApiError, getWorkouts, WorkoutSession } from "../../src/lib/supabase";
import { useSession } from "../../src/session/SessionContext";

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HomeScreen() {
  const { user } = useSession();

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
    setLoading(true);
    setErr(null);
    try {
      const list = await getWorkouts();
      setWorkouts(list || []);
    } catch (e: any) {
      const msg =
        e instanceof ApiError ? e.message : (e?.message ?? "Failed to load workouts");
      setErr(msg.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Today workout session = first session for now
  const today = workouts?.[0];

  const onStart = () => {
    if (!today?.id) return;

    router.push({
      pathname: "/workout/[id]",
      params: { id: String(today.id) },
    });
  };

  const todayTitle =
    (today?.title && String(today.title).trim()) ||
    (today?.activityType ? `${formatActivityType(today.activityType)} session` : "Workout session");

  return (
    <Screen>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.kicker}>Dashboard</Text>
        <Text style={styles.title}>Welcome back, {data.name}</Text>
        <Text style={styles.sub}>Stay consistent. Small wins compound.</Text>
      </View>

      {/* Summary row */}
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

      {/* Progress */}
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

      {/* Today */}
      <Card style={styles.today}>
        <View style={styles.todayHeaderRow}>
          <Text style={styles.section}>Today</Text>
          {loading ? (
            <View style={styles.todayStatus}>
              <ActivityIndicator />
            </View>
          ) : null}
        </View>

        {/* Error */}
        {!loading && err ? (
          <>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={fetchWorkouts} />
            </View>
          </>
        ) : null}

        {/* Empty */}
        {!loading && !err && !today ? (
          <>
            <Text style={styles.meta}>No workout sessions available yet.</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Refresh" onPress={fetchWorkouts} />
            </View>
          </>
        ) : null}

        {/* Loaded */}
        {!loading && !err && today ? (
          <>
            <View style={styles.todayRow}>
              <Text style={styles.workoutTitle}>{todayTitle}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {today.activityType ? formatActivityType(today.activityType) : "—"}
                </Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {typeof today.durationMin === "number"
                ? `${today.durationMin} minutes`
                : "Duration —"}
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

  // Ensure theme.colors.accent exists; otherwise replace with theme.colors.primary.
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
