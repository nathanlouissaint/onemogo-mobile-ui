// src/plans/PlanBuilderModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { PrimaryButton } from "../components/PrimaryButton";
import { theme } from "../constants/theme";
import { type PlannedWorkout, toTimeString, upsertPlan } from "../lib/plans";
import { useSession } from "../session/SessionContext";

type Props = {
  visible: boolean;
  onClose: () => void;
  planDate: string;
  existing: PlannedWorkout | null;
  onSaved: (p: PlannedWorkout) => void;
};

const ACTIVITY_OPTIONS = [
  { label: "Strength", value: "strength" },
  { label: "Cardio", value: "cardio" },
  { label: "Mobility", value: "mobility" },
  { label: "Recovery", value: "recovery" },
] as const;

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

function normalizeActivityType(v?: string | null) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return "strength";
  if (s === "lifting") return "strength";
  if (s === "run" || s === "running") return "cardio";
  return s;
}

const ui = {
  radiusPill: 999,
  sheetMinHeight: 420,
  chipPadX: 12,
  chipPadY: 10,
};

const palette = {
  overlay: "rgba(0,0,0,0.45)",
  accentSoft: "rgba(10,132,255,0.12)",
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

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [activityType, setActivityType] = useState<string>("strength");

  const [timeEnabled, setTimeEnabled] = useState(false);
  const [time, setTime] = useState<Date>(() => makeInitialTime(null));

  const [durationMin, setDurationMin] = useState<string>("");
  const [rpe, setRpe] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setTitle(existing?.title ?? "");
    setNotes(existing?.notes ?? "");
    setActivityType(normalizeActivityType(existing?.activity_type));

    setTimeEnabled(!!existing?.scheduled_time);
    setTime(makeInitialTime(existing?.scheduled_time ?? null));

    setDurationMin(
      typeof existing?.planned_duration_min === "number"
        ? String(existing.planned_duration_min)
        : ""
    );

    setRpe(
      typeof existing?.planned_rpe === "number"
        ? String(existing.planned_rpe)
        : ""
    );

    setError(null);
    setSaving(false);
  }, [
    visible,
    planDate,
    existing?.id,
    existing?.updated_at,
    existing?.title,
    existing?.notes,
    existing?.activity_type,
    existing?.scheduled_time,
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

    if (!ACTIVITY_OPTIONS.some((option) => option.value === activityType)) {
      return false;
    }

    if (parsedDuration !== null) {
      if (!Number.isFinite(parsedDuration)) return false;
      if (parsedDuration < 0) return false;
    }

    if (parsedRpe !== null) {
      if (!Number.isFinite(parsedRpe)) return false;
      if (parsedRpe < 1 || parsedRpe > 10) return false;
    }

    return true;
  }, [title, notes, activityType, parsedDuration, parsedRpe]);

  const onSave = async () => {
    if (!userId) {
      setError("No user session found. Please log in again.");
      return;
    }

    setError(null);

    const t = title.trim();
    const trimmedNotes = notes.trim();
    const normalizedActivity = normalizeActivityType(activityType);

    if (t.length === 0) {
      setError("Title is required.");
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

    if (!ACTIVITY_OPTIONS.some((option) => option.value === normalizedActivity)) {
      setError("Select a valid activity type.");
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
        planDate,
        title: t,
        notes: trimmedNotes ? trimmedNotes : null,
        scheduledTime: timeEnabled ? toTimeString(time) : null,
        templateId: existing?.template_id ?? null,
        activityType: normalizedActivity,
        plannedDurationMin: parsedDuration === null ? undefined : parsedDuration,
        plannedRpe: parsedRpe === null ? undefined : parsedRpe,
      });

      onSaved(planned);
      onClose();
    } catch (e: unknown) {
      setError(getErrMsg(e, "Failed to save plan."));
    } finally {
      setSaving(false);
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
              <Text style={styles.headerEyebrow}>
                {existing ? "Edit plan" : "Plan workout"}
              </Text>
              <Text style={styles.headerTitle}>{planDate}</Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Workout title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Push Day, Legs, Easy Run"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            maxLength={60}
          />

          <Text style={styles.label}>Activity type</Text>
          <View style={styles.optionRow}>
            {ACTIVITY_OPTIONS.map((option) => {
              const active = activityType === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setActivityType(option.value)}
                  style={({ pressed }) => [
                    styles.optionPill,
                    active && styles.optionPillActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionPillText,
                      active && styles.optionPillTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inlineRow}>
            <View style={styles.flexOne}>
              <Text style={styles.label}>Planned duration (min)</Text>
              <TextInput
                value={durationMin}
                onChangeText={(v) => {
                  if (!onlyDigitsOrEmpty(v)) return;
                  setDurationMin(v);
                }}
                placeholder="e.g. 45"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.inlineSpacer} />

            <View style={styles.rpeCol}>
              <Text style={styles.label}>Planned RPE</Text>
              <TextInput
                value={rpe}
                onChangeText={(v) => {
                  if (!onlyDigitsOrEmpty(v)) return;
                  setRpe(v);
                }}
                placeholder="1–10"
                placeholderTextColor={theme.colors.textMuted}
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
                timeEnabled && styles.timeToggleActive,
              ]}
            >
              <Text style={styles.timeToggleText}>
                {timeEnabled ? "Time set" : "Add time"}
              </Text>
            </Pressable>

            {timeEnabled ? (
              <View style={styles.timePickerWrap}>
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
                  <Text style={styles.webTimeHint}>
                    Time picker not supported on web in this MVP.
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Targets, cues, equipment, gym, recovery notes."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            style={styles.notes}
            maxLength={1000}
          />

          {!!error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.saveTopSpace}>
            <PrimaryButton
              label={saving ? "Saving..." : "Save plan"}
              onPress={onSave}
              disabled={!canSave || saving}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  pressed: {
    opacity: 0.92,
  },

  flexOne: {
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

  label: {
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  input: {
    marginTop: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },

  optionPill: {
    paddingHorizontal: ui.chipPadX,
    paddingVertical: ui.chipPadY,
    borderRadius: ui.radiusPill,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  optionPillActive: {
    backgroundColor: palette.accentSoft,
    borderColor: theme.colors.accent,
  },

  optionPillText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  optionPillTextActive: {
    color: theme.colors.text,
  },

  inlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },

  inlineSpacer: {
    width: theme.spacing.sm,
  },

  rpeCol: {
    width: 110,
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.sm,
    flexWrap: "wrap",
  },

  timeToggle: {
    paddingVertical: ui.chipPadY,
    paddingHorizontal: ui.chipPadX,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  timeToggleActive: {
    backgroundColor: palette.accentSoft,
    borderColor: theme.colors.accent,
  },

  timeToggleText: {
    color: theme.colors.text,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  timePickerWrap: {
    marginLeft: theme.spacing.sm,
  },

  webTimeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.size.sm,
    fontWeight: "700",
  },

  notes: {
    marginTop: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface2,
    color: theme.colors.text,
    minHeight: 90,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: theme.font.size.md,
    fontWeight: "700",
  },

  errorText: {
    color: theme.colors.danger,
    marginTop: theme.spacing.sm,
    fontSize: theme.font.size.sm,
    fontWeight: "800",
  },

  saveTopSpace: {
    marginTop: theme.spacing.md,
  },
});