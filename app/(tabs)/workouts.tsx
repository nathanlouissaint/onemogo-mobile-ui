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

import { ApiError, getWorkouts, WorkoutSession } from "../../src/lib/supabase";

function formatDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function WorkoutsScreen() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const hasSessions = sessions.length > 0;

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getWorkouts();
      setSessions(data);
    } catch (e: any) {
      const msg =
        e instanceof ApiError ? e.message : e?.message ?? "Failed to load workouts";
      setErr(msg.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const title = useMemo(() => {
    if (loading) return "Workouts";
    if (err) return "Workouts";
    return hasSessions ? `Workouts (${sessions.length})` : "Workouts";
  }, [loading, err, hasSessions, sessions.length]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>Your logged sessions</Text>
      </View>

      {loading ? (
        <Card>
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.meta}>Loading workouts…</Text>
          </View>
        </Card>
      ) : err ? (
        <Card>
          <Text style={styles.errorText}>{err}</Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton label="Retry" onPress={load} />
          </View>
        </Card>
      ) : !hasSessions ? (
        <Card>
          <Text style={styles.meta}>No workouts yet.</Text>
          <Text style={[styles.meta, { marginTop: 6 }]}>
            When you log a session, it will appear here.
          </Text>
          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton label="Refresh" onPress={load} />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {sessions.map((s) => {
            const started = s.startedAt ?? s.createdAt ?? null;
            const ended = s.endedAt ?? null;

            return (
              <Pressable
                key={s.id}
                onPress={() => router.push(`/workout/${encodeURIComponent(s.id)}`)}
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              >
                <Card>
                  <Text style={styles.rowTitle}>{s.title ?? "Workout Session"}</Text>
                  <Text style={styles.meta}>
                    {s.activityType ?? "WORKOUT"}
                    {started ? ` • ${formatDate(started)}` : ""}
                    {ended ? ` • ended ${formatDate(ended)}` : ""}
                  </Text>
                  {typeof s.durationMin === "number" ? (
                    <Text style={styles.meta}>{s.durationMin} min</Text>
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

  center: { alignItems: "center", paddingVertical: 10 },
  meta: { color: theme.colors.textMuted, marginTop: 8, fontWeight: "700" },
  errorText: { color: "#ff6b6b", fontWeight: "800" },

  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
});