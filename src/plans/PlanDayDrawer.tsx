// src/plans/PlanDayDrawer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useSession } from "../session/SessionContext";
import {
  deletePlanByDate,
  getPlanForDate,
  markPlanCompletedByDate,
  markPlanSkippedByDate,
  PlannedWorkout,
  resetPlanToPlannedByDate,
} from "../lib/plans";
import { PlanBuilderModal } from "./PlanBuilderModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string; // YYYY-MM-DD (local)
};

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string") return anyErr.error_description;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

function statusLabel(s: PlannedWorkout["status"] | null | undefined) {
  if (!s) return "planned";
  if (s === "planned") return "Planned";
  if (s === "completed") return "Completed";
  if (s === "skipped") return "Skipped";
  return String(s);
}

export function PlanDayDrawer({ visible, onClose, planDate }: Props) {
  const { user } = useSession();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const title = useMemo(() => {
    if (!plan) return null;
    return plan.title ?? "Planned workout";
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
    if (!userId) return;

    setLoading(true);
    setErr(null);

    try {
      await deletePlanByDate(userId, planDate);
      setPlan(null);
      await load();
    } catch (e: unknown) {
      setErr(getErrMsg(e, "Failed to delete plan"));
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (next: "planned" | "completed" | "skipped") => {
    if (!userId) return;

    setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{planDate}</Text>

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

              <Pressable onPress={() => setBuilderOpen(true)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Plan workout</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.planCard}>
                <Text style={styles.planTitle}>{title}</Text>

                <Text style={styles.planMeta}>Status: {statusLabel(plan.status)}</Text>

                <Text style={styles.planMeta}>
                  Planned:{" "}
                  {typeof plan.planned_duration_min === "number"
                    ? `${plan.planned_duration_min} min`
                    : "—"}
                  {" • "}
                  {typeof plan.planned_rpe === "number" ? `RPE ${plan.planned_rpe}` : "RPE —"}
                </Text>

                {!!plan.scheduled_time && (
                  <Text style={styles.planMeta}>Time: {plan.scheduled_time.slice(0, 5)}</Text>
                )}

                {!!plan.notes && (
                  <Text style={styles.planMeta} numberOfLines={2}>
                    Notes: {plan.notes}
                  </Text>
                )}
              </View>

              {/* Status quick actions */}
              <View style={styles.row}>
                <Pressable
                  onPress={() => setStatus("completed")}
                  style={[styles.statusBtn, styles.statusCompleted]}
                >
                  <Text style={styles.statusBtnText}>Mark Completed</Text>
                </Pressable>

                <Pressable
                  onPress={() => setStatus("skipped")}
                  style={[styles.statusBtn, styles.statusSkipped]}
                >
                  <Text style={styles.statusBtnText}>Mark Skipped</Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Pressable
                  onPress={() => setStatus("planned")}
                  style={[styles.statusBtn, styles.statusReset]}
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

                <Pressable onPress={onDelete} style={styles.dangerBtn}>
                  <Text style={styles.dangerBtnText}>Delete</Text>
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
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#111",
    minHeight: 300,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },

  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#1b1b1b",
  },
  closeBtnText: { color: "#fff", fontWeight: "700" },

  mutedText: { color: "#aaa", marginTop: 12 },

  errorText: { color: "#ff6b6b", marginTop: 12, fontWeight: "700" },

  primaryBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  primaryBtnText: { color: "#fff", textAlign: "center", fontWeight: "700" },

  planCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#1b1b1b",
  },
  planTitle: { color: "#fff", fontWeight: "700" },
  planMeta: { color: "#bbb", marginTop: 6 },

  row: { flexDirection: "row", gap: 10, marginTop: 12 },

  secondaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#333",
  },
  secondaryBtnText: { color: "#fff", textAlign: "center", fontWeight: "700" },

  dangerBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#7f1d1d",
  },
  dangerBtnText: { color: "#fff", textAlign: "center", fontWeight: "700" },

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
});