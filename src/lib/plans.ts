// src/lib/plans.ts
import { supabase } from "./supabase";

export type PlannedWorkout = {
  id: string;
  user_id: string;
  plan_date: string; // YYYY-MM-DD
  template_id: string | null;
  title: string | null;
  scheduled_time: string | null; // "HH:MM:SS" (Supabase time)
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertPlanInput = {
  userId: string;
  planDate: string; // YYYY-MM-DD
  templateId?: string | null;
  title?: string | null;
  scheduledTime?: string | null; // "HH:MM:SS" or null
  notes?: string | null;
};

// ---------- helpers ----------
export function toISODate(d: Date): string {
  // Local date -> YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeString(d: Date): string {
  // Date -> "HH:MM:SS" local
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

// ---------- queries ----------
export async function getPlanForDate(userId: string, planDate: string) {
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_date", planDate)
    .maybeSingle();

  if (error) throw error;
  return data as PlannedWorkout | null;
}

export async function upsertPlan(input: UpsertPlanInput) {
  const payload = {
    user_id: input.userId,
    plan_date: input.planDate,
    template_id: input.templateId ?? null,
    title: input.title ?? null,
    scheduled_time: input.scheduledTime ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("planned_workouts")
    .upsert(payload, {
      onConflict: "user_id,plan_date",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as PlannedWorkout;
}

export async function deletePlanByDate(userId: string, planDate: string) {
  const { error } = await supabase
    .from("planned_workouts")
    .delete()
    .eq("user_id", userId)
    .eq("plan_date", planDate);

  if (error) throw error;
}

export async function listPlansForRange(
  userId: string,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
) {
  const { data, error } = await supabase
    .from("planned_workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlannedWorkout[];
}