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
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

  const activeSession = useMemo(() => {
    const active = sessions.find((s) => !s.ended_at);
    return active ?? null;
  }, [sessions]);

  const completedSessions = useMemo(() => {
    return sessions.filter((s) => !!s.ended_at);
  }, [sessions]);

  const title = useMemo(() => {
    if (loading || err) return "Workouts";
    return "Workouts";
  }, [loading, err]);

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
          <Text style={styles.kicker}>Training</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>
            Start fast, resume what is active, or launch from a template.
          </Text>
        </View>

        {activeSession ? (
          <Card style={{ marginBottom: theme.spacing.md }}>
            <Text style={styles.section}>Resume workout</Text>

            <View style={styles.activeHero}>
              <View style={styles.activeHeroMain}>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>

                <Text style={styles.activeTitle}>
                  {activeSession.title ?? "Workout Session"}
                </Text>

                <Text style={styles.activeMeta}>
                  {formatActivityType(activeSession.activity_type)}
                  {activeSession.started_at
                    ? ` • ${formatDate(activeSession.started_at)}`
                    : ""}
                </Text>
              </View>

              <View style={{ marginTop: theme.spacing.md }}>
                <PrimaryButton
                  label="Continue Workout"
                  onPress={() =>
                    router.push(`/sessions/${encodeURIComponent(activeSession.id)}`)
                  }
                />
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={{ marginBottom: theme.spacing.md }}>
          <Text style={styles.section}>Quick start</Text>
          <Text style={styles.helperText}>
            Pick a workout type and start immediately.
          </Text>

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
                    pressed && { opacity: 0.92 },
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
              label={startingGeneric ? "Starting..." : "Start Workout"}
              onPress={onStartWorkout}
              loading={startingGeneric}
              disabled={!!startingTemplateId}
            />
          </View>

          {err ? <Text style={styles.errorText}>{err}</Text> : null}
        </Card>

        <Card style={{ marginBottom: theme.spacing.md }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.section}>Templates</Text>
              <Text style={styles.helperText}>
                Start from a saved workout structure.
              </Text>
            </View>

            <View style={styles.countChip}>
              <Text style={styles.countChipText}>
                {filteredTemplates.length} shown
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading templates…</Text>
            </View>
          ) : !hasTemplates ? (
            <Text style={styles.meta}>No templates yet.</Text>
          ) : filteredTemplates.length === 0 ? (
            <Text style={styles.meta}>
              No templates for {formatActivityType(selectedActivity)} yet.
            </Text>
          ) : (
            <View style={styles.templateList}>
              {filteredTemplates.map((t) => {
                const isStartingThisTemplate = startingTemplateId === t.id;
                const disableTemplateActions = isAnyStartLoading;

                return (
                  <View key={t.id} style={styles.templateCard}>
                    <Pressable
                      onPress={() => {
                        if (disableTemplateActions) return;
                        router.push(`/template/${encodeURIComponent(t.id)}`);
                      }}
                      style={({ pressed }) => [pressed && { opacity: 0.92 }]}
                    >
                      <View style={styles.templateHeader}>
                        <View style={styles.templateTitleWrap}>
                          <Text style={styles.templateTitle}>
                            {t.title ?? "Workout Template"}
                          </Text>
                          <Text style={styles.templateMeta}>
                            {formatActivityType(t.activity_type)}
                            {t.created_at ? ` • ${formatDate(t.created_at)}` : ""}
                          </Text>
                        </View>

                        <View style={styles.templateTypeChip}>
                          <Text style={styles.templateTypeChipText}>
                            {formatActivityType(t.activity_type)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    <View style={styles.templateActions}>
                      <View style={styles.templateActionButton}>
                        <PrimaryButton
                          label="Preview"
                          onPress={() =>
                            router.push(`/template/${encodeURIComponent(t.id)}`)
                          }
                          disabled={disableTemplateActions}
                        />
                      </View>
                      <View style={styles.templateActionButton}>
                        <PrimaryButton
                          label={
                            isStartingThisTemplate
                              ? "Starting..."
                              : "Start Template"
                          }
                          onPress={() => onStartFromTemplate(t.id)}
                          loading={isStartingThisTemplate}
                          disabled={
                            disableTemplateActions && !isStartingThisTemplate
                          }
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 12 }} />
          <PrimaryButton
            label="Refresh Templates"
            onPress={load}
            disabled={isAnyStartLoading}
          />
        </Card>

        <Card>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.section}>Recent sessions</Text>
              <Text style={styles.helperText}>
                Review completed workouts and jump back into your history.
              </Text>
            </View>

            <View style={styles.countChip}>
              <Text style={styles.countChipText}>
                {completedSessions.length} completed
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>
                {sessionLoading ? "Loading session…" : "Loading sessions…"}
              </Text>
            </View>
          ) : !hasSessions ? (
            <View>
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
            </View>
          ) : completedSessions.length === 0 ? (
            <Text style={styles.meta}>
              No completed sessions yet. Finish your first workout to build history.
            </Text>
          ) : (
            <View style={styles.sessionList}>
              {completedSessions.map((s) => {
                const started = s.started_at ?? s.created_at ?? null;

                return (
                  <Pressable
                    key={s.id}
                    onPress={() =>
                      router.push(`/sessions/${encodeURIComponent(s.id)}`)
                    }
                    style={({ pressed }) => [
                      styles.sessionRow,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    <View style={styles.sessionRowMain}>
                      <Text style={styles.sessionRowTitle}>
                        {s.title ?? "Workout Session"}
                      </Text>
                      <Text style={styles.sessionRowMeta}>
                        {formatActivityType(s.activity_type)}
                        {started ? ` • ${formatDate(started)}` : ""}
                      </Text>
                    </View>

                    <View style={styles.sessionRowRight}>
                      {typeof s.duration_min === "number" ? (
                        <Text style={styles.sessionDuration}>
                          {s.duration_min} min
                        </Text>
                      ) : null}
                      <Text style={styles.sessionOpenText}>Open</Text>
                    </View>
                  </Pressable>
                );
              })}

              <View style={{ height: 4 }} />
              <PrimaryButton
                label="Refresh Sessions"
                onPress={load}
                disabled={isAnyStartLoading}
              />
            </View>
          )}
        </Card>
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
    fontWeight: "800",
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xxl,
    fontWeight: "900",
    marginTop: 6,
  },
  sub: {
    color: theme.colors.textMuted,
    marginTop: 8,
    fontWeight: "700",
    lineHeight: 20,
  },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "900",
  },
  helperText: {
    color: theme.colors.textMuted,
    marginTop: 8,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countChipText: {
    color: theme.colors.text,
    fontSize: theme.font.size.xs,
    fontWeight: "900",
  },

  activeHero: {
    marginTop: theme.spacing.md,
    borderRadius: 18,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  activeHeroMain: {
    gap: 8,
  },
  activeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(52, 211, 153, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  activeBadgeText: {
    color: "#34d399",
    fontSize: theme.font.size.xs,
    fontWeight: "900",
  },
  activeTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
  },
  activeMeta: {
    color: theme.colors.textMuted,
    fontWeight: "700",
  },

  choices: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choice: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface2,
  },
  choiceActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(10,132,255,0.12)",
  },
  choiceText: {
    color: theme.colors.textMuted,
    fontWeight: "900",
  },
  choiceTextActive: {
    color: theme.colors.text,
  },

  templateList: {
    marginTop: theme.spacing.md,
    gap: 12,
  },
  templateCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface2,
  },
  templateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  templateTitleWrap: {
    flex: 1,
  },
  templateTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },
  templateMeta: {
    color: theme.colors.textMuted,
    marginTop: 6,
    fontWeight: "700",
  },
  templateTypeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  templateTypeChipText: {
    color: theme.colors.text,
    fontSize: theme.font.size.xs,
    fontWeight: "900",
  },
  templateActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: theme.spacing.md,
  },
  templateActionButton: {
    flex: 1,
  },

  sessionList: {
    marginTop: theme.spacing.md,
    gap: 10,
  },
  sessionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface2,
  },
  sessionRowMain: {
    flex: 1,
  },
  sessionRowTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },
  sessionRowMeta: {
    color: theme.colors.textMuted,
    marginTop: 6,
    fontWeight: "700",
  },
  sessionRowRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  sessionDuration: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.sm,
  },
  sessionOpenText: {
    color: theme.colors.textFaint,
    fontWeight: "800",
    fontSize: theme.font.size.xs,
  },

  center: { alignItems: "center", paddingVertical: 10 },
  meta: { color: theme.colors.textMuted, marginTop: 8, fontWeight: "700" },
  errorText: { color: "#ff6b6b", fontWeight: "800", marginTop: 10 },
});
