// src/components/WorkoutCalendar.tsx
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "./Card";
import { PrimaryButton } from "./PrimaryButton";
import { theme } from "../constants/theme";
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayIndex(day0Sun: number) {
  return (day0Sun + 6) % 7;
}

type Props = {
  sessions: WorkoutSession[];
  onOpenSession?: (id: string) => void;

  // Action hooks (dashboard CTAs)
  onStartWorkout?: (activityType?: string) => void; // start today
  defaultActivityType?: string; // used for "Start Workout" CTA

  streakRiskHourLocal?: number; // default 18 (6pm)
};

export function WorkoutCalendar({
  sessions,
  onOpenSession,
  onStartWorkout,
  defaultActivityType = "lifting",
  streakRiskHourLocal = 18,
}: Props) {
  const now = new Date();
  const todayKey = ymdLocal(now);

  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(todayKey);

  const activeSession = useMemo(() => {
    // If multiple exist (shouldn't), pick the most recent
    const actives = sessions.filter((s) => !s.ended_at);
    actives.sort((a, b) => {
      const ta = new Date(a.started_at ?? a.created_at).getTime();
      const tb = new Date(b.started_at ?? b.created_at).getTime();
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
        const ta = new Date(a.ended_at ?? a.created_at).getTime();
        const tb = new Date(b.ended_at ?? b.created_at).getTime();
        return tb - ta;
      });
      map.set(k, arr);
    }
    return map;
  }, [sessions]);

  const hasCompletedToday = useMemo(() => {
    return (completedByDay.get(todayKey)?.length ?? 0) > 0;
  }, [completedByDay, todayKey]);

  const streakAtRisk = useMemo(() => {
    const hour = now.getHours();
    return hour >= streakRiskHourLocal && !hasCompletedToday && !activeSession;
  }, [now, streakRiskHourLocal, hasCompletedToday, activeSession]);

  const monthStart = startOfMonth(cursor);
  const monthDays = daysInMonth(cursor);
  const leadingBlanks = mondayIndex(monthStart.getDay());

  const cells = useMemo(() => {
    const out: Array<{ day: number | null; key: string }> = [];
    for (let i = 0; i < leadingBlanks; i++) out.push({ day: null, key: `b-${i}` });
    for (let day = 1; day <= monthDays; day++) out.push({ day, key: `d-${day}` });
    while (out.length % 7 !== 0) out.push({ day: null, key: `t-${out.length}` });
    return out;
  }, [leadingBlanks, monthDays]);

  const selectedSessions = useMemo(() => {
    if (!selectedDay) return [];
    return completedByDay.get(selectedDay) ?? [];
  }, [selectedDay, completedByDay]);

  const selectedHasWorkouts = selectedSessions.length > 0;
  const selectedIsToday = selectedDay === todayKey;

  const selectedMostRecentActivity = useMemo(() => {
    if (!selectedSessions.length) return null;
    return selectedSessions[0]?.activity_type ?? null;
  }, [selectedSessions]);

  const onStart = () => {
    onStartWorkout?.(defaultActivityType);
  };

  const onStartSimilar = () => {
    const activity = selectedMostRecentActivity ?? defaultActivityType;
    onStartWorkout?.(activity);
  };

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

      {/* Active session banner */}
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

      {/* Streak at risk banner */}
      {streakAtRisk ? (
        <View style={styles.risk}>
          <View style={{ flex: 1 }}>
            <Text style={styles.riskTitle}>Streak at risk</Text>
            <Text style={styles.riskMeta}>No completed workout today. Start one now.</Text>
          </View>
          <Pressable
            onPress={onStart}
            style={({ pressed }) => [styles.riskBtn, pressed && { opacity: 0.9 }]}
          >
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

          const count = completedByDay.get(dayKey)?.length ?? 0;
          const active = selectedDay === dayKey;
          const isToday = dayKey === todayKey;

          return (
            <Pressable
              key={c.key}
              onPress={() => setSelectedDay(dayKey)}
              style={({ pressed }) => [
                styles.cell,
                isToday && styles.cellToday,
                active && styles.cellActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday, active && styles.dayNumActive]}>
                {c.day}
              </Text>

              {count > 0 ? (
                <View style={styles.dotRow}>
                  <View style={styles.dot} />
                  <Text style={styles.count}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* Selected day panel */}
      <View style={styles.panel}>
        <Text style={styles.sectionSmall}>
          {selectedDay ?? "—"} • {selectedSessions.length} workout{selectedSessions.length === 1 ? "" : "s"}
        </Text>

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

            {/* Action: start similar (starts today, not back-dated) */}
            {onStartWorkout ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <PrimaryButton label="Start Similar Today" onPress={onStartSimilar} />
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={styles.hint}>
              {selectedIsToday ? "No workouts logged today." : "No workouts logged on this day."}
            </Text>

            {onStartWorkout ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <PrimaryButton label="Start Workout Today" onPress={onStart} />
              </View>
            ) : null}
          </>
        )}
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
    borderColor: "rgba(255,107,107,0.35)",
    backgroundColor: "rgba(255,107,107,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  riskTitle: { color: theme.colors.text, fontWeight: "900" },
  riskMeta: { color: theme.colors.textMuted, marginTop: 2, fontWeight: "700" },
  riskBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.55)",
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

  dayNum: { color: theme.colors.textMuted, fontWeight: "900" },
  dayNumToday: { color: theme.colors.text },
  dayNumActive: { color: theme.colors.text },

  dotRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: theme.colors.accent },
  count: { color: theme.colors.textMuted, fontWeight: "900", fontSize: 12 },

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
});