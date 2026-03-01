// src/plans/PlanDayDrawer.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSession } from "../session/SessionContext";
import { deletePlanByDate, getPlanForDate, PlannedWorkout } from "../lib/plans";
import { PlanBuilderModal } from "./PlanBuilderModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string; // YYYY-MM-DD
};

export function PlanDayDrawer({ visible, onClose, planDate }: Props) {
  const { user } = useSession();
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlannedWorkout | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const title = useMemo(() => {
    if (!plan) return null;
    return plan.title ?? "Planned workout";
  }, [plan]);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const p = await getPlanForDate(userId, planDate);
      setPlan(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, planDate, userId]);

  async function onDelete() {
    if (!userId) return;
    await deletePlanByDate(userId, planDate);
    setPlan(null);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: 16,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: "#111",
          minHeight: 260,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
          {planDate}
        </Text>

        {loading ? (
          <Text style={{ color: "#aaa", marginTop: 12 }}>Loading…</Text>
        ) : !plan ? (
          <>
            <Text style={{ color: "#aaa", marginTop: 12 }}>
              No plan for this day.
            </Text>

            <Pressable
              onPress={() => setBuilderOpen(true)}
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                backgroundColor: "#2563eb",
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>
                Plan workout
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <View
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                backgroundColor: "#1b1b1b",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>{title}</Text>

              {!!plan.scheduled_time && (
                <Text style={{ color: "#bbb", marginTop: 6 }}>
                  Time: {plan.scheduled_time.slice(0, 5)}
                </Text>
              )}

              {!!plan.notes && (
                <Text style={{ color: "#bbb", marginTop: 6 }} numberOfLines={2}>
                  Notes: {plan.notes}
                </Text>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setBuilderOpen(true)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "#333",
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center" }}>Edit</Text>
              </Pressable>

              <Pressable
                onPress={onDelete}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "#7f1d1d",
                }}
              >
                <Text style={{ color: "#fff", textAlign: "center" }}>
                  Delete
                </Text>
              </Pressable>
            </View>

            {/* Phase 2: Start from plan */}
            <Pressable
              disabled
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                backgroundColor: "#222",
                opacity: 0.6,
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>
                Start (Phase 2)
              </Text>
            </Pressable>
          </>
        )}

        <PlanBuilderModal
          visible={builderOpen}
          onClose={() => setBuilderOpen(false)}
          planDate={planDate}
          existing={plan}
          onSaved={(p) => {
            setPlan(p);
            setBuilderOpen(false);
          }}
        />
      </View>
    </Modal>
  );
}