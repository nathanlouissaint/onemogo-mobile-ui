// src/lib/workouts.ts
import { supabase } from "./supabase";

export type WorkoutSession = {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: string | null;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function supabaseErrorToError(e: any, fallback: string) {
  // Supabase/PostgREST typically: { message, details, hint, code }
  const msg =
    e?.message ||
    e?.error_description ||
    e?.details ||
    e?.hint ||
    (typeof e === "string" ? e : null) ||
    fallback;

  const code = e?.code ? ` (${e.code})` : "";
  const out = new Error(String(msg) + code);

  // keep raw info for debugging
  (out as any).raw = e;
  return out;
}

const WORKOUT_SELECT =
  "id,user_id,title,activity_type,started_at,ended_at,duration_min,notes,created_at,updated_at";

export async function getWorkouts(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("getWorkouts supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to load workouts");
  }

  return (data ?? []) as WorkoutSession[];
}

export async function startWorkout(params: {
  userId: string;
  title?: string | null;
  activityType?: string | null;
  notes?: string | null;
  startedAt?: string;
}): Promise<WorkoutSession> {
  const payload: any = {
    user_id: params.userId,
    title: params.title ?? "Workout",
    activity_type: params.activityType ?? "workout",
    notes: params.notes ?? null,
  };
  if (params.startedAt) payload.started_at = params.startedAt;

  const { data, error } = await supabase
    .from("workouts")
    .insert(payload)
    .select(WORKOUT_SELECT)
    .single();

  if (error) {
    console.log("startWorkout supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to start workout");
  }

  return data as WorkoutSession;
}

export async function stopWorkout(params: {
  userId: string;
  workoutId: string;
  endedAt?: string;
}): Promise<WorkoutSession> {
  const endedAt = params.endedAt ?? new Date().toISOString();

  const { data, error } = await supabase
    .from("workouts")
    .update({ ended_at: endedAt })
    .eq("id", params.workoutId)
    .eq("user_id", params.userId)
    .is("ended_at", null)
    .select(WORKOUT_SELECT)
    .single();

  if (error) {
    console.log("stopWorkout supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to stop workout");
  }

  return data as WorkoutSession;
}

export async function getActiveWorkout(userId: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_SELECT)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.log("getActiveWorkout supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to load active workout");
  }

  return (data?.[0] ?? null) as WorkoutSession | null;
}