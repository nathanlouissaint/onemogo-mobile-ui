// src/plans/PlanBuilderModal.tsx
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSession } from "../session/SessionContext";
import {
  PlannedWorkout,
  toTimeString,
  upsertPlan,
} from "../lib/plans";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string; // YYYY-MM-DD
  existing: PlannedWorkout | null;
  onSaved: (p: PlannedWorkout) => void;
};

export function PlanBuilderModal({
  visible,
  onClose,
  planDate,
  existing,
  onSaved,
}: Props) {
  const { user } = useSession();
  const userId = user?.id;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [timeEnabled, setTimeEnabled] = useState(!!existing?.scheduled_time);

  const initialTime = useMemo(() => {
    // make a Date object for the picker; default to 9:00
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    if (existing?.scheduled_time) {
      const [h, m] = existing.scheduled_time.split(":");
      d.setHours(Number(h), Number(m), 0, 0);
    }
    return d;
  }, [existing?.scheduled_time]);

  const [time, setTime] = useState<Date>(initialTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const t = title.trim();
    // Template optional; MVP requires title since templates not wired here
    return t.length > 0 && t.length <= 60;
  }, [title]);

  async function onSave() {
    if (!userId) return;
    setError(null);

    const t = title.trim();
    if (t.length === 0) {
      setError("Title is required (template optional).");
      return;
    }
    if (t.length > 60) {
      setError("Title must be 60 characters or less.");
      return;
    }
    if (notes.length > 1000) {
      setError("Notes must be 1000 characters or less.");
      return;
    }

    setSaving(true);
    try {
      const planned = await upsertPlan({
        userId,
        planDate,
        title: t,
        notes: notes.trim() ? notes.trim() : null,
        scheduledTime: timeEnabled ? toTimeString(time) : null,
        templateId: null, // wire templates later
      });
      onSaved(planned);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
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
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>
          {existing ? "Edit plan" : "Plan workout"} • {planDate}
        </Text>

        <Text style={{ color: "#aaa", marginTop: 10 }}>Workout title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Push day, Legs, Lifting session"
          placeholderTextColor="#666"
          style={{
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#1b1b1b",
            color: "#fff",
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
          <Pressable
            onPress={() => setTimeEnabled((v) => !v)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: timeEnabled ? "#2563eb" : "#333",
            }}
          >
            <Text style={{ color: "#fff" }}>
              {timeEnabled ? "Time set" : "Add time"}
            </Text>
          </Pressable>

          {timeEnabled && (
            <View style={{ marginLeft: 12 }}>
              {/* Requires installing @react-native-community/datetimepicker */}
              {Platform.OS !== "web" && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="default"
                  onChange={(_, date) => {
                    if (date) setTime(date);
                  }}
                />
              )}
              {Platform.OS === "web" && (
                <Text style={{ color: "#bbb" }}>
                  Time picker not supported on web in this MVP.
                </Text>
              )}
            </View>
          )}
        </View>

        <Text style={{ color: "#aaa", marginTop: 12 }}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Targets, cues, gym, equipment, anything you want to remember."
          placeholderTextColor="#666"
          multiline
          style={{
            marginTop: 6,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "#1b1b1b",
            color: "#fff",
            minHeight: 90,
            textAlignVertical: "top",
          }}
        />

        {!!error && (
          <Text style={{ color: "#fca5a5", marginTop: 10 }}>{error}</Text>
        )}

        <Pressable
          onPress={onSave}
          disabled={!canSave || saving}
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            backgroundColor: canSave ? "#22c55e" : "#333",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#111", textAlign: "center", fontWeight: "700" }}>
            {saving ? "Saving…" : "Save plan"}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}