// src/plans/PlanDayDrawer.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "../components/PrimaryButton";
import { theme } from "../constants/theme";
import {
  deletePlanByDate,
  getPlanForDate,
  markPlanCompletedByDate,
  markPlanSkippedByDate,
  resetPlanToPlannedByDate,
  type PlannedWorkout,
} from "../lib/plans";
import { getActiveWorkoutSession } from "../lib/workouts";
import { createWorkoutSessionFromPlan } from "../lib/workouts.mutations";
import { useSession } from "../session/SessionContext";
import { PlanBuilderModal } from "./PlanBuilderModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string;
};

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

function statusLabel(s: PlannedWorkout["status"] | null | undefined) {
  if (!s) return "Planned";
  if (s === "planned") return "Planned";
  if (s === "completed") return "Completed";
  if (s === "skipped") return "Skipped";
  return String(s);
}

function formatActivityType(v?: string | null) {
  const s = String(v ?? "").trim();
  if (!s) return "Workout";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ui = {
  radiusPill: 999,
  sheetMinHeight: 320,
  blockPad: 14,
  chipPadX: 10,
  chipPadY: 6,
};

const palette = {
  overlay: "rgba(0,0,0,0.45)",
  faintSurface: "rgba(255,255,255,0.04)",
  successSoft: "rgba(48,209,88,0.14)",
  dangerSoft: "rgba(255,69,58,0.14)",
  resetSoft: "rgba(148,163,184,0.16)",
};

export function PlanDayDrawer({ visible, onClose, planDate }: Props) {
  const { user } = useSession();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const title = useMemo(() => {
    if (!plan) return null;
    return plan.title?.trim() || "Planned workout";
  }, [plan]);

  const canStartPlan = useMemo(() => {
    return !!plan && plan.status !== "completed" && plan.status !== "skipped";
  }, [plan]);

  const load = async () => {
    if (!userId) return;

    setLoading(true);
    setErr(null);

    try {
      const p = await getPlanForDate(userId, planDate);
      setPlan(p ?? null);
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to load plan"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planDate, userId]);

  const onDelete = async () => {
    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setDeleting(true);
    setErr(null);

    try {
      await deletePlanByDate(userId, planDate);
      setPlan(null);
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to delete plan"));
    } finally {
      setDeleting(false);
    }
  };

  const setStatus = async (next: "planned" | "completed" | "skipped") => {
    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    setSavingStatus(true);
    setErr(null);

    try {
      if (next === "completed") {
        await markPlanCompletedByDate(userId, planDate);
      } else if (next === "skipped") {
        await markPlanSkippedByDate(userId, planDate);
      } else {
        await resetPlanToPlannedByDate(userId, planDate);
      }

      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to update plan status"));
    } finally {
      setSavingStatus(false);
    }
  };

  const onStartWorkout = async () => {
    if (!userId) {
      setErr("No user session found. Please log in again.");
      return;
    }

    if (!plan?.id) {
      setErr("No plan found for this day.");
      return;
    }

    if (!canStartPlan) {
      setErr("This plan cannot be started in its current state.");
      return;
    }

    setStarting(true);
    setErr(null);

    try {
      const active = await getActiveWorkoutSession(userId);

      if (active?.id) {
        onClose();
        router.push({ pathname: "/sessions/[id]", params: { id: active.id } });
        return;
      }

      const created = await createWorkoutSessionFromPlan({
        userId,
        planId: plan.id,
      });

      onClose();
      router.push({ pathname: "/sessions/[id]", params: { id: created.id } });
    } catch (e: unknown) {
      console.log("PlanDayDrawer onStartWorkout error:", e);
      setErr(getErrMsg(e, "Failed to start workout"));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>Plan day</Text>
              <Text style={styles.headerTitle}>{planDate}</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <Text style={styles.mutedText}>Loading…</Text>
          ) : err ? (
            <>
              <Text style={styles.errorText}>{err}</Text>
              <View style={styles.sectionTopSpace}>
                <PrimaryButton label="Retry" onPress={load} />
              </View>
            </>
          ) : !plan ? (
            <>
              <Text style={styles.mutedText}>No plan for this day.</Text>

              <View style={styles.sectionTopSpace}>
                <PrimaryButton
                  label="Plan workout"
                  onPress={() => setBuilderOpen(true)}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.planCard}>
                <Text style={styles.planTitle}>{title}</Text>

                <View style={styles.metaPillRow}>
                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>
                      {formatActivityType(plan.activity_type)}
                    </Text>
                  </View>

                  <View style={styles.metaPill}>
                    <Text style={styles.metaPillText}>
                      {statusLabel(plan.status)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.planMeta}>
                  Planned:{" "}
                  {typeof plan.planned_duration_min === "number"
                    ? `${plan.planned_duration_min} min`
                    : "—"}
                  {" • "}
                  {typeof plan.planned_rpe === "number"
                    ? `RPE ${plan.planned_rpe}`
                    : "RPE —"}
                </Text>

                {!!plan.scheduled_time && (
                  <Text style={styles.planMeta}>
                    Time: {plan.scheduled_time.slice(0, 5)}
                  </Text>
                )}

                {!!plan.notes && (
                  <Text style={styles.planMeta} numberOfLines={3}>
                    Notes: {plan.notes}
                  </Text>
                )}
              </View>

              <View style={styles.sectionTopSpace}>
                <PrimaryButton
                  label={
                    starting
                      ? "Starting…"
                      : plan.status === "planned"
                      ? "Start Workout"
                      : "Unavailable"
                  }
                  onPress={onStartWorkout}
                  disabled={starting || !canStartPlan}
                />
              </View>

              <View style={styles.row}>
                <View style={styles.flexOne}>
                  <PrimaryButton
                    label="Mark Completed"
                    onPress={() => setStatus("completed")}
                    disabled={savingStatus}
                    variant="secondary"
                  />
                </View>

                <View style={styles.flexOne}>
                  <PrimaryButton
                    label="Mark Skipped"
                    onPress={() => setStatus("skipped")}
                    disabled={savingStatus}
                    variant="danger"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flexOne}>
                  <PrimaryButton
                    label="Reset to Planned"
                    onPress={() => setStatus("planned")}
                    disabled={savingStatus}
                    variant="ghost"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.flexOne}>
                  <PrimaryButton
                    label="Edit"
                    onPress={() => setBuilderOpen(true)}
                    variant="secondary"
                  />
                </View>

                <View style={styles.flexOne}>
                  <PrimaryButton
                    label={deleting ? "Deleting…" : "Delete"}
                    onPress={onDelete}
                    disabled={deleting}
                    variant="danger"
                  />
                </View>
              </View>
            </>
          )}

          <PlanBuilderModal
            visible={builderOpen}
            onClose={() => setBuilderOpen(false)}
            planDate={planDate}
            existing={plan}
            onSaved={async (p) => {
              setPlan(p);
              setBuilderOpen(false);
              await load();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.overlay,
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: ui.sheetMinHeight,
    padding: theme.spacing.lg,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },

  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },

  headerCopy: {
    flex: 1,
  },

  headerEyebrow: {
    color: theme.colors.textFaint,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  headerTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.lg,
    fontWeight: "900",
    marginTop: 4,
  },

  closeBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  closeBtnText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  mutedText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  errorText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.danger,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  sectionTopSpace: {
    marginTop: theme.spacing.md,
  },

  planCard: {
    marginTop: theme.spacing.sm,
    padding: ui.blockPad,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  planTitle: {
    color: theme.colors.text,
    fontSize: theme.font.size.md,
    fontWeight: "900",
  },

  planMeta: {
    marginTop: 6,
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },

  metaPill: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: palette.faintSurface,
  },

  metaPillText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },

  flexOne: {
    flex: 1,
  },
});