// src/lib/workouts.ts
import { supabase } from "./supabase";
import { getPlanById } from "./plans";
import { listTemplateItems } from "./templates";

export type WorkoutSession = {
  id: string;
  user_id: string;

  title: string | null;
  activity_type: string;

  started_at: string;
  ended_at: string | null;
  duration_min: number | null;

  // links an executed session back to a planned workout
  plan_id: string | null;

  created_at: string;
  updated_at: string;
};

export type WorkoutSessionItem = {
  id: string;
  session_id: string;
  template_item_id: string | null;

  exercise_id: string;
  sort_order: number;

  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_rpe: number | null;

  notes: string | null;
  created_at: string;
};

function supabaseErrorToError(e: any, fallback: string) {
  const msg =
    e?.message ||
    e?.error_description ||
    e?.details ||
    e?.hint ||
    (typeof e === "string" ? e : null) ||
    fallback;

  const code = e?.code ? ` (${e.code})` : "";
  const out = new Error(String(msg) + code);
  (out as any).raw = e;
  return out;
}

const SESSION_SELECT =
  "id,user_id,title,activity_type,started_at,ended_at,duration_min,plan_id,created_at,updated_at";

const SESSION_ITEM_SELECT =
  "id,session_id,template_item_id,exercise_id,sort_order,prescribed_sets,prescribed_reps,prescribed_rpe,notes,created_at";

/**
 * List sessions for a user (newest first)
 */
export async function listWorkoutSessions(
  userId: string
): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.log(
      "listWorkoutSessions supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to load workout sessions");
  }

  return (data ?? []) as WorkoutSession[];
}

/**
 * Start a new session (ended_at null)
 */
export async function startWorkoutSession(params: {
  userId: string;
  title?: string | null;
  activityType?: string | null;
  startedAt?: string; // ISO string
  planId?: string | null; // start from a plan
}): Promise<WorkoutSession> {
  const payload: any = {
    user_id: params.userId,
    title: params.title ?? "Workout",
    activity_type: params.activityType ?? "strength",
    plan_id: params.planId ?? null,
  };
  if (params.startedAt) payload.started_at = params.startedAt;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert(payload)
    .select(SESSION_SELECT)
    .single();

  if (error) {
    console.log(
      "startWorkoutSession supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to start workout session");
  }

  return data as WorkoutSession;
}

/**
 * Get a single session by id
 */
export async function getWorkoutSessionById(
  sessionId: string
): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .single();

  if (error) {
    console.log(
      "getWorkoutSessionById supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to load workout session");
  }

  return data as WorkoutSession;
}

/**
 * Preferred alias for screens that import getWorkoutSession
 */
export const getWorkoutSession = getWorkoutSessionById;

/**
 * Complete a session:
 * - sets ended_at
 * - computes duration_min server-side
 *
 * Supports BOTH call styles:
 *   completeWorkoutSession("uuid")
 *   completeWorkoutSession({ sessionId: "uuid", endedAt?: "iso" })
 */
export async function completeWorkoutSession(
  sessionIdOrParams:
    | string
    | {
        sessionId: string;
        endedAt?: string; // ISO string
      }
): Promise<WorkoutSession> {
  const sessionId =
    typeof sessionIdOrParams === "string"
      ? sessionIdOrParams
      : sessionIdOrParams.sessionId;

  const endedAt =
    typeof sessionIdOrParams === "string"
      ? new Date().toISOString()
      : sessionIdOrParams.endedAt ?? new Date().toISOString();

  const { data, error } = await supabase.rpc("complete_workout_session", {
    p_id: sessionId,
    p_ended_at: endedAt,
  });

  if (error) {
    console.log(
      "completeWorkoutSession supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to complete workout session");
  }

  // Some RPCs return an array; normalize to single row
  const row = Array.isArray(data) ? data[0] : data;
  return row as WorkoutSession;
}

/**
 * Active session = most recent session with ended_at null
 */
export async function getActiveWorkoutSession(
  userId: string
): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.log(
      "getActiveWorkoutSession supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to load active workout session");
  }

  return (data?.[0] ?? null) as WorkoutSession | null;
}

/**
 * List session items (the actual workout content for the session)
 */
export async function listWorkoutSessionItems(
  sessionId: string
): Promise<WorkoutSessionItem[]> {
  const { data, error } = await supabase
    .from("workout_session_items")
    .select(SESSION_ITEM_SELECT)
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.log(
      "listWorkoutSessionItems supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to load workout session items");
  }

  return (data ?? []) as WorkoutSessionItem[];
}

/**
 * Seed session items from the plan's template.
 *
 * Hard requirements:
 * - planned_workouts.template_id must exist
 * - workout_template_items must exist for that template
 * - workout_session_items table must exist
 * - UNIQUE(session_id, template_item_id) must exist for idempotency
 */
export async function seedWorkoutSessionFromPlan(params: {
  sessionId: string;
  planId: string;
}): Promise<void> {
  // 1) Load plan and find template_id
  const plan = await getPlanById(params.planId);
  const templateId = plan?.template_id ? String(plan.template_id) : null;
  if (!templateId) return;

  // 2) Load template items
  const items = await listTemplateItems(templateId);
  if (!items.length) return;

  // 3) Upsert into workout_session_items (idempotent via unique index)
  const payload = items.map((it) => ({
    session_id: params.sessionId,
    template_item_id: it.id,
    exercise_id: it.exercise_id,
    sort_order: typeof it.sort_order === "number" ? it.sort_order : 0,
    prescribed_sets: it.prescribed_sets ?? null,
    prescribed_reps: it.prescribed_reps ?? null,
    prescribed_rpe: it.prescribed_rpe ?? null,
    notes: it.notes ?? null,
  }));

  const { error } = await supabase
    .from("workout_session_items")
    .upsert(payload, { onConflict: "session_id,template_item_id" });

  if (error) {
    console.log(
      "seedWorkoutSessionFromPlan supabase error:",
      JSON.stringify(error, null, 2)
    );
    throw supabaseErrorToError(error, "Failed to seed workout from plan");
  }
}

/**
 * Temporary compatibility exports (optional).
 * Remove after you update all imports.
 */
export const getWorkouts = listWorkoutSessions;
export const startWorkout = startWorkoutSession;
export const stopWorkout = completeWorkoutSession;
export const getActiveWorkout = getActiveWorkoutSession;