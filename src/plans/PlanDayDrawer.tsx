// src/plans/PlanDayDrawer.tsx
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "../constants/theme";
import {
  deletePlanByDate,
  getPlanForDate,
  markPlanCompletedByDate,
  markPlanSkippedByDate,
  resetPlanToPlannedByDate,
  type PlannedWorkout,
} from "../lib/plans";
import { createWorkoutSessionFromPlan } from "../lib/workouts.mutations";
import { getActiveWorkoutSession } from "../lib/workouts";
import { useSession } from "../session/SessionContext";
import { PlanBuilderModal } from "./PlanBuilderModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string; // YYYY-MM-DD (local)
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
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
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
              <Pressable onPress={load} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Retry</Text>
              </Pressable>
            </>
          ) : !plan ? (
            <>
              <Text style={styles.mutedText}>No plan for this day.</Text>

              <Pressable
                onPress={() => setBuilderOpen(true)}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>Plan workout</Text>
              </Pressable>
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

              <View style={styles.row}>
                <Pressable
                  onPress={onStartWorkout}
                  disabled={starting || !canStartPlan}
                  style={[
                    styles.primaryBtn,
                    styles.rowBtn,
                    (starting || !canStartPlan) && styles.disabledBtn,
                  ]}
                >
                  <Text style={styles.primaryBtnText}>
                    {starting
                      ? "Starting…"
                      : plan.status === "planned"
                      ? "Start Workout"
                      : "Unavailable"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Pressable
                  onPress={() => setStatus("completed")}
                  disabled={savingStatus}
                  style={[
                    styles.statusBtn,
                    styles.statusCompleted,
                    savingStatus && styles.disabledBtn,
                  ]}
                >
                  <Text style={styles.statusBtnText}>Mark Completed</Text>
                </Pressable>

                <Pressable
                  onPress={() => setStatus("skipped")}
                  disabled={savingStatus}
                  style={[
                    styles.statusBtn,
                    styles.statusSkipped,
                    savingStatus && styles.disabledBtn,
                  ]}
                >
                  <Text style={styles.statusBtnText}>Mark Skipped</Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Pressable
                  onPress={() => setStatus("planned")}
                  disabled={savingStatus}
                  style={[
                    styles.statusBtn,
                    styles.statusReset,
                    savingStatus && styles.disabledBtn,
                  ]}
                >
                  <Text style={styles.statusBtnText}>Reset to Planned</Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Pressable
                  onPress={() => setBuilderOpen(true)}
                  style={styles.secondaryBtn}
                >
                  <Text style={styles.secondaryBtnText}>Edit</Text>
                </Pressable>

                <Pressable
                  onPress={onDelete}
                  disabled={deleting}
                  style={[styles.dangerBtn, deleting && styles.disabledBtn]}
                >
                  <Text style={styles.dangerBtnText}>
                    {deleting ? "Deleting…" : "Delete"}
                  </Text>
                </Pressable>
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
  root: { flex: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: theme.spacing.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: theme.colors.surface,
    minHeight: 320,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeBtnText: { color: theme.colors.text, fontWeight: "800" },

  mutedText: {
    color: theme.colors.textMuted,
    marginTop: 12,
    fontWeight: "700",
  },

  errorText: {
    color: "#ff6b6b",
    marginTop: 12,
    fontWeight: "800",
  },

  primaryBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
  },
  primaryBtnText: {
    color: theme.colors.text,
    textAlign: "center",
    fontWeight: "800",
  },

  rowBtn: {
    flex: 1,
    marginTop: 0,
  },

  planCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planTitle: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: theme.font.size.md,
  },
  planMeta: {
    color: theme.colors.textMuted,
    marginTop: 6,
    fontWeight: "700",
  },

  metaPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  metaPillText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  row: { flexDirection: "row", gap: 10, marginTop: 12 },

  secondaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryBtnText: {
    color: theme.colors.text,
    textAlign: "center",
    fontWeight: "800",
  },

  dangerBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#7f1d1d",
  },
  dangerBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "800",
  },

  statusBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBtnText: { color: "#fff", fontWeight: "800" },

  statusCompleted: { backgroundColor: "#166534" },
  statusSkipped: { backgroundColor: "#7f1d1d" },
  statusReset: { backgroundColor: "#334155" },

  disabledBtn: {
    opacity: 0.6,
  },
});