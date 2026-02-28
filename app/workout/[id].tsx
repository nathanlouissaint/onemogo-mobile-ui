// app/workout/[id].tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { getWorkoutById } from "../../src/lib/workouts";
import { useSession } from "../../src/session/SessionContext";

// Local types (kept for your current UI shape)
type WorkoutExercise = {
  id?: string;
  name: string;
  sets?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;
};

type WorkoutDetail = {
  id: string;
  title: string;
  description?: string | null;
  difficulty?: string | null;
  durationMinutes?: number | null;
  exercises?: WorkoutExercise[];
};

function formatDifficulty(v?: string | null) {
  if (!v) return "—";
  const s = String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const workoutId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return (raw ?? "").toString();
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);

  const fetchWorkout = useCallback(async () => {
    if (!workoutId || !user?.id) {
      if (!workoutId) setErr("Missing workout id.");
      if (!user?.id) setErr("Not authenticated.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = await getWorkoutById(user.id, workoutId);
      setWorkout({
        id: data.id,
        title: data.title ?? "Workout",
        description: data.notes,
        durationMinutes: data.duration_min ?? undefined,
        difficulty: data.activity_type ?? undefined,
        // exercises not implemented yet (no backing table in current schema)
        exercises: [],
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load workout";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  }, [workoutId, user?.id]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!mounted) return;
      await fetchWorkout();
    })();

    return () => {
      mounted = false;
    };
  }, [fetchWorkout]);

  const exercises = workout?.exercises ?? [];

  const onComplete = () => {
    Alert.alert(
      "Not available yet",
      "Workout completion isn't implemented yet. This button will be enabled once the backend supports it."
    );
  };

  const onRetry = async () => {
    await fetchWorkout();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.kicker}>Workout</Text>
          <Text style={styles.title} numberOfLines={2}>
            {loading ? "Loading..." : workout?.title ?? "Workout"}
          </Text>
          <Text style={styles.sub}>
            {workout?.difficulty ? formatDifficulty(workout.difficulty) : "—"}
            {typeof workout?.durationMinutes === "number"
              ? ` • ${workout.durationMinutes} min`
              : ""}
          </Text>
        </View>

        {/* States */}
        {loading ? (
          <Card>
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading workout…</Text>
            </View>
          </Card>
        ) : err ? (
          <Card>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={onRetry} />
            </View>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </Card>
        ) : workout ? (
          <>
            {/* Overview */}
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Overview</Text>
              <Text style={styles.body}>
                {workout.description?.trim()
                  ? workout.description
                  : "No description provided."}
              </Text>
            </Card>

            {/* Exercises */}
            <Card>
              <Text style={styles.section}>Exercises</Text>

              {exercises.length === 0 ? (
                <Text style={styles.meta}>
                  No exercises listed for this workout.
                </Text>
              ) : (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {exercises.map((ex, idx) => (
                    <View key={`${ex.id ?? idx}`} style={styles.exerciseRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>

                        <Text style={styles.meta}>
                          {typeof ex.sets === "number"
                            ? `${ex.sets} sets`
                            : "— sets"}
                          {typeof ex.reps === "number"
                            ? ` • ${ex.reps} reps`
                            : ""}
                          {typeof ex.durationSeconds === "number"
                            ? ` • ${ex.durationSeconds}s`
                            : ""}
                        </Text>

                        {ex.notes ? (
                          <Text style={styles.notes}>{ex.notes}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ marginTop: theme.spacing.lg }}>
                <PrimaryButton
                  label="Mark Complete"
                  onPress={onComplete}
                  disabled
                />
                <View style={{ height: 12 }} />
                <PrimaryButton label="Back" onPress={() => router.back()} />
              </View>
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.meta}>Workout not found.</Text>
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
  body: {
    color: theme.colors.text,
    marginTop: 10,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorText: { color: "#ff6b6b", fontWeight: "800" },

  exerciseRow: {
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  exerciseName: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },
  notes: {
    marginTop: 6,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },
});