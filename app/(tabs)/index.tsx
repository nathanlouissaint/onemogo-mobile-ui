// app/(tabs)/index.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { WorkoutCalendar } from "../../src/components/WorkoutCalendar";
import { theme } from "../../src/constants/theme";

import {
  getActiveWorkoutSession,
  listWorkoutSessions,
  startWorkoutSession,
} from "../../src/lib/workouts";
import type { WorkoutSession } from "../../src/lib/workouts";

import { useSession } from "../../src/session/SessionContext";

// plan drawer
import { PlanDayDrawer } from "../../src/plans/PlanDayDrawer";

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
    if (typeof anyErr.error_description === "string")
      return anyErr.error_description;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
    if (typeof anyErr.code === "string" && typeof anyErr.message === "string")
      return `${anyErr.code}: ${anyErr.message}`;
  }
  return fallback;
}

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekLocal(now: Date) {
  // Monday start
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const mondayBased = (day + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - mondayBased);
  return d;
}

function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function computeDashboardMetrics(
  sessions: WorkoutSession[],
  weeklyGoalMin: number
) {
  const now = new Date();
  const weekStart = startOfWeekLocal(now);
  const weekStartMs = weekStart.getTime();

  const completed = sessions.filter((s) => !!s.ended_at);

  let weeklyWorkouts = 0;
  let minutesThisWeek = 0;

  for (const s of completed) {
    const end = s.ended_at ? new Date(s.ended_at) : null;
    if (!end || Number.isNaN(end.getTime())) continue;

    if (end.getTime() >= weekStartMs) {
      weeklyWorkouts += 1;
      if (typeof s.duration_min === "number") minutesThisWeek += s.duration_min;
    }
  }

  const daysWithCompleted = new Set<string>();
  for (const s of completed) {
    const end = s.ended_at ? new Date(s.ended_at) : null;
    if (!end || Number.isNaN(end.getTime())) continue;
    daysWithCompleted.add(ymdLocal(end));
  }

  const todayKey = ymdLocal(now);
  const yesterdayKey = ymdLocal(addDaysLocal(now, -1));
  let cursor = now;

  if (!daysWithCompleted.has(todayKey)) {
    if (daysWithCompleted.has(yesterdayKey)) cursor = addDaysLocal(now, -1);
    else return { streak: 0, weeklyWorkouts, minutesThisWeek, weeklyGoalMin };
  }

  let streak = 0;
  while (true) {
    const key = ymdLocal(cursor);
    if (!daysWithCompleted.has(key)) break;
    streak += 1;
    cursor = addDaysLocal(cursor, -1);
  }

  return { streak, weeklyWorkouts, minutesThisWeek, weeklyGoalMin };
}

function titleFromActivityType(activityType: string) {
  const raw = String(activityType || "lifting").trim();
  const label = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Workout";
  return `${label} Session`;
}

export default function HomeScreen() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id;

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // plan drawer state
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState<string | null>(null);

  const weeklyGoalMin = 180; // move to profile/settings later

  const metrics = useMemo(() => {
    const base = {
      name: (user as any)?.firstName || (user as any)?.username || "—",
      streak: 0,
      weeklyWorkouts: 0,
      minutesThisWeek: 0,
      weeklyGoalMin,
    };

    if (!sessions.length) return base;

    return { ...base, ...computeDashboardMetrics(sessions, weeklyGoalMin) };
  }, [user, sessions, weeklyGoalMin]);

  const progress = Math.min(1, metrics.minutesThisWeek / metrics.weeklyGoalMin);
  const pct = Math.round(progress * 100);

  const fetchSessions = async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const list = await listWorkoutSessions(userId);
      setSessions(list || []);
    } catch (e: unknown) {
      console.log("Dashboard fetchSessions error:", e);
      setErr(getErrMsg(e, "Failed to load sessions"));
    } finally {
      setLoading(false);
    }
  };

  const startFromCalendar = async (activityType?: string) => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);
      if (active?.id) {
        router.push({ pathname: "/workout/[id]", params: { id: active.id } });
        return;
      }

      const type = activityType ?? "lifting";
      const created = await startWorkoutSession({
        userId,
        title: titleFromActivityType(type),
        activityType: type,
      });

      router.push({ pathname: "/workout/[id]", params: { id: created.id } });
    } catch (e: unknown) {
      console.log("Dashboard startFromCalendar error:", e);
      setErr(getErrMsg(e, "Failed to start workout session"));
    }
  };

  // UPDATED: use the dayKey emitted by WorkoutCalendar (best for timezone safety)
  const onDayPressForPlan = (_date: Date, dayKey: string) => {
    setSelectedPlanDate(dayKey);
    setPlanDrawerOpen(true);
  };

  useEffect(() => {
    if (!sessionLoading && userId) fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, userId]);

  const today = sessions?.[0];

  const onOpenTodaySession = () => {
    if (!today?.id) return;
    router.push({ pathname: "/workout/[id]", params: { id: String(today.id) } });
  };

  const todayTitle =
    (today?.title && String(today.title).trim()) ||
    (today?.activity_type
      ? `${formatActivityType(today.activity_type)} session`
      : "Workout session");

  const statusLabel = today?.ended_at ? "Completed" : "Active";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Dashboard</Text>
          <Text style={styles.title}>Welcome back, {metrics.name}</Text>
          <Text style={styles.sub}>Stay consistent. Small wins compound.</Text>
        </View>

        <View style={styles.row}>
          <Card style={styles.half}>
            <Text style={styles.label}>Streak</Text>
            <Text style={styles.value}>{metrics.streak}</Text>
            <Text style={styles.meta}>days</Text>
          </Card>

          <Card style={styles.half}>
            <Text style={styles.label}>Workouts</Text>
            <Text style={styles.value}>{metrics.weeklyWorkouts}</Text>
            <Text style={styles.meta}>this week</Text>
          </Card>
        </View>

        <Card style={styles.progress}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.label}>Weekly minutes</Text>
              <Text style={styles.value}>{metrics.minutesThisWeek}</Text>
              <Text style={styles.meta}>
                of {metrics.weeklyGoalMin} min goal
              </Text>
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
                <PrimaryButton label="Retry" onPress={fetchSessions} />
              </View>
            </>
          ) : null}

          {!loading && !err && !today ? (
            <>
              <Text style={styles.meta}>No workout sessions available yet.</Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton label="Refresh" onPress={fetchSessions} />
              </View>
            </>
          ) : null}

          {!loading && !err && today ? (
            <>
              <View style={styles.todayRow}>
                <Text style={styles.workoutTitle}>{todayTitle}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {today.activity_type
                      ? formatActivityType(today.activity_type)
                      : "—"}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {statusLabel}
                {" • "}
                {typeof today.duration_min === "number"
                  ? `${today.duration_min} minutes`
                  : "Duration —"}
              </Text>

              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton
                  label={today.ended_at ? "View Session" : "Continue Session"}
                  onPress={onOpenTodaySession}
                />
              </View>
            </>
          ) : null}
        </Card>

        <WorkoutCalendar
          sessions={sessions}
          defaultActivityType="lifting"
          onStartWorkout={startFromCalendar}
          onOpenSession={(id) =>
            router.push({ pathname: "/workout/[id]", params: { id } })
          }
          onDayPress={onDayPressForPlan}
        />

        {selectedPlanDate && (
          <PlanDayDrawer
            visible={planDrawerOpen}
            onClose={() => setPlanDrawerOpen(false)}
            planDate={selectedPlanDate}
          />
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