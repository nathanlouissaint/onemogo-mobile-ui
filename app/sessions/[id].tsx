// app/sessions/[id].tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { theme } from "../../src/constants/theme";

import {
  completeWorkoutSession,
  getWorkoutSessionDetail,
  type WorkoutSession,
  type WorkoutSessionDetail,
  type WorkoutSessionDetailItem,
  type WorkoutSessionSet,
} from "../../src/lib/workouts";
import {
  addWorkoutSessionSet,
  deleteWorkoutSessionSet,
  updateWorkoutSessionSet,
} from "../../src/lib/workouts.mutations";
import { useSession } from "../../src/session/SessionContext";

function formatActivityType(v?: string | null) {
  if (!v) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as Record<string, unknown>;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") {
      return anyErr.error_description;
    }
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationMin(v?: number | null, startedAt?: string | null) {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return `${v} min`;

  if (!startedAt) return "—";

  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return "—";

  const liveMin = Math.max(
    0,
    Math.round((Date.now() - start.getTime()) / 60000)
  );
  return `${liveMin} min`;
}

function formatSetValue(set: WorkoutSessionSet) {
  const parts: string[] = [];

  if (typeof set.reps === "number") {
    parts.push(`${set.reps} reps`);
  }

  if (typeof set.weight_kg === "number") {
    parts.push(`${set.weight_kg} kg`);
  }

  if (typeof set.rpe === "number") {
    parts.push(`RPE ${set.rpe}`);
  }

  if (typeof set.duration_sec === "number") {
    parts.push(`${set.duration_sec}s`);
  }

  if (typeof set.distance_m === "number") {
    parts.push(`${set.distance_m}m`);
  }

  return parts.length ? parts.join(" • ") : "Logged";
}

function buildPrescriptionLabel(item: WorkoutSessionDetailItem) {
  const parts: string[] = [];

  if (typeof item.prescribed_sets === "number") {
    parts.push(`${item.prescribed_sets} sets`);
  }

  if (typeof item.prescribed_reps === "number") {
    parts.push(`${item.prescribed_reps} reps`);
  }

  if (typeof item.prescribed_weight_kg === "number") {
    parts.push(`${item.prescribed_weight_kg} kg`);
  }

  if (typeof item.prescribed_rpe === "number") {
    parts.push(`RPE ${item.prescribed_rpe}`);
  }

  return parts.length ? parts.join(" • ") : "No prescription";
}

function getSessionProgress(detail: WorkoutSessionDetail | null) {
  if (!detail) {
    return {
      totalExercises: 0,
      completedExercises: 0,
      totalLoggedSets: 0,
      plannedSets: 0,
      hasAnyLoggedWork: false,
    };
  }

  const totalExercises = detail.items.length;
  const completedExercises = detail.items.filter(
    (item) => item.is_completed || item.sets.length > 0
  ).length;
  const totalLoggedSets = detail.items.reduce(
    (sum, item) => sum + item.sets.length,
    0
  );
  const plannedSets = detail.items.reduce(
    (sum, item) => sum + (item.prescribed_sets ?? 0),
    0
  );

  return {
    totalExercises,
    completedExercises,
    totalLoggedSets,
    plannedSets,
    hasAnyLoggedWork: totalLoggedSets > 0,
  };
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error("Enter valid numeric values.");
  }
  return parsed;
}

export default function WorkoutSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const sessionId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    return (raw ?? "").toString().trim();
  }, [id]);

  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [addingSet, setAddingSet] = useState(false);
  const [editingSet, setEditingSet] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);

  const [activeAddItemId, setActiveAddItemId] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const [repsInput, setRepsInput] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [rpeInput, setRpeInput] = useState("");

  const session: WorkoutSession | null = detail?.session ?? null;

  const resetFormFields = useCallback(() => {
    setRepsInput("");
    setWeightInput("");
    setRpeInput("");
  }, []);

  const resetAddSetForm = useCallback(() => {
    setActiveAddItemId(null);
    resetFormFields();
  }, [resetFormFields]);

  const resetEditSetForm = useCallback(() => {
    setEditingSetId(null);
    resetFormFields();
  }, [resetFormFields]);

  const clearInlineForms = useCallback(() => {
    setActiveAddItemId(null);
    setEditingSetId(null);
    resetFormFields();
  }, [resetFormFields]);

  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setErr("Missing session id.");
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setErr("Not authenticated.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const data = await getWorkoutSessionDetail(sessionId);

      if (!data?.session) {
        throw new Error("Session not found.");
      }

      if (data.session.user_id !== user.id) {
        throw new Error("You do not have access to this session.");
      }

      setDetail(data);
    } catch (e: unknown) {
      setDetail(null);
      setErr(getErrMsg(e, "Failed to load session."));
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  const progress = useMemo(() => getSessionProgress(detail), [detail]);

  const integrityWarnings = useMemo(() => {
    if (!session) return [];

    const warnings: string[] = [];

    if (session.ended_at && typeof session.duration_min !== "number") {
      warnings.push(
        "Completed session is missing a persisted duration_min value."
      );
    }

    if (progress.totalExercises === 0) {
      warnings.push(
        "This session has no workout_session_items yet. The exercise layer has not been populated."
      );
    }

    return warnings;
  }, [progress.totalExercises, session]);

  const onCompleteSession = useCallback(async () => {
    if (!session?.id || session.ended_at) return;

    if (!progress.hasAnyLoggedWork) {
      Alert.alert(
        "No logged work yet",
        "Log at least one set before completing this session."
      );
      return;
    }

    setCompleting(true);
    setErr(null);

    try {
      await completeWorkoutSession({ sessionId: session.id });

      const refreshed = await getWorkoutSessionDetail(session.id);

      if (refreshed.session.user_id !== user?.id) {
        throw new Error("You do not have access to this session.");
      }

      setDetail(refreshed);
      clearInlineForms();

      Alert.alert(
        "Session completed",
        "The session was completed and reloaded from the latest saved data."
      );
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to complete session."));
    } finally {
      setCompleting(false);
    }
  }, [
    clearInlineForms,
    progress.hasAnyLoggedWork,
    session?.ended_at,
    session?.id,
    user?.id,
  ]);

  const onOpenAddSet = useCallback(
    (itemId: string) => {
      setEditingSetId(null);
      setActiveAddItemId(itemId);
      resetFormFields();
    },
    [resetFormFields]
  );

  const onOpenEditSet = useCallback((set: WorkoutSessionSet) => {
    setActiveAddItemId(null);
    setEditingSetId(set.id);
    setRepsInput(typeof set.reps === "number" ? String(set.reps) : "");
    setWeightInput(
      typeof set.weight_kg === "number" ? String(set.weight_kg) : ""
    );
    setRpeInput(typeof set.rpe === "number" ? String(set.rpe) : "");
  }, []);

  const onSubmitAddSet = useCallback(
    async (item: WorkoutSessionDetailItem) => {
      if (!session?.id || session.ended_at) return;

      setAddingSet(true);
      setErr(null);

      try {
        const reps = parseOptionalNumber(repsInput);
        const weightKg = parseOptionalNumber(weightInput);
        const rpe = parseOptionalNumber(rpeInput);

        if (reps === null && weightKg === null && rpe === null) {
          throw new Error(
            "Enter at least one set value. Reps, weight, or RPE cannot all be blank."
          );
        }

        await addWorkoutSessionSet({
          sessionId: session.id,
          sessionItemId: item.id,
          reps,
          weightKg,
          rpe,
        });

        await loadSession();
        resetAddSetForm();
      } catch (e: unknown) {
        setErr(getErrMsg(e, "Failed to add set."));
      } finally {
        setAddingSet(false);
      }
    },
    [
      loadSession,
      repsInput,
      resetAddSetForm,
      rpeInput,
      session?.ended_at,
      session?.id,
      weightInput,
    ]
  );

  const onSubmitEditSet = useCallback(
    async (set: WorkoutSessionSet) => {
      if (!session?.id || session.ended_at) return;

      setEditingSet(true);
      setErr(null);

      try {
        const reps = parseOptionalNumber(repsInput);
        const weightKg = parseOptionalNumber(weightInput);
        const rpe = parseOptionalNumber(rpeInput);

        if (reps === null && weightKg === null && rpe === null) {
          throw new Error(
            "Enter at least one set value. Reps, weight, or RPE cannot all be blank."
          );
        }

        await updateWorkoutSessionSet({
          setId: set.id,
          reps,
          weightKg,
          rpe,
        });

        await loadSession();
        resetEditSetForm();
      } catch (e: unknown) {
        setErr(getErrMsg(e, "Failed to update set."));
      } finally {
        setEditingSet(false);
      }
    },
    [
      loadSession,
      repsInput,
      resetEditSetForm,
      rpeInput,
      session?.ended_at,
      session?.id,
      weightInput,
    ]
  );

  const onDeleteSet = useCallback(
    (set: WorkoutSessionSet) => {
      if (!session?.id || session.ended_at) return;

      Alert.alert(
        "Delete set",
        `Delete Set ${set.set_index}? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              setDeletingSetId(set.id);
              setErr(null);

              try {
                await deleteWorkoutSessionSet(set.id);
                await loadSession();
                if (editingSetId === set.id) {
                  resetEditSetForm();
                }
              } catch (e: unknown) {
                setErr(getErrMsg(e, "Failed to delete set."));
              } finally {
                setDeletingSetId(null);
              }
            },
          },
        ]
      );
    },
    [editingSetId, loadSession, resetEditSetForm, session?.ended_at, session?.id]
  );

  const title =
    (session?.title && String(session.title).trim()) || "Workout Session";

  const statusLabel = session?.ended_at ? "Completed" : "Active";
  const planIdLabel = session?.plan_id ? String(session.plan_id) : "None";
  const templateIdLabel = session?.template_id
    ? String(session.template_id)
    : "None";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Session</Text>
          <Text style={styles.title} numberOfLines={2}>
            {loading ? "Loading..." : title}
          </Text>
          <Text style={styles.sub}>
            {loading
              ? "Loading session..."
              : `${formatActivityType(session?.activity_type)} • ${statusLabel}`}
          </Text>
        </View>

        {loading ? (
          <Card>
            <View style={styles.center}>
              <ActivityIndicator />
              <Text style={styles.meta}>Loading session…</Text>
            </View>
          </Card>
        ) : err ? (
          <Card>
            <Text style={styles.errorText}>{err}</Text>
            <View style={{ marginTop: theme.spacing.md }}>
              <PrimaryButton label="Retry" onPress={loadSession} />
            </View>
            <View style={{ height: 12 }} />
            <PrimaryButton label="Back" onPress={() => router.back()} />
          </Card>
        ) : session ? (
          <>
            {integrityWarnings.length ? (
              <Card style={{ marginBottom: theme.spacing.md }}>
                <Text style={styles.warningTitle}>Integrity Warnings</Text>
                <View style={styles.warningList}>
                  {integrityWarnings.map((warning) => (
                    <Text key={warning} style={styles.warningText}>
                      • {warning}
                    </Text>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Overview</Text>

              <View style={styles.metaStack}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Session ID</Text>
                  <Text style={styles.metaValue}>{session.id}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Activity</Text>
                  <Text style={styles.metaValue}>
                    {formatActivityType(session.activity_type)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Status</Text>
                  <Text
                    style={[
                      styles.metaValue,
                      session.ended_at ? styles.completeText : styles.activeText,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Started</Text>
                  <Text style={styles.metaValue}>
                    {formatDateTime(session.started_at ?? session.created_at)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Ended</Text>
                  <Text style={styles.metaValue}>
                    {formatDateTime(session.ended_at)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>
                    {formatDurationMin(session.duration_min, session.started_at)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Plan ID</Text>
                  <Text style={styles.metaValue}>{planIdLabel}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Template ID</Text>
                  <Text style={styles.metaValue}>{templateIdLabel}</Text>
                </View>
              </View>
            </Card>

            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Progress</Text>

              <View style={styles.metaStack}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Exercises</Text>
                  <Text style={styles.metaValue}>
                    {progress.completedExercises}/{progress.totalExercises}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Sets</Text>
                  <Text style={styles.metaValue}>
                    {progress.plannedSets > 0
                      ? `${progress.totalLoggedSets}/${progress.plannedSets}`
                      : `${progress.totalLoggedSets} logged`}
                  </Text>
                </View>
              </View>

              <Text style={styles.meta}>
                This is now the real session read layer: exercise blocks and
                logged sets are loaded directly from the session detail model.
              </Text>
            </Card>

            <Card style={{ marginBottom: theme.spacing.md }}>
              <Text style={styles.section}>Exercises</Text>

              <View style={styles.exerciseList}>
                {detail?.items.length ? (
                  detail.items.map((item, index) => {
                    const isAddOpen = activeAddItemId === item.id;

                    return (
                      <View key={item.id} style={styles.exerciseCard}>
                        <View style={styles.exerciseHeader}>
                          <Text style={styles.exerciseIndex}>{index + 1}</Text>
                          <View style={styles.exerciseHeaderText}>
                            <Text style={styles.exerciseName}>
                              {item.exercise_name}
                            </Text>
                            <Text style={styles.exercisePrescription}>
                              {buildPrescriptionLabel(item)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.exerciseStatus,
                              item.is_completed || item.sets.length > 0
                                ? styles.completeText
                                : styles.pendingText,
                            ]}
                          >
                            {item.is_completed || item.sets.length > 0
                              ? "In Progress"
                              : "Not Started"}
                          </Text>
                        </View>

                        {item.notes ? (
                          <Text style={styles.exerciseNotes}>{item.notes}</Text>
                        ) : null}

                        <View style={styles.setList}>
                          {item.sets.length ? (
                            item.sets.map((set) => {
                              const isEditingThisSet = editingSetId === set.id;
                              const isDeletingThisSet = deletingSetId === set.id;

                              return (
                                <View key={set.id} style={styles.setRow}>
                                  {isEditingThisSet ? (
                                    <View style={styles.editSetCard}>
                                      <Text style={styles.addSetTitle}>
                                        Edit Set {set.set_index}
                                      </Text>

                                      <TextInput
                                        value={repsInput}
                                        onChangeText={setRepsInput}
                                        placeholder="Reps"
                                        placeholderTextColor={theme.colors.textFaint}
                                        keyboardType="numeric"
                                        style={styles.input}
                                      />

                                      <TextInput
                                        value={weightInput}
                                        onChangeText={setWeightInput}
                                        placeholder="Weight (kg)"
                                        placeholderTextColor={theme.colors.textFaint}
                                        keyboardType="decimal-pad"
                                        style={styles.input}
                                      />

                                      <TextInput
                                        value={rpeInput}
                                        onChangeText={setRpeInput}
                                        placeholder="RPE (1-10)"
                                        placeholderTextColor={theme.colors.textFaint}
                                        keyboardType="numeric"
                                        style={styles.input}
                                      />

                                      <View style={styles.addSetActions}>
                                        <View style={styles.addSetActionButton}>
                                          <PrimaryButton
                                            label={editingSet ? "Saving..." : "Save Changes"}
                                            onPress={() => onSubmitEditSet(set)}
                                          />
                                        </View>
                                        <View style={styles.addSetActionButton}>
                                          <PrimaryButton
                                            label="Cancel"
                                            onPress={resetEditSetForm}
                                          />
                                        </View>
                                      </View>
                                    </View>
                                  ) : (
                                    <>
                                      <View>
                                        <Text style={styles.setTitle}>
                                          Set {set.set_index}
                                          {set.set_type && set.set_type !== "work"
                                            ? ` • ${set.set_type}`
                                            : ""}
                                        </Text>
                                        <Text style={styles.setValue}>
                                          {formatSetValue(set)}
                                        </Text>
                                      </View>

                                      <Text style={styles.setTimestamp}>
                                        {formatDateTime(set.completed_at)}
                                      </Text>

                                      {!session.ended_at ? (
                                        <View style={styles.setActions}>
                                          <View style={styles.setActionButton}>
                                            <PrimaryButton
                                              label="Edit"
                                              onPress={() => onOpenEditSet(set)}
                                            />
                                          </View>
                                          <View style={styles.setActionButton}>
                                            <PrimaryButton
                                              label={
                                                isDeletingThisSet ? "Deleting..." : "Delete"
                                              }
                                              onPress={() => onDeleteSet(set)}
                                            />
                                          </View>
                                        </View>
                                      ) : null}
                                    </>
                                  )}
                                </View>
                              );
                            })
                          ) : (
                            <Text style={styles.emptySetText}>
                              No sets logged yet.
                            </Text>
                          )}
                        </View>

                        {!session.ended_at ? (
                          <View style={{ marginTop: theme.spacing.md }}>
                            {isAddOpen ? (
                              <View style={styles.addSetCard}>
                                <Text style={styles.addSetTitle}>
                                  Add Set
                                </Text>

                                <TextInput
                                  value={repsInput}
                                  onChangeText={setRepsInput}
                                  placeholder="Reps"
                                  placeholderTextColor={theme.colors.textFaint}
                                  keyboardType="numeric"
                                  style={styles.input}
                                />

                                <TextInput
                                  value={weightInput}
                                  onChangeText={setWeightInput}
                                  placeholder="Weight (kg)"
                                  placeholderTextColor={theme.colors.textFaint}
                                  keyboardType="decimal-pad"
                                  style={styles.input}
                                />

                                <TextInput
                                  value={rpeInput}
                                  onChangeText={setRpeInput}
                                  placeholder="RPE (1-10)"
                                  placeholderTextColor={theme.colors.textFaint}
                                  keyboardType="numeric"
                                  style={styles.input}
                                />

                                <View style={styles.addSetActions}>
                                  <View style={styles.addSetActionButton}>
                                    <PrimaryButton
                                      label={addingSet ? "Saving..." : "Save Set"}
                                      onPress={() => onSubmitAddSet(item)}
                                    />
                                  </View>
                                  <View style={styles.addSetActionButton}>
                                    <PrimaryButton
                                      label="Cancel"
                                      onPress={resetAddSetForm}
                                    />
                                  </View>
                                </View>
                              </View>
                            ) : (
                              <PrimaryButton
                                label="Add Set"
                                onPress={() => onOpenAddSet(item.id)}
                              />
                            )}
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.meta}>
                    No exercises have been loaded into this session yet.
                  </Text>
                )}
              </View>
            </Card>

            <Card>
              <Text style={styles.section}>Actions</Text>

              <View style={{ marginTop: theme.spacing.lg }}>
                {!session.ended_at ? (
                  <>
                    <PrimaryButton
                      label={completing ? "Completing..." : "Complete Session"}
                      onPress={onCompleteSession}
                    />
                    <View style={{ height: 12 }} />
                  </>
                ) : null}

                <PrimaryButton label="Refresh" onPress={loadSession} />
                <View style={{ height: 12 }} />
                <PrimaryButton label="Back" onPress={() => router.back()} />
              </View>

              <Text style={styles.meta}>
                Completion is now blocked until at least one set is logged.
              </Text>
            </Card>
          </>
        ) : (
          <Card>
            <Text style={styles.meta}>Session not found.</Text>
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

  center: {
    alignItems: "center",
    paddingVertical: 10,
  },

  section: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  metaStack: {
    marginTop: theme.spacing.md,
    gap: 12,
  },

  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  metaLabel: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  metaValue: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },

  activeText: {
    color: "#7dd3fc",
  },

  completeText: {
    color: "#34d399",
  },

  pendingText: {
    color: theme.colors.textMuted,
  },

  meta: {
    color: theme.colors.textMuted,
    marginTop: 10,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorText: {
    color: "#ff6b6b",
    fontWeight: "800",
  },

  warningTitle: {
    color: "#f59e0b",
    fontSize: theme.font.size.sm,
    fontWeight: "900",
  },

  warningList: {
    marginTop: theme.spacing.md,
    gap: 8,
  },

  warningText: {
    color: "#fbbf24",
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  exerciseList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },

  exerciseCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },

  exerciseHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  exerciseIndex: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "900",
    minWidth: 18,
  },

  exerciseHeaderText: {
    flex: 1,
    gap: 4,
  },

  exerciseName: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },

  exercisePrescription: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  exerciseStatus: {
    fontSize: theme.font.size.xs,
    fontWeight: "900",
    textAlign: "right",
  },

  exerciseNotes: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    marginTop: theme.spacing.sm,
  },

  setList: {
    marginTop: theme.spacing.md,
    gap: 10,
  },

  setRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    gap: 6,
  },

  setTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  setValue: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    marginTop: 2,
  },

  setTimestamp: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.xs,
    fontWeight: "700",
    marginTop: 4,
  },

  setActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },

  setActionButton: {
    flex: 1,
  },

  emptySetText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  addSetCard: {
    marginTop: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
  },

  editSetCard: {
    gap: 10,
  },

  addSetTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "900",
  },

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
    backgroundColor: "transparent",
  },

  addSetActions: {
    flexDirection: "row",
    gap: 12,
  },

  addSetActionButton: {
    flex: 1,
  },
});