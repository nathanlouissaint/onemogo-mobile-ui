// src/lib/workouts.ts
import { supabase } from "./supabase";

export type WorkoutSession = {
  id: string;
  user_id: string;

  title: string | null;
  activity_type: string;

  started_at: string;
  ended_at: string | null;
  duration_min: number | null;

  created_at: string;
  updated_at: string;
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
  "id,user_id,title,activity_type,started_at,ended_at,duration_min,created_at,updated_at";

/**
 * List sessions for a user (newest first)
 */
export async function listWorkoutSessions(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("listWorkoutSessions supabase error:", JSON.stringify(error, null, 2));
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
}): Promise<WorkoutSession> {
  const payload: any = {
    user_id: params.userId,
    title: params.title ?? "Workout",
    activity_type: params.activityType ?? "strength",
  };
  if (params.startedAt) payload.started_at = params.startedAt;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert(payload)
    .select(SESSION_SELECT)
    .single();

  if (error) {
    console.log("startWorkoutSession supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to start workout session");
  }

  return data as WorkoutSession;
}

/**
 * Get a single session by id
 */
export async function getWorkoutSessionById(sessionId: string): Promise<WorkoutSession> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .single();

  if (error) {
    console.log("getWorkoutSessionById supabase error:", JSON.stringify(error, null, 2));
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
    console.log("completeWorkoutSession supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to complete workout session");
  }

  // Some RPCs return an array; normalize to single row
  const row = Array.isArray(data) ? data[0] : data;
  return row as WorkoutSession;
}

/**
 * Active session = most recent session with ended_at null
 */
export async function getActiveWorkoutSession(userId: string): Promise<WorkoutSession | null> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_SELECT)
    .eq("user_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    console.log("getActiveWorkoutSession supabase error:", JSON.stringify(error, null, 2));
    throw supabaseErrorToError(error, "Failed to load active workout session");
  }

  return (data?.[0] ?? null) as WorkoutSession | null;
}

/**
 * Temporary compatibility exports (optional).
 * Remove after you update all imports.
 */
export const getWorkouts = listWorkoutSessions;
export const startWorkout = startWorkoutSession;
export const stopWorkout = completeWorkoutSession;
export const getActiveWorkout = getActiveWorkoutSession;