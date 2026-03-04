// src/lib/plans.ts
import { supabase } from "./supabase";

export type PlannedWorkoutStatus = "planned" | "completed" | "skipped";

export type PlannedWorkout = {
  id: string;
  user_id: string;

  plan_date: string; // YYYY-MM-DD (local day key)
  template_id: string | null;
  title: string | null;

  // NEW: required for Start-from-Plan
  activity_type: string;

  scheduled_time: string | null; // "HH:MM:SS" (Supabase time)
  notes: string | null;

  status: PlannedWorkoutStatus;
  planned_duration_min: number | null;
  planned_rpe: number | null;

  created_at: string;
  updated_at: string;
};

export type UpsertPlanInput = {
  userId: string;
  planDate: string; // YYYY-MM-DD (local)

  templateId?: string | null;
  title?: string | null;

  // NEW: optional on input, but stored NOT NULL in DB (default 'lifting')
  activityType?: string | null;

  scheduledTime?: string | null; // "HH:MM:SS" or null
  notes?: string | null;

  // Optional updates
  status?: PlannedWorkoutStatus;
  plannedDurationMin?: number | null;
  plannedRpe?: number | null;
};

// Keep selects explicit so schema changes don’t silently break UI assumptions
const PLAN_SELECT =
  "id,user_id,plan_date,template_id,title,activity_type,scheduled_time,notes,status,planned_duration_min,planned_rpe,created_at,updated_at";

// ---------- helpers ----------
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

function isISODate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function normalizePlanDate(planDate: string): string {
  const s = String(planDate ?? "").trim();

  if (isISODate(s)) return s;

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toISODate(parsed);
  }

  throw new Error(`Invalid planDate (expected YYYY-MM-DD): "${planDate}"`);
}

function normalizeRpe(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid plannedRpe: "${String(v)}"`);
  const i = Math.round(n);
  if (i < 1 || i > 10) throw new Error("plannedRpe must be between 1 and 10");
  return i;
}

function normalizeDurationMin(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n))
    throw new Error(`Invalid plannedDurationMin: "${String(v)}"`);
  const i = Math.round(n);
  if (i < 0) throw new Error("plannedDurationMin must be >= 0");
  return i;
}

function normalizeActivityType(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length ? s : "lifting";
}

function startOfMonthLocal(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonthLocal(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ---------- queries ----------
export async function getPlanForDate(userId: string, planDate: string) {
  const key = normalizePlanDate(planDate);

  const { data, error } = await supabase
    .from("planned_workouts")
    .select(PLAN_SELECT)
    .eq("user_id", userId)
    .eq("plan_date", key)
    .maybeSingle();

  if (error) throw error;
  return data as PlannedWorkout | null;
}

export async function getPlanById(planId: string) {
  const { data, error } = await supabase
    .from("planned_workouts")
    .select(PLAN_SELECT)
    .eq("id", planId)
    .single();

  if (error) throw error;
  return data as PlannedWorkout;
}

export async function upsertPlan(input: UpsertPlanInput) {
  const key = normalizePlanDate(input.planDate);

  // Only include optional fields if the caller provided them
  const payload: any = {
    user_id: input.userId,
    plan_date: key,
    template_id: input.templateId ?? null,
    title: input.title ?? null,
    scheduled_time: input.scheduledTime ?? null,
    notes: input.notes ?? null,
  };

  // activity_type:
  // - if provided, set it
  // - if not provided, do NOT overwrite existing row (important)
  if (input.activityType !== undefined) {
    payload.activity_type = normalizeActivityType(input.activityType);
  }

  if (input.status !== undefined) payload.status = input.status;

  if (input.plannedDurationMin !== undefined) {
    payload.planned_duration_min = normalizeDurationMin(input.plannedDurationMin);
  }

  if (input.plannedRpe !== undefined) {
    payload.planned_rpe = normalizeRpe(input.plannedRpe);
  }

  const { data, error } = await supabase
    .from("planned_workouts")
    .upsert(payload, { onConflict: "user_id,plan_date" })
    .select(PLAN_SELECT)
    .single();

  if (error) throw error;
  return data as PlannedWorkout;
}

export async function deletePlanByDate(userId: string, planDate: string) {
  const key = normalizePlanDate(planDate);

  const { error } = await supabase
    .from("planned_workouts")
    .delete()
    .eq("user_id", userId)
    .eq("plan_date", key);

  if (error) throw error;
}

/**
 * List plans in a date range.
 *
 * IMPORTANT: endDateExclusive is EXCLUSIVE (use .lt).
 * Example for month view:
 *   start = 2026-03-01
 *   endExclusive = 2026-04-01
 */
export async function listPlansForRange(
  userId: string,
  startDate: string,
  endDateExclusive: string
) {
  const startKey = normalizePlanDate(startDate);
  const endKey = normalizePlanDate(endDateExclusive);

  const { data, error } = await supabase
    .from("planned_workouts")
    .select(PLAN_SELECT)
    .eq("user_id", userId)
    .gte("plan_date", startKey)
    .lt("plan_date", endKey) // ✅ exclusive end
    .order("plan_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlannedWorkout[];
}

export async function listPlansForMonth(userId: string, monthCursor: Date) {
  // Exclusive end month range
  const start = toISODate(startOfMonthLocal(monthCursor));
  const endExclusive = toISODate(
    startOfMonthLocal(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))
  );
  return listPlansForRange(userId, start, endExclusive);
}

// ---------- status helpers ----------
export async function setPlanStatusByDate(params: {
  userId: string;
  planDate: string;
  status: PlannedWorkoutStatus;
}) {
  const key = normalizePlanDate(params.planDate);

  const { data, error } = await supabase
    .from("planned_workouts")
    .update({ status: params.status })
    .eq("user_id", params.userId)
    .eq("plan_date", key)
    .select(PLAN_SELECT)
    .maybeSingle();

  if (error) throw error;
  return data as PlannedWorkout | null;
}

export const markPlanCompletedByDate = (userId: string, planDate: string) =>
  setPlanStatusByDate({ userId, planDate, status: "completed" });

export const markPlanSkippedByDate = (userId: string, planDate: string) =>
  setPlanStatusByDate({ userId, planDate, status: "skipped" });

export const resetPlanToPlannedByDate = (userId: string, planDate: string) =>
  setPlanStatusByDate({ userId, planDate, status: "planned" });