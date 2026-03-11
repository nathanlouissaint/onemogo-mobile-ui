// src/lib/workouts.ts
import { getPlanById, markPlanCompletedByDate } from "./plans";
import { supabase } from "./supabase";

export type WorkoutSession = {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: string; // NOT NULL in DB
  plan_id: string | null;
  template_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  created_at: string;
};

export type WorkoutSessionItem = {
  id: string;
  session_id: string;
  exercise_id: string;
  sort_order: number;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_rpe: number | null;
  prescribed_weight_kg: number | null;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
};

export type WorkoutSessionSet = {
  id: string;
  session_id: string;
  session_item_id: string;
  set_index: number;
  set_type: string;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  rpe: number | null;
  completed_at: string;
  notes: string | null;
  created_at: string;
};

export type WorkoutSessionDetailItem = WorkoutSessionItem & {
  exercise_name: string;
  sets: WorkoutSessionSet[];
};

export type WorkoutSessionDetail = {
  session: WorkoutSession;
  items: WorkoutSessionDetailItem[];
};

type WorkoutSessionItemRow = WorkoutSessionItem & {
  exercises?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type ExerciseJoinValue =
  | { name?: string | null }
  | Array<{ name?: string | null }>
  | null
  | undefined;

const WORKOUT_SESSION_SELECT =
  "id,user_id,title,activity_type,plan_id,template_id,started_at,ended_at,duration_min,created_at";

const WORKOUT_SESSION_ITEM_SELECT = `
  id,
  session_id,
  exercise_id,
  sort_order,
  prescribed_sets,
  prescribed_reps,
  prescribed_rpe,
  prescribed_weight_kg,
  notes,
  is_completed,
  created_at,
  exercises (
    name
  )
`;

const WORKOUT_SESSION_SET_SELECT = `
  id,
  session_id,
  session_item_id,
  set_index,
  set_type,
  reps,
  weight_kg,
  duration_sec,
  distance_m,
  rpe,
  completed_at,
  notes,
  created_at
`;

function normalizeActivityType(v?: string | null) {
  const s = (v ?? "").toLowerCase().trim();

  // Hard default to prevent NOT NULL constraint failure
  if (!s) return "strength";

  // Normalize UI aliases
  if (s === "lifting") return "strength";
  if (s === "run" || s === "running") return "cardio";

  return s;
}

function requireId(id: string, label: string) {
  const v = (id ?? "").toString().trim();
  if (!v) throw new Error(`Missing ${label}.`);
  return v;
}

function getExerciseNameFromJoin(value: ExerciseJoinValue) {
  if (!value) return "Unknown Exercise";

  if (Array.isArray(value)) {
    const first = value[0];
    const name = first?.name?.toString().trim();
    return name || "Unknown Exercise";
  }

  const name = value.name?.toString().trim();
  return name || "Unknown Exercise";
}

export async function listWorkoutSessions(userId: string) {
  const uid = requireId(userId, "userId");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as WorkoutSession[];
}

export async function getActiveWorkoutSession(userId: string) {
  const uid = requireId(userId, "userId");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("user_id", uid)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  return (data?.[0] ?? null) as WorkoutSession | null;
}

export async function getWorkoutSessionById(sessionId: string) {
  const id = requireId(sessionId, "sessionId");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(WORKOUT_SESSION_SELECT)
    .eq("id", id)
    .single();

  if (error) throw error;

  return data as WorkoutSession;
}

export async function getWorkoutSessionDetail(
  sessionId: string
): Promise<WorkoutSessionDetail> {
  const id = requireId(sessionId, "sessionId");

  const session = await getWorkoutSessionById(id);

  const { data: itemRows, error: itemErr } = await supabase
    .from("workout_session_items")
    .select(WORKOUT_SESSION_ITEM_SELECT)
    .eq("session_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemErr) throw itemErr;

  const itemsRaw = (itemRows ?? []) as WorkoutSessionItemRow[];
  const itemIds = itemsRaw.map((item) => item.id);

  let setsRaw: WorkoutSessionSet[] = [];

  if (itemIds.length > 0) {
    const { data: setRows, error: setErr } = await supabase
      .from("workout_session_sets")
      .select(WORKOUT_SESSION_SET_SELECT)
      .eq("session_id", id)
      .in("session_item_id", itemIds)
      .order("session_item_id", { ascending: true })
      .order("set_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (setErr) throw setErr;

    setsRaw = (setRows ?? []) as WorkoutSessionSet[];
  }

  const setsByItemId = new Map<string, WorkoutSessionSet[]>();

  for (const set of setsRaw) {
    const existing = setsByItemId.get(set.session_item_id) ?? [];
    existing.push(set);
    setsByItemId.set(set.session_item_id, existing);
  }

  const items: WorkoutSessionDetailItem[] = itemsRaw.map((item) => {
    const { exercises, ...baseItem } = item;

    return {
      ...baseItem,
      exercise_name: getExerciseNameFromJoin(exercises),
      sets: setsByItemId.get(item.id) ?? [],
    };
  });

  return {
    session,
    items,
  };
}

export async function startWorkoutSession(args: {
  userId: string;
  title: string;
  activityType?: string | null;
  planId?: string | null;
  templateId?: string | null;
}) {
  const userId = requireId(args.userId, "userId");

  const payload = {
    user_id: userId,
    title: args.title?.trim() || "Workout Session",
    activity_type: normalizeActivityType(args.activityType), // NEVER NULL
    plan_id: args.planId ?? null,
    template_id: args.templateId ?? null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_min: null,
  };

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert(payload)
    .select(WORKOUT_SESSION_SELECT)
    .single();

  if (error) throw error;

  return data as WorkoutSession;
}

export async function completeWorkoutSession(args: { sessionId: string }) {
  const id = requireId(args.sessionId, "sessionId");

  // Read current session state first so duration and linked-plan sync are correct.
  const { data: existing, error: readErr } = await supabase
    .from("workout_sessions")
    .select("id,user_id,plan_id,started_at,ended_at")
    .eq("id", id)
    .single();

  if (readErr) throw readErr;

  // If already completed, return the current canonical row instead of mutating again.
  if (existing?.ended_at) {
    return getWorkoutSessionById(id);
  }

  const startedAt = existing?.started_at ? new Date(existing.started_at) : null;

  const durationMin =
    startedAt && !Number.isNaN(startedAt.getTime())
      ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000))
      : null;

  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_min: durationMin,
    })
    .eq("id", id)
    .select(WORKOUT_SESSION_SELECT)
    .single();

  if (error) throw error;

  const completed = data as WorkoutSession;

  // Keep planned-workout adherence in sync when a session was started from a plan.
  if (completed.plan_id) {
    try {
      const linkedPlan = await getPlanById(completed.plan_id);
      await markPlanCompletedByDate(linkedPlan.user_id, linkedPlan.plan_date);
    } catch (planSyncErr) {
      console.warn("completeWorkoutSession plan sync warning:", planSyncErr);
    }
  }

  return completed;
}

export {
  WORKOUT_SESSION_SELECT,
  WORKOUT_SESSION_ITEM_SELECT,
  WORKOUT_SESSION_SET_SELECT,
};