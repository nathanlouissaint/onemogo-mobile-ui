// app/(tabs)/index.tsx
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import { listPlansForRange } from "../../src/lib/plans";
import type { PlannedWorkout } from "../../src/lib/plans";

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
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const mondayBased = (day + 6) % 7;
  d.setDate(d.getDate() - mondayBased);
  return d;
}

function addDaysLocal(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonthLocal(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
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

function sessionDateKey(s: WorkoutSession) {
  const base = (s as any)?.started_at ?? (s as any)?.created_at ?? s.ended_at;
  if (!base) return null;

  const dt = new Date(base);
  if (Number.isNaN(dt.getTime())) return null;

  return ymdLocal(dt);
}

function pickTodaySession(sessions: WorkoutSession[]) {
  if (!sessions?.length) return null;

  const active = sessions.find((s) => !s.ended_at);
  if (active) return active;

  const todayKey = ymdLocal(new Date());

  const sameDay = sessions
    .filter((s) => sessionDateKey(s) === todayKey)
    .sort((a, b) => {
      const aBase =
        (a as any)?.started_at ?? (a as any)?.created_at ?? a.ended_at ?? "";
      const bBase =
        (b as any)?.started_at ?? (b as any)?.created_at ?? b.ended_at ?? "";
      return new Date(bBase).getTime() - new Date(aBase).getTime();
    });

  return sameDay[0] ?? null;
}

function getPlanDateKey(plan: PlannedWorkout) {
  const raw =
    (plan as any)?.plan_date ??
    (plan as any)?.planned_date ??
    (plan as any)?.scheduled_date ??
    (plan as any)?.date ??
    null;

  if (!raw) return null;

  if (typeof raw === "string") {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return ymdLocal(parsed);
    return raw.slice(0, 10);
  }

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;

  return ymdLocal(dt);
}

function pickTodayPlan(plans: PlannedWorkout[]) {
  if (!plans?.length) return null;

  const todayKey = ymdLocal(new Date());

  const sameDayPlans = plans.filter((p) => getPlanDateKey(p) === todayKey);

  if (!sameDayPlans.length) return null;

  return sameDayPlans[0] ?? null;
}

export default function HomeScreen() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id;

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [plans, setPlans] = useState<PlannedWorkout[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [selectedPlanDate, setSelectedPlanDate] = useState<string | null>(null);

  const weeklyGoalMin = 180;

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

  const progress = metrics.weeklyGoalMin
    ? Math.min(1, metrics.minutesThisWeek / metrics.weeklyGoalMin)
    : 0;
  const pct = Math.round(progress * 100);

  const fetchDashboardData = useCallback(async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const now = new Date();

      const monthStart = ymdLocal(startOfMonthLocal(now));
      const nextMonthStart = ymdLocal(
        startOfMonthLocal(new Date(now.getFullYear(), now.getMonth() + 1, 1))
      );

      const [sessionList, planList] = await Promise.all([
        listWorkoutSessions(userId),
        listPlansForRange(userId, monthStart, nextMonthStart),
      ]);

      setSessions(sessionList || []);
      setPlans(planList || []);
    } catch (e: unknown) {
      console.log("Dashboard fetchDashboardData error:", e);
      setErr(getErrMsg(e, "Failed to load dashboard data"));
    } finally {
      setLoading(false);
    }
  }, [sessionLoading, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!sessionLoading && userId) {
        fetchDashboardData();
      }
    }, [sessionLoading, userId, fetchDashboardData])
  );

  const startFromCalendar = async (
    activityType?: string,
    planId?: string,
    title?: string | null
  ) => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);
      if (active?.id) {
        router.push({ pathname: "/sessions/[id]", params: { id: active.id } });
        return;
      }

      const type = activityType ?? "lifting";
      const created = await startWorkoutSession({
        userId,
        title: title ?? titleFromActivityType(type),
        activityType: type,
        planId: planId ?? null,
      });

      router.push({ pathname: "/sessions/[id]", params: { id: created.id } });
    } catch (e: unknown) {
      console.log("Dashboard startFromCalendar error:", e);
      setErr(getErrMsg(e, "Failed to start workout session"));
    }
  };

  const onDayPressForPlan = (_date: Date, dayKey: string) => {
    setSelectedPlanDate(dayKey);
    setPlanDrawerOpen(true);
  };

  const todaySession = useMemo(() => pickTodaySession(sessions), [sessions]);
  const todayPlan = useMemo(() => pickTodayPlan(plans), [plans]);

  const onOpenTodaySession = () => {
    if (!todaySession?.id) return;
    router.push({
      pathname: "/sessions/[id]",
      params: { id: String(todaySession.id) },
    });
  };

  const onStartTodayPlan = async () => {
    if (!todayPlan) return;

    const activityType =
      (todayPlan as any)?.activity_type ??
      (todayPlan as any)?.type ??
      "lifting";

    const planId = (todayPlan as any)?.id
      ? String((todayPlan as any).id)
      : undefined;

    const title =
      ((todayPlan as any)?.title && String((todayPlan as any).title).trim()) ||
      ((todayPlan as any)?.name && String((todayPlan as any).name).trim()) ||
      titleFromActivityType(activityType);

    await startFromCalendar(activityType, planId, title);
  };

  const todaySessionTitle =
    (todaySession?.title && String(todaySession.title).trim()) ||
    (todaySession?.activity_type
      ? `${formatActivityType(todaySession.activity_type)} session`
      : "Workout session");

  const todayPlanTitle =
    (((todayPlan as any)?.title &&
      String((todayPlan as any).title).trim()) as string) ||
    (((todayPlan as any)?.name &&
      String((todayPlan as any).name).trim()) as string) ||
    ((todayPlan as any)?.activity_type || (todayPlan as any)?.type
      ? `${formatActivityType(
          (todayPlan as any)?.activity_type ?? (todayPlan as any)?.type
        )} workout`
      : "Planned workout");

  const statusLabel = todaySession?.ended_at ? "Completed" : "Active";

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
                <PrimaryButton label="Retry" onPress={fetchDashboardData} />
              </View>
            </>
          ) : null}

          {!loading && !err && todaySession ? (
            <>
              <View style={styles.todayRow}>
                <Text style={styles.workoutTitle}>{todaySessionTitle}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {todaySession.activity_type
                      ? formatActivityType(todaySession.activity_type)
                      : "—"}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {statusLabel}
                {" • "}
                {typeof todaySession.duration_min === "number"
                  ? `${todaySession.duration_min} minutes`
                  : "Duration —"}
              </Text>

              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton
                  label={
                    todaySession.ended_at ? "View Session" : "Continue Session"
                  }
                  onPress={onOpenTodaySession}
                />
              </View>
            </>
          ) : null}

          {!loading && !err && !todaySession && todayPlan ? (
            <>
              <View style={styles.todayRow}>
                <Text style={styles.workoutTitle}>{todayPlanTitle}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {formatActivityType(
                      (todayPlan as any)?.activity_type ??
                        (todayPlan as any)?.type
                    )}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>Planned for today</Text>

              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton
                  label="Start Planned Workout"
                  onPress={onStartTodayPlan}
                />
              </View>
            </>
          ) : null}

          {!loading && !err && !todaySession && !todayPlan ? (
            <>
              <Text style={styles.meta}>
                No session or planned workout for today.
              </Text>
              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton label="Refresh" onPress={fetchDashboardData} />
              </View>
            </>
          ) : null}
        </Card>

        <WorkoutCalendar
          sessions={sessions}
          plans={plans}
          defaultActivityType="lifting"
          onStartWorkout={startFromCalendar}
          onOpenSession={(id) =>
            router.push({ pathname: "/sessions/[id]", params: { id } })
          }
          onDayPress={onDayPressForPlan}
        />

        {selectedPlanDate && (
          <PlanDayDrawer
            visible={planDrawerOpen}
            onClose={() => {
              setPlanDrawerOpen(false);
              setSelectedPlanDate(null);
              fetchDashboardData();
            }}
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