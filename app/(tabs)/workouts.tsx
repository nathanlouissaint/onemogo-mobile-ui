// app/(tabs)/workouts.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import {
  startWorkoutSession,
  listWorkoutSessions,
  getActiveWorkoutSession,
} from "../../src/lib/workouts";
import type { WorkoutSession } from "../../src/lib/workouts";
import { createWorkoutSessionFromTemplate } from "../../src/lib/workouts.mutations";

import { supabase } from "../../src/lib/supabase";
import { useSession } from "../../src/session/SessionContext";

type ActivityOption = {
  key: string;
  label: string;
};

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { key: "strength", label: "Strength" },
  { key: "cardio", label: "Cardio" },
  { key: "mobility", label: "Mobility" },
  { key: "recovery", label: "Recovery" },
];

type WorkoutTemplate = {
  id: string;
  title: string | null;
  activity_type: string | null;
  created_at?: string;
};

function formatDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizeActivityType(v?: string | null) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "strength";
  if (s === "lifting") return "strength";
  if (s === "run" || s === "running") return "cardio";
  return s;
}

export default function WorkoutsScreen() {
  const { user, loading: sessionLoading } = useSession();
  const userId = user?.id;

  const [loading, setLoading] = useState(true);
  const [startingGeneric, setStartingGeneric] = useState(false);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(
    null
  );
  const [err, setErr] = useState<string | null>(null);

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  const [selectedActivity, setSelectedActivity] = useState<string>("strength");

  const hasSessions = sessions.length > 0;
  const hasTemplates = templates.length > 0;

  const load = async () => {
    if (sessionLoading) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const [sessionData, templateRes] = await Promise.all([
        listWorkoutSessions(userId),
        supabase
          .from("workout_templates")
          .select("id, title, activity_type, created_at")
          .order("created_at", { ascending: false }),
      ]);

      setSessions(sessionData || []);

      if (templateRes.error) throw templateRes.error;
      setTemplates((templateRes.data || []) as WorkoutTemplate[]);
    } catch (e: unknown) {
      const anyErr = e as { message?: string };
      const msg = anyErr?.message ?? "Failed to load workouts";
      setErr(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const onStartWorkout = async () => {
    if (sessionLoading || startingGeneric || startingTemplateId) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setStartingGeneric(true);
    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);

      if (active?.id) {
        router.push(`/sessions/${encodeURIComponent(active.id)}`);
        return;
      }

      const firstMatchingTemplate = templates.find(
        (t) => normalizeActivityType(t.activity_type) === selectedActivity
      );

      if (firstMatchingTemplate?.id) {
        const created = await createWorkoutSessionFromTemplate({
          userId,
          templateId: firstMatchingTemplate.id,
        });

        router.push(`/sessions/${encodeURIComponent(created.id)}`);
        return;
      }

      const label =
        ACTIVITY_OPTIONS.find((o) => o.key === selectedActivity)?.label ??
        "Workout";

      const created = await startWorkoutSession({
        userId,
        title: `${label} Session`,
        activityType: selectedActivity,
      });

      router.push(`/sessions/${encodeURIComponent(created.id)}`);
    } catch (e: unknown) {
      const anyErr = e as { message?: string };
      const msg = anyErr?.message ?? "Failed to start workout session";
      setErr(String(msg));
    } finally {
      setStartingGeneric(false);
    }
  };

  const onStartFromTemplate = async (templateId: string) => {
    if (sessionLoading || startingGeneric || startingTemplateId) return;

    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setStartingTemplateId(templateId);
    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);

      if (active?.id) {
        router.push(`/sessions/${encodeURIComponent(active.id)}`);
        return;
      }

      const created = await createWorkoutSessionFromTemplate({
        userId,
        templateId,
      });

      router.push(`/sessions/${encodeURIComponent(created.id)}`);
    } catch (e: unknown) {
      const anyErr = e as { message?: string };
      const msg = anyErr?.message ?? "Failed to start template workout";
      setErr(String(msg));
    } finally {
      setStartingTemplateId(null);
    }
  };

  useEffect(() => {
    if (!sessionLoading && userId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, userId]);

  const title = useMemo(() => {
    if (loading) return "Workouts";
    if (err) return "Workouts";

    const parts: string[] = [];
    if (hasTemplates) parts.push(`${templates.length} templates`);
    if (hasSessions) parts.push(`${sessions.length} sessions`);

    return parts.length ? `Workouts (${parts.join(" • ")})` : "Workouts";
  }, [loading, err, hasTemplates, hasSessions, templates.length, sessions.length]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(
      (t) => normalizeActivityType(t.activity_type) === selectedActivity
    );
  }, [templates, selectedActivity]);

  const isAnyStartLoading = startingGeneric || !!startingTemplateId;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Pick a template or start a session</Text>
        </View>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={styles.section}>Workout Type</Text>

          <View style={styles.choices}>
            {ACTIVITY_OPTIONS.map((opt) => {
              const active = opt.key === selectedActivity;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    if (isAnyStartLoading) return;
                    setSelectedActivity(opt.key);
                  }}
                  style={({ pressed }) => [
                    styles.choice,
                    active && styles.choiceActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      active && styles.choiceTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ marginTop: theme.spacing.md }}>
            <PrimaryButton
              label={startingGeneric ? "Starting..." : "Start Workout Session"}
              onPress={onStartWorkout}
              loading={startingGeneric}
              disabled={!!startingTemplateId}
            />
          </View>

          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={styles.section}>Templates</Text>
          <Text style={styles.meta}>
            View a template or start a session directly from it.
          </Text>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading templates…</Text>
            </View>
          ) : !hasTemplates ? (
            <Text style={styles.meta}>No templates yet.</Text>
          ) : filteredTemplates.length === 0 ? (
            <Text style={styles.meta}>
              No templates for “{selectedActivity}”.
            </Text>
          ) : (
            <View style={{ marginTop: theme.spacing.md, gap: 10 }}>
              {filteredTemplates.map((t) => {
                const isStartingThisTemplate = startingTemplateId === t.id;
                const disableTemplateActions = isAnyStartLoading;

                return (
                  <Card key={t.id}>
                    <Pressable
                      onPress={() => {
                        if (disableTemplateActions) return;
                        router.push(`/template/${encodeURIComponent(t.id)}`);
                      }}
                      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                    >
                      <Text style={styles.rowTitle}>
                        {t.title ?? "Workout Template"}
                      </Text>
                      <Text style={styles.meta}>
                        {normalizeActivityType(t.activity_type)}
                        {t.created_at ? ` • ${formatDate(t.created_at)}` : ""}
                      </Text>
                    </Pressable>

                    <View style={{ height: 12 }} />

                    <PrimaryButton
                      label={
                        isStartingThisTemplate
                          ? "Starting..."
                          : "Start From Template"
                      }
                      onPress={() => onStartFromTemplate(t.id)}
                      loading={isStartingThisTemplate}
                      disabled={disableTemplateActions && !isStartingThisTemplate}
                    />
                  </Card>
                );
              })}
            </View>
          )}

          <View style={{ height: 12 }} />
          <PrimaryButton
            label="Refresh"
            onPress={load}
            disabled={isAnyStartLoading}
          />
        </Card>

        {loading ? (
          <Card>
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>
                {sessionLoading ? "Loading session…" : "Loading sessions…"}
              </Text>
            </View>
          </Card>
        ) : !hasSessions ? (
          <Card>
            <Text style={styles.meta}>No workout sessions yet.</Text>
            <Text style={[styles.meta, { marginTop: 6 }]}>
              Start a session and it will appear here.
            </Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton
                label="Refresh"
                onPress={load}
                disabled={isAnyStartLoading}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {sessions.map((s) => {
              const started = s.started_at ?? s.created_at ?? null;

              return (
                <Pressable
                  key={s.id}
                  onPress={() =>
                    router.push(`/sessions/${encodeURIComponent(s.id)}`)
                  }
                  style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                >
                  <Card>
                    <Text style={styles.rowTitle}>
                      {s.title ?? "Workout Session"}
                    </Text>

                    <Text style={styles.meta}>
                      {normalizeActivityType(s.activity_type)}
                      {started ? ` • ${formatDate(started)}` : ""}
                      {s.ended_at
                        ? ` • ended ${formatDate(s.ended_at)}`
                        : " • active"}
                    </Text>

                    {typeof s.duration_min === "number" ? (
                      <Text style={styles.meta}>{s.duration_min} min</Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}

            <View style={{ height: 4 }} />
            <PrimaryButton
              label="Refresh"
              onPress={load}
              disabled={isAnyStartLoading}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  header: { marginBottom: theme.spacing.lg },
  title: { color: theme.colors.text, fontSize: 24, fontWeight: "900" },
  sub: { color: theme.colors.textMuted, marginTop: 6, fontWeight: "700" },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  choices: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  choiceActive: {
    borderColor: theme.colors.accent,
  },
  choiceText: {
    color: theme.colors.textMuted,
    fontWeight: "900",
  },
  choiceTextActive: {
    color: theme.colors.text,
  },

  center: { alignItems: "center", paddingVertical: 10 },
  meta: { color: theme.colors.textMuted, marginTop: 8, fontWeight: "700" },
  errorText: { color: "#ff6b6b", fontWeight: "800", marginTop: 10 },

  rowTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "900" },
});