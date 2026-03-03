// src/components/WorkoutCalendar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";
import { theme } from "../constants/theme";
import type { WorkoutSession } from "../lib/workouts";
import type { PlannedWorkout } from "../lib/plans";

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysInMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x.getDate();
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function addMonths(d: Date, delta: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + delta);
  return x;
}

function dateFromDayKey(dayKey: string) {
  // dayKey is local YYYY-MM-DD. Create a local Date safely.
  const [y, m, d] = dayKey.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayIndex(day0Sun: number) {
  return (day0Sun + 6) % 7;
}

type StreakRiskLevel = "none" | "soft" | "medium" | "critical";

function planConfidence(p: PlannedWorkout | null): "gray" | "yellow" | "green" {
  if (!p) return "gray";
  const hasDur = typeof p.planned_duration_min === "number";
  const hasRpe = typeof p.planned_rpe === "number";
  if (hasDur && hasRpe) return "green";
  if (hasDur || hasRpe) return "yellow";
  return "gray";
}

type Props = {
  sessions: WorkoutSession[];
  plans: PlannedWorkout[];

  onOpenSession?: (id: string) => void;

  // Updated to support "Start from Plan"
  onStartWorkout?: (
    activityType?: string,
    planId?: string,
    title?: string | null
  ) => void;
  defaultActivityType?: string;

  // Opens PlanDayDrawer
  onDayPress?: (date: Date, dayKey: string) => void;
};

export function WorkoutCalendar({
  sessions,
  plans,
  onOpenSession,
  onStartWorkout,
  defaultActivityType = "lifting",
  onDayPress,
}: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => ymdLocal(now), [now]);

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayKey);

  const activeSession = useMemo(() => {
    const actives = sessions.filter((s) => !s.ended_at);
    actives.sort((a, b) => {
      const ta = new Date(
        (a as any).started_at ?? (a as any).created_at
      ).getTime();
      const tb = new Date(
        (b as any).started_at ?? (b as any).created_at
      ).getTime();
      return tb - ta;
    });
    return actives[0] ?? null;
  }, [sessions]);

  const completedByDay = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();
    for (const s of sessions) {
      if (!s.ended_at) continue;
      const d = new Date(s.ended_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = ymdLocal(d);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ta = new Date(
          (a as any).ended_at ?? (a as any).created_at
        ).getTime();
        const tb = new Date(
          (b as any).ended_at ?? (b as any).created_at
        ).getTime();
        return tb - ta;
      });
      map.set(k, arr);
    }
    return map;
  }, [sessions]);

  const plansByDay = useMemo(() => {
    const map = new Map<string, PlannedWorkout[]>();
    for (const p of plans || []) {
      const key = String(p.plan_date);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    // stable order: planned -> skipped -> completed
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ra = a.status === "completed" ? 2 : a.status === "skipped" ? 1 : 0;
        const rb = b.status === "completed" ? 2 : b.status === "skipped" ? 1 : 0;
        return ra - rb;
      });
      map.set(k, arr);
    }
    return map;
  }, [plans]);

  const hasCompletedToday = useMemo(() => {
    return (completedByDay.get(todayKey)?.length ?? 0) > 0;
  }, [completedByDay, todayKey]);

  const streakRiskLevel: StreakRiskLevel = useMemo(() => {
    if (hasCompletedToday || !!activeSession) return "none";

    const hour = now.getHours();
    if (hour >= 21) return "critical";
    if (hour >= 18) return "medium";
    if (hour >= 16) return "soft";
    return "none";
  }, [now, hasCompletedToday, activeSession]);

  const showRiskBanner = streakRiskLevel !== "none";

  const monthStart = startOfMonth(cursor);
  const monthDays = daysInMonth(cursor);
  const leadingBlanks = mondayIndex(monthStart.getDay());

  const cells = useMemo(() => {
    const out: { day: number | null; key: string }[] = [];
    for (let i = 0; i < leadingBlanks; i++) out.push({ day: null, key: `b-${i}` });
    for (let day = 1; day <= monthDays; day++) out.push({ day, key: `d-${day}` });
    while (out.length % 7 !== 0) out.push({ day: null, key: `t-${out.length}` });
    return out;
  }, [leadingBlanks, monthDays]);

  const selectedSessions = useMemo(() => {
    if (!selectedDay) return [];
    return completedByDay.get(selectedDay) ?? [];
  }, [selectedDay, completedByDay]);

  const selectedPlans = useMemo(() => {
    if (!selectedDay) return [];
    return plansByDay.get(selectedDay) ?? [];
  }, [selectedDay, plansByDay]);

  const selectedPlan = selectedPlans[0] ?? null;
  const selectedIsToday = selectedDay === todayKey;

  const selectedMostRecentActivity = useMemo(() => {
    if (selectedPlan?.activity_type) return selectedPlan.activity_type;
    if (selectedSessions.length) return selectedSessions[0]?.activity_type ?? null;
    return null;
  }, [selectedPlan, selectedSessions]);

  const onStart = () => {
    onStartWorkout?.(defaultActivityType);
  };

  const onStartSimilar = () => {
    const activity = selectedMostRecentActivity ?? defaultActivityType;
    onStartWorkout?.(activity);
  };

  const onStartFromPlan = () => {
    if (!selectedPlan) return;
    const activity = selectedPlan.activity_type ?? defaultActivityType;
    onStartWorkout?.(activity, selectedPlan.id, selectedPlan.title ?? null);
  };

  const handleDayPress = (date: Date, dayKey: string) => {
    setSelectedDay(dayKey);
    onDayPress?.(date, dayKey);
  };

  const riskBannerCopy = useMemo(() => {
    if (streakRiskLevel === "soft") {
      return {
        title: "Stay on track",
        meta: "No completed workout today. Get one in before the evening.",
      };
    }
    if (streakRiskLevel === "medium") {
      return { title: "Streak at risk", meta: "No completed workout today. Start one now." };
    }
    if (streakRiskLevel === "critical") {
      return { title: "Last chance tonight", meta: "Your streak ends today if you don’t train. Start now." };
    }
    return null;
  }, [streakRiskLevel]);

  const canStartFromPlan =
    !!onStartWorkout && !!selectedPlan && selectedPlan.status !== "completed" && !activeSession;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.section}>Calendar</Text>

        <View style={styles.navRow}>
          <Pressable onPress={() => setCursor((d) => addMonths(d, -1))} style={styles.navBtn}>
            <Text style={styles.navText}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{monthLabel(cursor)}</Text>
          <Pressable onPress={() => setCursor((d) => addMonths(d, 1))} style={styles.navBtn}>
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>
      </View>

      {activeSession?.id ? (
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Active session running</Text>
            <Text style={styles.bannerMeta}>
              {activeSession.activity_type ?? "workout"} • tap to continue
            </Text>
          </View>
          <Pressable
            onPress={() => onOpenSession?.(activeSession.id)}
            style={({ pressed }) => [styles.bannerBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.bannerBtnText}>Continue</Text>
          </Pressable>
        </View>
      ) : null}

      {showRiskBanner && riskBannerCopy ? (
        <View
          style={[
            styles.risk,
            streakRiskLevel === "soft" && styles.riskSoft,
            streakRiskLevel === "medium" && styles.riskMedium,
            streakRiskLevel === "critical" && styles.riskCritical,
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.riskTitle}>{riskBannerCopy.title}</Text>
            <Text style={styles.riskMeta}>{riskBannerCopy.meta}</Text>
          </View>
          <Pressable onPress={onStart} style={({ pressed }) => [styles.riskBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.riskBtnText}>Start</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c) => {
          if (!c.day) return <View key={c.key} style={styles.cell} />;

          const d = new Date(cursor.getFullYear(), cursor.getMonth(), c.day);
          const dayKey = ymdLocal(d);

          const sessionCount = completedByDay.get(dayKey)?.length ?? 0;
          const planCount = plansByDay.get(dayKey)?.length ?? 0;

          const active = selectedDay === dayKey;
          const isToday = dayKey === todayKey;

          const todayRisk = isToday && streakRiskLevel !== "none";

          const hasPlan = planCount > 0;
          const plan = hasPlan ? (plansByDay.get(dayKey)?.[0] ?? null) : null;
          const conf = planConfidence(plan);

          return (
            <Pressable
              key={c.key}
              onPress={() => handleDayPress(d, dayKey)}
              style={({ pressed }) => [
                styles.cell,
                isToday && styles.cellToday,
                active && styles.cellActive,
                todayRisk && styles.cellTodayRisk,
                streakRiskLevel === "critical" && isToday && styles.cellTodayCritical,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  isToday && styles.dayNumToday,
                  active && styles.dayNumActive,
                  todayRisk && styles.dayNumRisk,
                ]}
              >
                {c.day}
              </Text>

              {sessionCount > 0 ? (
                <View style={styles.dotRow}>
                  <View style={styles.dot} />
                  <Text style={styles.count}>{sessionCount}</Text>
                </View>
              ) : todayRisk ? (
                <View style={styles.dotRow}>
                  <View
                    style={[
                      styles.riskDot,
                      streakRiskLevel === "soft" && styles.riskDotSoft,
                      streakRiskLevel === "medium" && styles.riskDotMedium,
                      streakRiskLevel === "critical" && styles.riskDotCritical,
                    ]}
                  />
                  <Text style={styles.count}>!</Text>
                </View>
              ) : hasPlan ? (
                <View style={styles.dotRow}>
                  <View
                    style={[
                      styles.planDot,
                      conf === "gray" && styles.planDotGray,
                      conf === "yellow" && styles.planDotYellow,
                      conf === "green" && styles.planDotGreen,
                    ]}
                  />
                  <Text style={styles.count}>P</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionSmall}>
          {selectedDay ?? "—"} • {selectedSessions.length} workout{selectedSessions.length === 1 ? "" : "s"}
          {selectedPlan ? " • plan" : ""}
        </Text>

        {selectedPlan ? (
          <View style={{ marginTop: 10, gap: 10 }}>
            <View style={styles.planItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{selectedPlan.title ?? "Planned workout"}</Text>
                <Text style={styles.planMeta}>
                  {selectedPlan.activity_type}
                  {typeof selectedPlan.planned_duration_min === "number"
                    ? ` • ${selectedPlan.planned_duration_min} min`
                    : ""}
                  {typeof selectedPlan.planned_rpe === "number" ? ` • RPE ${selectedPlan.planned_rpe}` : ""}
                  {selectedPlan.status ? ` • ${selectedPlan.status}` : ""}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Edit Plan"
                  onPress={() => {
                    if (!selectedDay) return;
                    onDayPress?.(dateFromDayKey(selectedDay), selectedDay);
                  }}
                />
              </View>

              {canStartFromPlan ? (
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Start from Plan" onPress={onStartFromPlan} />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {selectedSessions.length > 0 ? (
          <View style={{ marginTop: 10, gap: 10 }}>
            {selectedSessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onOpenSession?.(s.id)}
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.itemTitle}>{s.title ?? "Workout session"}</Text>
                <Text style={styles.itemMeta}>
                  {s.activity_type}
                  {typeof s.duration_min === "number" ? ` • ${s.duration_min} min` : ""}
                </Text>
              </Pressable>
            ))}

            {onStartWorkout ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <PrimaryButton label="Start Similar Today" onPress={onStartSimilar} />
              </View>
            ) : null}
          </View>
        ) : !selectedPlan ? (
          <>
            <Text style={styles.hint}>
              {selectedIsToday ? "No workouts logged today." : "No workouts logged on this day."}
            </Text>

            {onStartWorkout ? (
              <View style={{ marginTop: theme.spacing.sm, gap: theme.spacing.sm }}>
                <PrimaryButton
                  label="Plan This Day"
                  onPress={() => {
                    if (!selectedDay) return;
                    onDayPress?.(dateFromDayKey(selectedDay), selectedDay);
                  }}
                />
                <PrimaryButton label="Start Workout Today" onPress={onStart} />
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: theme.spacing.lg },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },
  navRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },
  navText: { color: theme.colors.text, fontSize: 18, fontWeight: "900" },
  month: { color: theme.colors.text, fontWeight: "900" },

  banner: {
    marginTop: 12,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerTitle: { color: theme.colors.text, fontWeight: "900" },
  bannerMeta: { color: theme.colors.textMuted, marginTop: 2, fontWeight: "700" },
  bannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(10,132,255,0.10)",
  },
  bannerBtnText: { color: theme.colors.text, fontWeight: "900" },

  risk: {
    marginTop: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  riskSoft: {
    borderColor: "rgba(250, 204, 21, 0.45)",
    backgroundColor: "rgba(250, 204, 21, 0.10)",
  },
  riskMedium: {
    borderColor: "rgba(255,107,107,0.35)",
    backgroundColor: "rgba(255,107,107,0.10)",
  },
  riskCritical: {
    borderColor: "rgba(255,107,107,0.60)",
    backgroundColor: "rgba(255,107,107,0.18)",
  },
  riskTitle: { color: theme.colors.text, fontWeight: "900" },
  riskMeta: { color: theme.colors.textMuted, marginTop: 2, fontWeight: "700" },
  riskBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(10,132,255,0.10)",
  },
  riskBtnText: { color: theme.colors.text, fontWeight: "900" },

  weekRow: { flexDirection: "row", marginTop: 12 },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: 12,
  },

  grid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`,
    height: 52,
    paddingTop: 8,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: 10,
  },
  cellActive: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(10,132,255,0.10)",
  },
  cellToday: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cellTodayRisk: {
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.45)",
    backgroundColor: "rgba(255,107,107,0.08)",
  },
  cellTodayCritical: {
    borderColor: "rgba(255,107,107,0.70)",
    backgroundColor: "rgba(255,107,107,0.14)",
  },

  dayNum: { color: theme.colors.textMuted, fontWeight: "900" },
  dayNumToday: { color: theme.colors.text },
  dayNumActive: { color: theme.colors.text },
  dayNumRisk: { color: theme.colors.text },

  dotRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.accent },
  count: { color: theme.colors.textMuted, fontWeight: "900", fontSize: 12 },

  planDot: { width: 8, height: 8, borderRadius: 999, borderWidth: 2, backgroundColor: "transparent" },
  planDotGray: { borderColor: "rgba(255,255,255,0.30)" },
  planDotYellow: { borderColor: "rgba(250, 204, 21, 0.85)" },
  planDotGreen: { borderColor: "rgba(34, 197, 94, 0.85)" },

  riskDot: { width: 6, height: 6, borderRadius: 999 },
  riskDotSoft: { backgroundColor: "rgba(250, 204, 21, 0.95)" },
  riskDotMedium: { backgroundColor: "rgba(255,107,107,0.95)" },
  riskDotCritical: { backgroundColor: "rgba(255,107,107,1.0)" },

  panel: { marginTop: 14 },
  sectionSmall: { color: theme.colors.textFaint, fontWeight: "900" },

  hint: { marginTop: 10, color: theme.colors.textMuted, fontWeight: "700" },

  item: {
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  itemTitle: { color: theme.colors.text, fontWeight: "900" },
  itemMeta: { color: theme.colors.textMuted, marginTop: 4, fontWeight: "700" },

  planItem: {
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  planTitle: { color: theme.colors.text, fontWeight: "900" },
  planMeta: { color: theme.colors.textMuted, marginTop: 4, fontWeight: "700" },
});