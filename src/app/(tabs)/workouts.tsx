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

import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { Screen } from "../../components/Screen";
import { theme } from "../../constants/theme";

import {
  getActiveWorkoutSession,
  listWorkoutSessions,
  startWorkoutSession,
} from "../../lib/workouts";
import type { WorkoutSession } from "../../lib/workouts";
import { createWorkoutSessionFromTemplate } from "../../lib/workouts.mutations";

import { supabase } from "../../lib/supabase";
import { useSession } from "../../session/SessionContext";

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

const ui = {
  radiusPill: 999,
};

const palette = {
  accentSoft: "rgba(10,132,255,0.12)",
  successSoft: "rgba(48,209,88,0.14)",
  successBorder: "rgba(48,209,88,0.35)",
  successText: "#34d399",
  faintSurface: "rgba(255,255,255,0.06)",
};

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
  }, [sessionLoading, userId]);

  const activeSession = useMemo(() => {
    const active = sessions.find((s) => !s.ended_at);
    return active ?? null;
  }, [sessions]);

  const completedSessions = useMemo(() => {
    return sessions.filter((s) => !!s.ended_at);
  }, [sessions]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(
      (t) => normalizeActivityType(t.activity_type) === selectedActivity
    );
  }, [templates, selectedActivity]);

  const isAnyStartLoading = startingGeneric || !!startingTemplateId;

  const selectedActivityLabel =
    ACTIVITY_OPTIONS.find((o) => o.key === selectedActivity)?.label ??
    "Workout";

  return (
    <Screen scroll contentStyle={styles.screenContent}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Training</Text>
        <Text style={styles.title}>Workouts</Text>
        <Text style={styles.sub}>
          Start fast, resume what is active, or launch from a template.
        </Text>
      </View>

      {err ? (
        <Card style={styles.errorCard}>
          <Text style={styles.errorTitle}>Something broke</Text>
          <Text style={styles.errorText}>{err}</Text>
          <View style={styles.topActionSpace}>
            <PrimaryButton label="Retry" onPress={load} />
          </View>
        </Card>
      ) : null}

      {loading ? (
        <Card style={styles.sectionCard}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading workouts...</Text>
          </View>
        </Card>
      ) : (
        <>
          {activeSession ? (
            <Card style={styles.sectionCard} variant="elevated">
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

                <View style={styles.actionTopSpace}>
                  <PrimaryButton
                    label="Continue Workout"
                    onPress={() =>
                      router.push(
                        `/sessions/${encodeURIComponent(activeSession.id)}`
                      )
                    }
                  />
                </View>
              </View>
            </Card>
          ) : null}

          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Quick start</Text>
            <Text style={styles.sectionSub}>
              Pick a training type and launch immediately.
            </Text>

            <View style={styles.pillRow}>
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = option.key === selectedActivity;

                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSelectedActivity(option.key)}
                    style={({ pressed }) => [
                      styles.activityPill,
                      selected && styles.activityPillSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.activityPillText,
                        selected && styles.activityPillTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.topActionSpace}>
              <PrimaryButton
                label={
                  startingGeneric
                    ? "Starting..."
                    : `Start ${selectedActivityLabel} Session`
                }
                onPress={onStartWorkout}
                loading={startingGeneric}
                disabled={isAnyStartLoading}
              />
            </View>
          </Card>

          <Card style={styles.sectionCard} variant="subtle">
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderCopy}>
                <Text style={styles.section}>Templates</Text>
                <Text style={styles.sectionSub}>
                  Saved templates filtered by selected activity.
                </Text>
              </View>

              <View style={styles.templateCountPill}>
                <Text style={styles.templateCountText}>
                  {filteredTemplates.length}
                </Text>
              </View>
            </View>

            {hasTemplates ? (
              filteredTemplates.length > 0 ? (
                <View style={styles.stack}>
                  {filteredTemplates.map((template) => {
                    const busy = startingTemplateId === template.id;

                    return (
                      <Card
                        key={template.id}
                        style={styles.innerCard}
                        variant="default"
                      >
                        <View style={styles.templateTopRow}>
                          <View style={styles.templateCopy}>
                            <Text style={styles.templateTitle}>
                              {template.title?.trim() || "Untitled Template"}
                            </Text>
                            <Text style={styles.templateMeta}>
                              {formatActivityType(template.activity_type)}
                              {template.created_at
                                ? ` • ${formatDate(template.created_at)}`
                                : ""}
                            </Text>
                          </View>

                          <View style={styles.templateTag}>
                            <Text style={styles.templateTagText}>Template</Text>
                          </View>
                        </View>

                        <View style={styles.actionTopSpace}>
                          <PrimaryButton
                            label={busy ? "Starting..." : "Start From Template"}
                            onPress={() => onStartFromTemplate(template.id)}
                            loading={busy}
                            disabled={isAnyStartLoading}
                            variant="secondary"
                          />
                        </View>
                      </Card>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyTitle}>No matching templates</Text>
                  <Text style={styles.emptyText}>
                    There are no saved templates for {selectedActivityLabel.toLowerCase()} right now.
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No templates yet</Text>
                <Text style={styles.emptyText}>
                  Build templates next so launch flows are faster and more consistent.
                </Text>
              </View>
            )}
          </Card>

          <Card style={styles.sectionCard}>
            <Text style={styles.section}>Recent sessions</Text>
            <Text style={styles.sectionSub}>
              Completed workout history and prior checkpoints.
            </Text>

            {hasSessions ? (
              completedSessions.length > 0 ? (
                <View style={styles.stack}>
                  {completedSessions.slice(0, 5).map((session) => (
                    <Pressable
                      key={session.id}
                      onPress={() =>
                        router.push(`/sessions/${encodeURIComponent(session.id)}`)
                      }
                      style={({ pressed }) => [
                        styles.sessionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.sessionRowCopy}>
                        <Text style={styles.sessionRowTitle} numberOfLines={1}>
                          {session.title?.trim() || "Workout Session"}
                        </Text>
                        <Text style={styles.sessionRowMeta}>
                          {formatActivityType(session.activity_type)}
                          {session.ended_at
                            ? ` • ${formatDate(session.ended_at)}`
                            : ""}
                        </Text>
                      </View>

                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>Complete</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyTitle}>No completed sessions yet</Text>
                  <Text style={styles.emptyText}>
                    Your completed workouts will appear here after you finish them.
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyTitle}>No workout history yet</Text>
                <Text style={styles.emptyText}>
                  Start the first session to create history and unlock the active workflow.
                </Text>
              </View>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.92,
  },

  screenContent: {
    paddingBottom: theme.spacing.xl,
  },

  header: {
    marginBottom: theme.spacing.lg,
  },

  kicker: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  title: {
    color: theme.colors.text,
    fontSize: theme.font.size.xxl,
    fontWeight: "900",
    marginTop: 6,
  },

  sub: {
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    fontSize: theme.font.size.md,
    fontWeight: "700",
    lineHeight: 22,
  },

  sectionCard: {
    marginBottom: theme.spacing.md,
  },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  sectionSub: {
    color: theme.colors.textMuted,
    marginTop: 8,
    fontSize: theme.font.size.sm,
    fontWeight: "600",
    lineHeight: 20,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  sectionHeaderCopy: {
    flex: 1,
  },

  activeHero: {
    marginTop: theme.spacing.md,
  },

  activeHeroMain: {
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },

  activeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radiusPill,
    backgroundColor: theme.colors.accent,
  },

  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  activeTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
    marginTop: 12,
  },

  activeMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 20,
  },

  actionTopSpace: {
    marginTop: theme.spacing.md,
  },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },

  loadingText: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorCard: {
    marginBottom: theme.spacing.md,
    borderColor: "#7f1d1d",
    backgroundColor: "rgba(127,29,29,0.18)",
  },

  errorTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "800",
  },

  errorText: {
    color: "#fca5a5",
    marginTop: 8,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    lineHeight: 20,
  },

  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: theme.spacing.md,
  },

  activityPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.faintSurface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  activityPillSelected: {
    backgroundColor: palette.accentSoft,
    borderColor: theme.colors.accent,
  },

  activityPillText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  activityPillTextSelected: {
    color: theme.colors.text,
  },

  templateCountPill: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: ui.radiusPill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },

  templateCountText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  stack: {
    marginTop: theme.spacing.md,
    gap: 12,
  },

  innerCard: {
    padding: 14,
  },

  templateTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  templateCopy: {
    flex: 1,
  },

  templateTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "800",
    lineHeight: 22,
  },

  templateMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 20,
  },

  templateTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radiusPill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  templateTagText: {
    color: theme.colors.textFaint,
    fontSize: 11,
    fontWeight: "800",
  },

  emptyBlock: {
    marginTop: theme.spacing.md,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: palette.faintSurface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "800",
  },

  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  sessionRowCopy: {
    flex: 1,
  },

  sessionRowTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "800",
  },

  sessionRowMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 20,
  },

  completedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: ui.radiusPill,
    backgroundColor: palette.successSoft,
    borderWidth: 1,
    borderColor: palette.successBorder,
  },

  completedBadgeText: {
    color: palette.successText,
    fontSize: 11,
    fontWeight: "800",
  },

  topActionSpace: {
    marginTop: theme.spacing.md,
  },
});