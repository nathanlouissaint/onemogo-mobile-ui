// src/components/WorkoutCalendar.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";
import { theme } from "../constants/theme";
import type { PlannedWorkout } from "../lib/plans";
import type { WorkoutSession } from "../lib/workouts";

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
  const [y, m, d] = dayKey.split("-").map((n) => Number(n));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function normalizeActivityType(v?: string | null) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "strength";
  if (s === "lifting") return "strength";
  if (s === "run" || s === "running") return "cardio";
  return s;
}

function formatActivityType(v?: string | null) {
  const normalized = normalizeActivityType(v);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getSessionPrimaryTimestamp(session: WorkoutSession) {
  return session.started_at ?? session.created_at ?? session.ended_at ?? null;
}

function sessionStartedDayKey(session: WorkoutSession) {
  const raw = getSessionPrimaryTimestamp(session);
  if (!raw) return null;

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;

  return ymdLocal(dt);
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayIndex(day0Sun: number) {
  return (day0Sun + 6) % 7;
}

type StreakRiskLevel = "none" | "soft" | "medium" | "critical";
type DayState =
  | "empty"
  | "planned"
  | "planned_complete"
  | "completed"
  | "skipped"
  | "missed";

function planConfidence(p: PlannedWorkout | null): "gray" | "yellow" | "green" {
  if (!p) return "gray";
  const hasDur = typeof p.planned_duration_min === "number";
  const hasRpe = typeof p.planned_rpe === "number";
  if (hasDur && hasRpe) return "green";
  if (hasDur || hasRpe) return "yellow";
  return "gray";
}

function getDayState(params: {
  dayKey: string;
  todayKey: string;
  plan: PlannedWorkout | null;
  sessionCount: number;
}): DayState {
  const { dayKey, todayKey, plan, sessionCount } = params;

  if (sessionCount > 0 && plan?.status === "planned") return "planned_complete";
  if (sessionCount > 0) return "completed";

  if (!plan) return "empty";
  if (plan.status === "completed") return "completed";
  if (plan.status === "skipped") return "skipped";
  if (plan.status === "planned" && dayKey < todayKey) return "missed";
  return "planned";
}

type Props = {
  sessions: WorkoutSession[];
  plans: PlannedWorkout[];
  onOpenSession?: (id: string) => void;
  onStartWorkout?: (
    activityType?: string,
    planId?: string,
    title?: string | null
  ) => void;
  defaultActivityType?: string;
  onDayPress?: (date: Date, dayKey: string) => void;
};

const ui = {
  radiusPill: 999,
  navSize: 36,
  chipPadX: 10,
  chipPadY: 6,
  blockPad: 14,
  rowGap: theme.spacing.sm,
  sectionGap: theme.spacing.md,
  summaryGap: theme.spacing.sm,
  calendarTopGap: 10,
  calendarCellHeight: 56,
  dotSize: 6,
  planDotSize: 8,
};

const palette = {
  accentSoft: "rgba(10,132,255,0.12)",
  accentBorder: "rgba(10,132,255,0.25)",

  successSoft: "rgba(48,209,88,0.14)",
  successBorder: "rgba(48,209,88,0.35)",

  warningSoft: "rgba(245,158,11,0.10)",
  warningBorder: "rgba(245,158,11,0.45)",
  warningStrong: "rgba(245,158,11,0.95)",

  dangerSoft: "rgba(255,69,58,0.10)",
  dangerSoft2: "rgba(255,69,58,0.08)",
  dangerBorder: "rgba(255,69,58,0.35)",
  dangerBorderStrong: "rgba(255,69,58,0.60)",
  dangerDot: "rgba(255,69,58,0.95)",

  faintSurface: "rgba(255,255,255,0.03)",
  faintSurface2: "rgba(255,255,255,0.04)",
  faintSurface3: "rgba(255,255,255,0.06)",
  faintLine: "rgba(255,255,255,0.30)",
  skippedDot: "rgba(255,255,255,0.35)",
};

export function WorkoutCalendar({
  sessions,
  plans,
  onOpenSession,
  onStartWorkout,
  defaultActivityType = "strength",
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
      const ta = new Date(getSessionPrimaryTimestamp(a) ?? 0).getTime();
      const tb = new Date(getSessionPrimaryTimestamp(b) ?? 0).getTime();
      return tb - ta;
    });
    return actives[0] ?? null;
  }, [sessions]);

  const completedByDay = useMemo(() => {
    const map = new Map<string, WorkoutSession[]>();

    for (const s of sessions) {
      if (!s.ended_at) continue;

      const dayKey =
        sessionStartedDayKey(s) ??
        (() => {
          const d = new Date(s.ended_at as string);
          if (Number.isNaN(d.getTime())) return null;
          return ymdLocal(d);
        })();

      if (!dayKey) continue;

      const arr = map.get(dayKey) ?? [];
      arr.push(s);
      map.set(dayKey, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const ta = new Date(a.ended_at ?? a.created_at).getTime();
        const tb = new Date(b.ended_at ?? b.created_at).getTime();
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

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => {
        const rank = (v: PlannedWorkout["status"]) =>
          v === "planned" ? 0 : v === "skipped" ? 1 : 2;
        return rank(a.status) - rank(b.status);
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
    for (let i = 0; i < leadingBlanks; i += 1) {
      out.push({ day: null, key: `b-${i}` });
    }
    for (let day = 1; day <= monthDays; day += 1) {
      out.push({ day, key: `d-${day}` });
    }
    while (out.length % 7 !== 0) {
      out.push({ day: null, key: `t-${out.length}` });
    }
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

  const selectedState = useMemo<DayState>(() => {
    if (!selectedDay) return "empty";
    return getDayState({
      dayKey: selectedDay,
      todayKey,
      plan: selectedPlan,
      sessionCount: selectedSessions.length,
    });
  }, [selectedDay, todayKey, selectedPlan, selectedSessions.length]);

  const selectedMostRecentActivity = useMemo(() => {
    if (selectedPlan?.activity_type) {
      return normalizeActivityType(selectedPlan.activity_type);
    }
    if (selectedSessions.length) {
      return normalizeActivityType(selectedSessions[0]?.activity_type ?? null);
    }
    return null;
  }, [selectedPlan, selectedSessions]);

  const adherenceSummary = useMemo(() => {
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    const mondayBased = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - mondayBased);

    let planned = 0;
    let completed = 0;
    let skipped = 0;
    let missed = 0;

    for (let i = 0; i < 7; i += 1) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = ymdLocal(d);

      const plan = plansByDay.get(key)?.[0] ?? null;
      const sessionCount = completedByDay.get(key)?.length ?? 0;
      const state = getDayState({ dayKey: key, todayKey, plan, sessionCount });

      if (plan) planned += 1;
      if (state === "completed" || state === "planned_complete") completed += 1;
      if (state === "skipped") skipped += 1;
      if (state === "missed") missed += 1;
    }

    const adherencePct =
      planned > 0 ? Math.round((completed / planned) * 100) : 0;

    return { planned, completed, skipped, missed, adherencePct };
  }, [now, plansByDay, completedByDay, todayKey]);

  const onStart = () => {
    onStartWorkout?.(normalizeActivityType(defaultActivityType));
  };

  const onStartSimilar = () => {
    const activity =
      selectedMostRecentActivity ?? normalizeActivityType(defaultActivityType);
    onStartWorkout?.(activity);
  };

  const onStartFromPlan = () => {
    if (!selectedPlan) return;
    const activity = normalizeActivityType(
      selectedPlan.activity_type ?? defaultActivityType
    );
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
      return {
        title: "Streak at risk",
        meta: "No completed workout today. Start one now.",
      };
    }
    if (streakRiskLevel === "critical") {
      return {
        title: "Last chance tonight",
        meta: "Your streak ends today if you don’t train. Start now.",
      };
    }
    return null;
  }, [streakRiskLevel]);

  const canStartFromPlan =
    !!onStartWorkout &&
    !!selectedPlan &&
    selectedPlan.status !== "completed" &&
    selectedPlan.status !== "skipped" &&
    !activeSession;

  const selectedStatusCopy = useMemo(() => {
    if (selectedState === "planned_complete") {
      return "Plan exists and workout completed";
    }
    if (selectedState === "completed") {
      return selectedPlan?.status === "completed"
        ? "Completed"
        : "Workout completed";
    }
    if (selectedState === "skipped") {
      return "Skipped";
    }
    if (selectedState === "missed") {
      return "Missed planned workout";
    }
    if (selectedState === "planned") {
      return selectedIsToday ? "Planned for today" : "Planned";
    }
    return selectedIsToday
      ? "No workout logged today."
      : "No workout logged on this day.";
  }, [selectedState, selectedPlan, selectedIsToday]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay) return "No day selected";
    const date = dateFromDayKey(selectedDay);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }, [selectedDay]);

  return (
    <Card style={styles.card} variant="elevated">
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Planning</Text>
          <Text style={styles.section}>Workout calendar</Text>
        </View>

        <View style={styles.navRow}>
          <Pressable
            onPress={() => setCursor((d) => addMonths(d, -1))}
            style={styles.navBtn}
          >
            <Text style={styles.navText}>‹</Text>
          </Pressable>

          <Text style={styles.month}>{monthLabel(cursor)}</Text>

          <Pressable
            onPress={() => setCursor((d) => addMonths(d, 1))}
            style={styles.navBtn}
          >
            <Text style={styles.navText}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {adherenceSummary.completed}/{adherenceSummary.planned}
          </Text>
          <Text style={styles.summaryLabel}>Completed this week</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {adherenceSummary.adherencePct}%
          </Text>
          <Text style={styles.summaryLabel}>Adherence</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text
            style={[
              styles.summaryValue,
              adherenceSummary.missed > 0 && styles.summaryValueAlert,
            ]}
          >
            {adherenceSummary.missed}
          </Text>
          <Text style={styles.summaryLabel}>Missed</Text>
        </View>
      </View>

      {activeSession?.id ? (
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerChip}>
              <Text style={styles.bannerChipText}>Active</Text>
            </View>
            <Text style={styles.bannerTitle}>Workout in progress</Text>
            <Text style={styles.bannerMeta}>
              {formatActivityType(activeSession.activity_type)} • tap to continue
            </Text>
          </View>

          <Pressable
            onPress={() => onOpenSession?.(activeSession.id)}
            style={({ pressed }) => [
              styles.bannerBtn,
              pressed && styles.pressed,
            ]}
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
          <View style={styles.bannerContent}>
            <Text style={styles.riskTitle}>{riskBannerCopy.title}</Text>
            <Text style={styles.riskMeta}>{riskBannerCopy.meta}</Text>
          </View>

          <Pressable
            onPress={onStart}
            style={({ pressed }) => [styles.riskBtn, pressed && styles.pressed]}
          >
            <Text style={styles.riskBtnText}>Start</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.legendDotComplete} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDotPlanned} />
          <Text style={styles.legendText}>Planned</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDotMissed} />
          <Text style={styles.legendText}>Missed</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDotSkipped} />
          <Text style={styles.legendText}>Skipped</Text>
        </View>
      </View>

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
          const plan = plansByDay.get(dayKey)?.[0] ?? null;

          const active = selectedDay === dayKey;
          const isToday = dayKey === todayKey;
          const todayRisk = isToday && streakRiskLevel !== "none";
          const state = getDayState({ dayKey, todayKey, plan, sessionCount });
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
                streakRiskLevel === "critical" &&
                  isToday &&
                  styles.cellTodayCritical,
                state === "missed" && styles.cellMissed,
                state === "skipped" && styles.cellSkipped,
                pressed && styles.pressed,
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

              {state === "completed" || state === "planned_complete" ? (
                <View style={styles.dotRow}>
                  <View style={styles.dotComplete} />
                  <Text style={styles.count}>{sessionCount}</Text>
                </View>
              ) : state === "missed" ? (
                <View style={styles.dotRow}>
                  <View style={styles.dotMissed} />
                  <Text style={styles.count}>!</Text>
                </View>
              ) : state === "skipped" ? (
                <View style={styles.dotRow}>
                  <View style={styles.dotSkipped} />
                  <Text style={styles.count}>S</Text>
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
              ) : state === "planned" && plan ? (
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
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.sectionSmall}>{selectedDayLabel}</Text>
            <Text
              style={[
                styles.dayStateText,
                selectedState === "missed" && styles.dayStateMissed,
                selectedState === "skipped" && styles.dayStateSkipped,
                (selectedState === "completed" ||
                  selectedState === "planned_complete") &&
                  styles.dayStateCompleted,
              ]}
            >
              {selectedStatusCopy}
            </Text>
          </View>

          <View style={styles.panelMetaChip}>
            <Text style={styles.panelMetaChipText}>
              {selectedSessions.length} workout
              {selectedSessions.length === 1 ? "" : "s"}
              {selectedPlan ? " • 1 plan" : ""}
            </Text>
          </View>
        </View>

        {selectedPlan ? (
          <View style={styles.planSection}>
            <View style={styles.planItem}>
              <View style={styles.planItemHeader}>
                <View style={styles.planTypeChip}>
                  <Text style={styles.planTypeChipText}>
                    {formatActivityType(selectedPlan.activity_type)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.planStatusChip,
                    selectedPlan.status === "planned" &&
                      styles.planStatusChipPlanned,
                    selectedPlan.status === "completed" &&
                      styles.planStatusChipCompleted,
                    selectedPlan.status === "skipped" &&
                      styles.planStatusChipSkipped,
                  ]}
                >
                  <Text style={styles.planStatusChipText}>
                    {selectedPlan.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.planTitle}>
                {selectedPlan.title ?? "Planned workout"}
              </Text>

              <Text style={styles.planMeta}>
                {typeof selectedPlan.planned_duration_min === "number"
                  ? `${selectedPlan.planned_duration_min} min`
                  : "No duration"}
                {typeof selectedPlan.planned_rpe === "number"
                  ? ` • RPE ${selectedPlan.planned_rpe}`
                  : ""}
              </Text>
            </View>

            <View style={styles.actionRow}>
              <View style={styles.flexOne}>
                <PrimaryButton
                  label="Edit Plan"
                  variant="secondary"
                  onPress={() => {
                    if (!selectedDay) return;
                    onDayPress?.(dateFromDayKey(selectedDay), selectedDay);
                  }}
                />
              </View>

              {canStartFromPlan ? (
                <View style={styles.flexOne}>
                  <PrimaryButton
                    label="Start from Plan"
                    onPress={onStartFromPlan}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {selectedSessions.length > 0 ? (
          <View style={styles.sessionList}>
            {selectedSessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => onOpenSession?.(s.id)}
                style={({ pressed }) => [
                  styles.item,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sessionItemMain}>
                  <Text style={styles.itemTitle}>
                    {s.title ?? "Workout session"}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {formatActivityType(s.activity_type)}
                    {typeof s.duration_min === "number"
                      ? ` • ${s.duration_min} min`
                      : ""}
                  </Text>
                </View>

                <View style={styles.openChip}>
                  <Text style={styles.openChipText}>Open</Text>
                </View>
              </Pressable>
            ))}

            {onStartWorkout && !activeSession ? (
              <View style={styles.actionTopSpace}>
                <PrimaryButton
                  label="Start Similar Workout"
                  onPress={onStartSimilar}
                />
              </View>
            ) : null}
          </View>
        ) : !selectedPlan ? (
          <>
            <Text style={styles.hint}>{selectedStatusCopy}</Text>

            {onStartWorkout ? (
              <View style={styles.emptyActionStack}>
                <PrimaryButton
                  label="Plan This Day"
                  variant="secondary"
                  onPress={() => {
                    if (!selectedDay) return;
                    onDayPress?.(dateFromDayKey(selectedDay), selectedDay);
                  }}
                />
                {!activeSession ? (
                  <PrimaryButton label="Start Workout Today" onPress={onStart} />
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },

  flexOne: {
    flex: 1,
  },

  card: {
    marginTop: theme.spacing.lg,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },

  kicker: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  section: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
    marginTop: 4,
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },

  navBtn: {
    width: ui.navSize,
    height: ui.navSize,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface2,
  },

  navText: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
  },

  month: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "900",
  },

  summaryRow: {
    flexDirection: "row",
    gap: ui.summaryGap,
    marginTop: theme.spacing.md,
  },

  summaryCard: {
    flex: 1,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },

  summaryValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
  },

  summaryValueAlert: {
    color: theme.colors.danger,
  },

  summaryLabel: {
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: theme.font.size.xs,
    marginTop: 6,
  },

  banner: {
    marginTop: theme.spacing.md,
    padding: ui.blockPad,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },

  bannerContent: {
    flex: 1,
  },

  bannerChip: {
    alignSelf: "flex-start",
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.successSoft,
    borderWidth: 1,
    borderColor: palette.successBorder,
    marginBottom: theme.spacing.xs,
  },

  bannerChipText: {
    color: theme.colors.success,
    fontSize: theme.font.size.xs,
    fontWeight: "900",
  },

  bannerTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.md,
  },

  bannerMeta: {
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: "700",
    fontSize: theme.font.size.sm,
  },

  bannerBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: palette.accentSoft,
  },

  bannerBtnText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },

  risk: {
    marginTop: theme.spacing.sm,
    padding: ui.blockPad,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },

  riskSoft: {
    borderColor: palette.warningBorder,
    backgroundColor: palette.warningSoft,
  },

  riskMedium: {
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerSoft,
  },

  riskCritical: {
    borderColor: palette.dangerBorderStrong,
    backgroundColor: "rgba(255,69,58,0.18)",
  },

  riskTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.md,
  },

  riskMeta: {
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: "700",
    fontSize: theme.font.size.sm,
  },

  riskBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: palette.accentSoft,
  },

  riskBtnText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },

  legendRow: {
    marginTop: theme.spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendText: {
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: theme.font.size.xs,
  },

  legendDotComplete: {
    width: ui.planDotSize,
    height: ui.planDotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: theme.colors.accent,
  },

  legendDotPlanned: {
    width: ui.planDotSize,
    height: ui.planDotSize,
    borderRadius: ui.radiusPill,
    borderWidth: 2,
    borderColor: palette.warningStrong,
    backgroundColor: "transparent",
  },

  legendDotMissed: {
    width: ui.planDotSize,
    height: ui.planDotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.dangerDot,
  },

  legendDotSkipped: {
    width: ui.planDotSize,
    height: ui.planDotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.skippedDot,
  },

  weekRow: {
    flexDirection: "row",
    marginTop: theme.spacing.md,
  },

  weekday: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: theme.font.size.xs,
  },

  grid: {
    marginTop: ui.calendarTopGap,
    flexDirection: "row",
    flexWrap: "wrap",
  },

  cell: {
    width: `${100 / 7}%`,
    height: ui.calendarCellHeight,
    paddingTop: theme.spacing.xs,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: theme.radius.sm,
  },

  cellActive: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: palette.accentSoft,
  },

  cellToday: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: palette.faintSurface2,
  },

  cellTodayRisk: {
    borderWidth: 1,
    borderColor: palette.dangerBorder,
    backgroundColor: palette.dangerSoft2,
  },

  cellTodayCritical: {
    borderColor: palette.dangerBorderStrong,
    backgroundColor: palette.dangerSoft,
  },

  cellMissed: {
    backgroundColor: palette.dangerSoft,
  },

  cellSkipped: {
    backgroundColor: palette.faintSurface,
  },

  dayNum: {
    color: theme.colors.textMuted,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },

  dayNumToday: {
    color: theme.colors.text,
  },

  dayNumActive: {
    color: theme.colors.text,
  },

  dayNumRisk: {
    color: theme.colors.text,
  },

  dotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },

  dotComplete: {
    width: ui.dotSize,
    height: ui.dotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: theme.colors.accent,
  },

  count: {
    color: theme.colors.textMuted,
    fontWeight: "900",
    fontSize: theme.font.size.xs,
  },

  planDot: {
    width: ui.planDotSize,
    height: ui.planDotSize,
    borderRadius: ui.radiusPill,
    borderWidth: 2,
    backgroundColor: "transparent",
  },

  planDotGray: {
    borderColor: palette.faintLine,
  },

  planDotYellow: {
    borderColor: palette.warningStrong,
  },

  planDotGreen: {
    borderColor: theme.colors.success,
  },

  dotMissed: {
    width: ui.dotSize,
    height: ui.dotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.dangerDot,
  },

  dotSkipped: {
    width: ui.dotSize,
    height: ui.dotSize,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.skippedDot,
  },

  riskDot: {
    width: ui.dotSize,
    height: ui.dotSize,
    borderRadius: ui.radiusPill,
  },

  riskDotSoft: {
    backgroundColor: palette.warningStrong,
  },

  riskDotMedium: {
    backgroundColor: palette.dangerDot,
  },

  riskDotCritical: {
    backgroundColor: theme.colors.danger,
  },

  panel: {
    marginTop: theme.spacing.md,
    padding: ui.blockPad,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },

  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },

  sectionSmall: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.md,
  },

  panelMetaChip: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.faintSurface3,
  },

  panelMetaChipText: {
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: theme.font.size.xs,
  },

  dayStateText: {
    marginTop: theme.spacing.xs,
    color: theme.colors.textMuted,
    fontWeight: "800",
    fontSize: theme.font.size.sm,
  },

  dayStateCompleted: {
    color: theme.colors.text,
  },

  dayStateMissed: {
    color: theme.colors.danger,
  },

  dayStateSkipped: {
    color: theme.colors.textMuted,
  },

  hint: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontWeight: "700",
    fontSize: theme.font.size.sm,
  },

  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },

  emptyActionStack: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },

  actionTopSpace: {
    marginTop: theme.spacing.sm,
  },

  sessionList: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },

  item: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: palette.faintSurface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.sm,
  },

  sessionItemMain: {
    flex: 1,
  },

  itemTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },

  itemMeta: {
    color: theme.colors.textMuted,
    marginTop: 4,
    fontWeight: "700",
    fontSize: theme.font.size.sm,
  },

  openChip: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: palette.faintSurface2,
  },

  openChipText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.xs,
  },

  planSection: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.xs,
  },

  planItem: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: palette.faintSurface,
  },

  planItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },

  planTypeChip: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.faintSurface3,
  },

  planTypeChipText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.xs,
  },

  planStatusChip: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
  },

  planStatusChipPlanned: {
    backgroundColor: palette.warningSoft,
  },

  planStatusChipCompleted: {
    backgroundColor: palette.successSoft,
  },

  planStatusChipSkipped: {
    backgroundColor: palette.faintSurface3,
  },

  planStatusChipText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.xs,
    textTransform: "capitalize",
  },

  planTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },

  planMeta: {
    color: theme.colors.textMuted,
    marginTop: 6,
    fontWeight: "700",
    fontSize: theme.font.size.sm,
  },
});