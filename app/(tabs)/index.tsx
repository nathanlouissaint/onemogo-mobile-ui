import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { theme } from "../../src/constants/theme";

export default function HomeScreen() {
  const data = {
    name: "Nate",
    streak: 6,
    weeklyWorkouts: 4,
    minutesThisWeek: 138,
    weeklyGoalMin: 180,
    todayWorkout: {
      title: "Upper Body Strength",
      durationMin: 45,
      difficulty: "Moderate",
    },
  };

  const progress = Math.min(1, data.minutesThisWeek / data.weeklyGoalMin);
  const pct = Math.round(progress * 100);

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
        <Text style={styles.section}>Today</Text>

        <View style={styles.todayRow}>
          <Text style={styles.workoutTitle}>{data.todayWorkout.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{data.todayWorkout.difficulty}</Text>
          </View>
        </View>

        <Text style={styles.meta}>{data.todayWorkout.durationMin} minutes</Text>

        <View style={{ marginTop: theme.spacing.md }}>
          <PrimaryButton label="Start Workout" onPress={() => {}} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: theme.spacing.lg },
  kicker: { color: theme.colors.textFaint, fontSize: theme.font.size.sm, fontWeight: "700" },
  title: { color: theme.colors.text, fontSize: theme.font.size.xxl, fontWeight: "900", marginTop: 8 },
  sub: { color: theme.colors.textMuted, marginTop: 10, fontSize: theme.font.size.md },

  row: { flexDirection: "row", gap: theme.spacing.sm },
  half: { flex: 1 },

  label: { color: theme.colors.textFaint, fontSize: theme.font.size.sm, fontWeight: "700" },
  value: { color: theme.colors.text, fontSize: theme.font.size.xl, fontWeight: "900", marginTop: 10 },
  meta: { color: theme.colors.textMuted, marginTop: 6, fontSize: theme.font.size.sm },

  progress: { marginTop: theme.spacing.sm },
  progressTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
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
  section: { color: theme.colors.textFaint, fontSize: theme.font.size.sm, fontWeight: "800" },
  todayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  workoutTitle: { color: theme.colors.text, fontSize: theme.font.size.lg, fontWeight: "900", flex: 1, paddingRight: 10 },
  badge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, fontWeight: "800" },
});
