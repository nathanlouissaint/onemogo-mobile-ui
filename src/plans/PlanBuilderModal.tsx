// src/plans/PlanBuilderModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  Platform,
  StyleSheet,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSession } from "../session/SessionContext";
import { PlannedWorkout, toTimeString, upsertPlan } from "../lib/plans";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string; // YYYY-MM-DD (local)
  existing: PlannedWorkout | null;
  onSaved: (p: PlannedWorkout) => void;
};

function getErrMsg(e: unknown, fallback: string) {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const anyErr = e as any;
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error_description === "string")
      return anyErr.error_description;
    if (typeof anyErr.details === "string") return anyErr.details;
    if (typeof anyErr.hint === "string") return anyErr.hint;
  }
  return fallback;
}

function makeInitialTime(existingTime?: string | null) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);

  if (existingTime) {
    const [h, m] = existingTime.split(":");
    d.setHours(Number(h), Number(m), 0, 0);
  }
  return d;
}

function onlyDigitsOrEmpty(s: string) {
  return s === "" || /^[0-9]+$/.test(s);
}

export function PlanBuilderModal({
  visible,
  onClose,
  planDate,
  existing,
  onSaved,
}: Props) {
  const { user } = useSession();
  const userId = user?.id;

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [timeEnabled, setTimeEnabled] = useState(false);
  const [time, setTime] = useState<Date>(() => makeInitialTime(null));

  // NEW: Phase 1 inputs
  const [durationMin, setDurationMin] = useState<string>(""); // store as string for input UX
  const [rpe, setRpe] = useState<string>(""); // store as string for input UX

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rehydrate local state when opening / switching day
  useEffect(() => {
    if (!visible) return;

    setTitle(existing?.title ?? "");
    setNotes(existing?.notes ?? "");

    setTimeEnabled(!!existing?.scheduled_time);
    setTime(makeInitialTime(existing?.scheduled_time ?? null));

    setDurationMin(
      typeof existing?.planned_duration_min === "number"
        ? String(existing.planned_duration_min)
        : ""
    );
    setRpe(typeof existing?.planned_rpe === "number" ? String(existing.planned_rpe) : "");

    setError(null);
    setSaving(false);
  }, [
    visible,
    planDate,
    existing?.id,
    existing?.updated_at,
    existing?.scheduled_time,
    existing?.title,
    existing?.notes,
    existing?.planned_duration_min,
    existing?.planned_rpe,
  ]);

  const parsedDuration = useMemo(() => {
    if (durationMin.trim() === "") return null;
    const n = Number(durationMin);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n);
  }, [durationMin]);

  const parsedRpe = useMemo(() => {
    if (rpe.trim() === "") return null;
    const n = Number(rpe);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n);
  }, [rpe]);

  const canSave = useMemo(() => {
    const t = title.trim();
    if (t.length === 0 || t.length > 60) return false;
    if (notes.length > 1000) return false;

    // duration: empty ok; otherwise >=0 integer
    if (parsedDuration !== null) {
      if (!Number.isFinite(parsedDuration)) return false;
      if (parsedDuration < 0) return false;
    }

    // rpe: empty ok; otherwise 1..10 integer
    if (parsedRpe !== null) {
      if (!Number.isFinite(parsedRpe)) return false;
      if (parsedRpe < 1 || parsedRpe > 10) return false;
    }

    return true;
  }, [title, notes, parsedDuration, parsedRpe]);

  const onSave = async () => {
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

    if (parsedDuration !== null) {
      if (!Number.isFinite(parsedDuration)) {
        setError("Planned duration must be a number.");
        return;
      }
      if (parsedDuration < 0) {
        setError("Planned duration must be 0 or more.");
        return;
      }
    }

    if (parsedRpe !== null) {
      if (!Number.isFinite(parsedRpe)) {
        setError("Planned RPE must be a number.");
        return;
      }
      if (parsedRpe < 1 || parsedRpe > 10) {
        setError("Planned RPE must be between 1 and 10.");
        return;
      }
    }

    setSaving(true);
    try {
      const planned = await upsertPlan({
        userId,
        planDate, // MUST remain YYYY-MM-DD local key
        title: t,
        notes: notes.trim() ? notes.trim() : null,
        scheduledTime: timeEnabled ? toTimeString(time) : null,
        templateId: null,

        // NEW: only pass when user provided value
        plannedDurationMin: parsedDuration === null ? undefined : parsedDuration,
        plannedRpe: parsedRpe === null ? undefined : parsedRpe,
      });

      onSaved(planned);
      onClose();
    } catch (e: unknown) {
      setError(getErrMsg(e, "Failed to save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>
              {existing ? "Edit plan" : "Plan workout"} • {planDate}
            </Text>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Workout title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Push day, Legs, Lifting session"
            placeholderTextColor="#666"
            style={styles.input}
          />

          {/* NEW: Duration + RPE */}
          <View style={styles.inlineRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Planned duration (min)</Text>
              <TextInput
                value={durationMin}
                onChangeText={(v) => {
                  if (!onlyDigitsOrEmpty(v)) return;
                  setDurationMin(v);
                }}
                placeholder="e.g., 45"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={{ width: 12 }} />

            <View style={{ width: 110 }}>
              <Text style={styles.label}>Planned RPE</Text>
              <TextInput
                value={rpe}
                onChangeText={(v) => {
                  if (!onlyDigitsOrEmpty(v)) return;
                  setRpe(v);
                }}
                placeholder="1–10"
                placeholderTextColor="#666"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.timeRow}>
            <Pressable
              onPress={() => setTimeEnabled((v) => !v)}
              style={[
                styles.timeToggle,
                { backgroundColor: timeEnabled ? "#2563eb" : "#333" },
              ]}
            >
              <Text style={styles.timeToggleText}>
                {timeEnabled ? "Time set" : "Add time"}
              </Text>
            </Pressable>

            {timeEnabled && (
              <View style={{ marginLeft: 12 }}>
                {Platform.OS !== "web" ? (
                  <DateTimePicker
                    value={time}
                    mode="time"
                    display="default"
                    onChange={(_, date) => {
                      if (date) setTime(date);
                    }}
                  />
                ) : (
                  <Text style={{ color: "#bbb" }}>
                    Time picker not supported on web in this MVP.
                  </Text>
                )}
              </View>
            )}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Targets, cues, gym, equipment, anything you want to remember."
            placeholderTextColor="#666"
            multiline
            style={styles.notes}
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            onPress={onSave}
            disabled={!canSave || saving}
            style={[
              styles.saveBtn,
              { backgroundColor: canSave ? "#22c55e" : "#333" },
              saving && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                { color: canSave ? "#111" : "#fff" },
              ]}
            >
              {saving ? "Saving…" : "Save plan"}
            </Text>
          </Pressable>
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

  label: { color: "#aaa", marginTop: 12 },

  input: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1b1b1b",
    color: "#fff",
  },

  inlineRow: { flexDirection: "row", alignItems: "flex-start" },

  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  timeToggle: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  timeToggleText: { color: "#fff", fontWeight: "700" },

  notes: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1b1b1b",
    color: "#fff",
    minHeight: 90,
    textAlignVertical: "top",
  },

  errorText: { color: "#fca5a5", marginTop: 10, fontWeight: "700" },

  saveBtn: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
  },
  saveBtnText: { textAlign: "center", fontWeight: "800" },
});