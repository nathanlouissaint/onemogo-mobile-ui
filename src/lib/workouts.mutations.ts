import { supabase } from "./supabase";

type WorkoutTemplateRecord = {
  id: string;
  title: string | null;
  activity_type: string | null;
};

type WorkoutTemplateItemRecord = {
  id: string;
  exercise_id: string;
  sort_order: number | null;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_rpe: number | null;
  prescribed_weight_kg: number | null;
  notes: string | null;
};

type PlannedWorkoutRecord = {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: string | null;
  template_id: string | null;
};

type WorkoutSessionRecord = {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: string | null;
  plan_id?: string | null;
  template_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

type WorkoutSessionItemInsert = {
  session_id: string;
  exercise_id: string;
  sort_order: number;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_rpe: number | null;
  prescribed_weight_kg: number | null;
  notes: string | null;
  is_completed: boolean;
};

export type WorkoutSessionSetRecord = {
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

type WorkoutSessionItemRecord = {
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

type AddWorkoutSessionSetArgs = {
  sessionId: string;
  sessionItemId: string;
  setIndex?: number | null;
  setType?: string | null;
  reps?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
  notes?: string | null;
};

type UpdateWorkoutSessionSetArgs = {
  setId: string;
  setType?: string | null;
  reps?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
  notes?: string | null;
};

function requireId(value: string, label: string) {
  const v = (value ?? "").toString().trim();
  if (!v) throw new Error(`Missing ${label}.`);
  return v;
}

function normalizeOptionalText(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeWholeNumber(
  value: number | null | undefined,
  label: string
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return Math.trunc(value);
}

function normalizeNonNegativeWholeNumber(
  value: number | null | undefined,
  label: string
): number | null {
  const normalized = normalizeWholeNumber(value, label);
  if (normalized === null) return null;
  if (normalized < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return normalized;
}

function normalizePositiveWholeNumber(
  value: number | null | undefined,
  label: string
): number {
  const normalized = normalizeWholeNumber(value, label);
  if (normalized === null || normalized <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return normalized;
}

function normalizeOptionalDecimal(
  value: number | null | undefined,
  label: string
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return value;
}

function normalizeNonNegativeDecimal(
  value: number | null | undefined,
  label: string
): number | null {
  const normalized = normalizeOptionalDecimal(value, label);
  if (normalized === null) return null;
  if (normalized < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
  return normalized;
}

function normalizeSetType(value?: string | null) {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  return normalized || "work";
}

function normalizeRpe(value: number | null | undefined) {
  const normalized = normalizeWholeNumber(value, "rpe");
  if (normalized === null) return null;
  if (normalized < 1 || normalized > 10) {
    throw new Error("rpe must be between 1 and 10.");
  }
  return normalized;
}

function assertSetHasMeaningfulValue(args: {
  reps?: number | null;
  weightKg?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  rpe?: number | null;
}) {
  const hasAnyValue =
    args.reps !== null &&
    args.reps !== undefined
      ? true
      : args.weightKg !== null && args.weightKg !== undefined
      ? true
      : args.durationSec !== null && args.durationSec !== undefined
      ? true
      : args.distanceM !== null && args.distanceM !== undefined
      ? true
      : args.rpe !== null && args.rpe !== undefined;

  if (!hasAnyValue) {
    throw new Error(
      "Enter at least one set value. Reps, weight, duration, distance, or RPE cannot all be blank."
    );
  }
}

async function getWorkoutSessionById(sessionId: string) {
  const id = requireId(sessionId, "sessionId");

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
      id,
      user_id,
      title,
      activity_type,
      plan_id,
      template_id,
      started_at,
      ended_at
    `
    )
    .eq("id", id)
    .single<WorkoutSessionRecord>();

  if (error) throw error;
  if (!data) throw new Error("Workout session not found.");

  return data;
}

async function assertSessionIsOpen(sessionId: string) {
  const session = await getWorkoutSessionById(sessionId);

  if (session.ended_at) {
    throw new Error("This workout session has already been completed.");
  }

  return session;
}

async function getWorkoutSessionItemById(sessionItemId: string) {
  const id = requireId(sessionItemId, "sessionItemId");

  const { data, error } = await supabase
    .from("workout_session_items")
    .select(
      `
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
      created_at
    `
    )
    .eq("id", id)
    .single<WorkoutSessionItemRecord>();

  if (error) throw error;
  if (!data) throw new Error("Workout session item not found.");

  return data;
}

async function assertSessionItemBelongsToSession(
  sessionItemId: string,
  sessionId: string
) {
  const item = await getWorkoutSessionItemById(sessionItemId);

  if (item.session_id !== sessionId) {
    throw new Error("Workout session item does not belong to this session.");
  }

  return item;
}

async function getWorkoutSessionSetById(setId: string) {
  const id = requireId(setId, "setId");

  const { data, error } = await supabase
    .from("workout_session_sets")
    .select(
      `
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
    `
    )
    .eq("id", id)
    .single<WorkoutSessionSetRecord>();

  if (error) throw error;
  if (!data) throw new Error("Workout session set not found.");

  return data;
}

async function listWorkoutSessionSetsForItem(sessionItemId: string) {
  const itemId = requireId(sessionItemId, "sessionItemId");

  const { data, error } = await supabase
    .from("workout_session_sets")
    .select(
      `
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
    `
    )
    .eq("session_item_id", itemId)
    .order("set_index", { ascending: true })
    .order("created_at", { ascending: true })
    .returns<WorkoutSessionSetRecord[]>();

  if (error) throw error;

  return data ?? [];
}

async function getNextSetIndexForItem(sessionItemId: string) {
  const sets = await listWorkoutSessionSetsForItem(sessionItemId);
  if (!sets.length) return 1;

  const maxIndex = sets.reduce(
    (max, set) => Math.max(max, set.set_index ?? 0),
    0
  );

  return maxIndex + 1;
}

async function reindexWorkoutSessionSets(sessionItemId: string) {
  const sets = await listWorkoutSessionSetsForItem(sessionItemId);

  for (let i = 0; i < sets.length; i += 1) {
    const expectedIndex = i + 1;
    const set = sets[i];

    if (set.set_index === expectedIndex) continue;

    const { error } = await supabase
      .from("workout_session_sets")
      .update({ set_index: expectedIndex })
      .eq("id", set.id);

    if (error) throw error;
  }

  return true;
}

export async function syncWorkoutSessionItemCompletion(sessionItemId: string) {
  const itemId = requireId(sessionItemId, "sessionItemId");

  const sessionItem = await getWorkoutSessionItemById(itemId);

  const { count, error: countError } = await supabase
    .from("workout_session_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_item_id", itemId);

  if (countError) throw countError;

  const shouldBeCompleted = (count ?? 0) > 0;

  if (sessionItem.is_completed === shouldBeCompleted) {
    return {
      sessionItemId: itemId,
      is_completed: shouldBeCompleted,
      set_count: count ?? 0,
    };
  }

  const { error: updateError } = await supabase
    .from("workout_session_items")
    .update({ is_completed: shouldBeCompleted })
    .eq("id", itemId);

  if (updateError) throw updateError;

  return {
    sessionItemId: itemId,
    is_completed: shouldBeCompleted,
    set_count: count ?? 0,
  };
}

export async function addWorkoutSessionSet(args: AddWorkoutSessionSetArgs) {
  const sessionId = requireId(args.sessionId, "sessionId");
  const sessionItemId = requireId(args.sessionItemId, "sessionItemId");

  await assertSessionIsOpen(sessionId);
  await assertSessionItemBelongsToSession(sessionItemId, sessionId);

  const normalizedReps = normalizeNonNegativeWholeNumber(args.reps, "reps");
  const normalizedWeightKg = normalizeNonNegativeDecimal(
    args.weightKg,
    "weightKg"
  );
  const normalizedDurationSec = normalizeNonNegativeWholeNumber(
    args.durationSec,
    "durationSec"
  );
  const normalizedDistanceM = normalizeNonNegativeDecimal(
    args.distanceM,
    "distanceM"
  );
  const normalizedRpe = normalizeRpe(args.rpe);

  assertSetHasMeaningfulValue({
    reps: normalizedReps,
    weightKg: normalizedWeightKg,
    durationSec: normalizedDurationSec,
    distanceM: normalizedDistanceM,
    rpe: normalizedRpe,
  });

  const setIndex =
    args.setIndex !== null && args.setIndex !== undefined
      ? normalizePositiveWholeNumber(args.setIndex, "setIndex")
      : await getNextSetIndexForItem(sessionItemId);

  const payload = {
    session_id: sessionId,
    session_item_id: sessionItemId,
    set_index: setIndex,
    set_type: normalizeSetType(args.setType),
    reps: normalizedReps,
    weight_kg: normalizedWeightKg,
    duration_sec: normalizedDurationSec,
    distance_m: normalizedDistanceM,
    rpe: normalizedRpe,
    notes: normalizeOptionalText(args.notes),
  };

  const { data, error } = await supabase
    .from("workout_session_sets")
    .insert(payload)
    .select(
      `
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
    `
    )
    .single<WorkoutSessionSetRecord>();

  if (error) throw error;
  if (!data) throw new Error("Failed to add workout session set.");

  await syncWorkoutSessionItemCompletion(sessionItemId);

  return data;
}

export async function updateWorkoutSessionSet(args: UpdateWorkoutSessionSetArgs) {
  const setId = requireId(args.setId, "setId");
  const existing = await getWorkoutSessionSetById(setId);

  await assertSessionIsOpen(existing.session_id);

  const normalizedReps =
    args.reps !== undefined
      ? normalizeNonNegativeWholeNumber(args.reps, "reps")
      : existing.reps;

  const normalizedWeightKg =
    args.weightKg !== undefined
      ? normalizeNonNegativeDecimal(args.weightKg, "weightKg")
      : existing.weight_kg;

  const normalizedDurationSec =
    args.durationSec !== undefined
      ? normalizeNonNegativeWholeNumber(args.durationSec, "durationSec")
      : existing.duration_sec;

  const normalizedDistanceM =
    args.distanceM !== undefined
      ? normalizeNonNegativeDecimal(args.distanceM, "distanceM")
      : existing.distance_m;

  const normalizedRpe =
    args.rpe !== undefined ? normalizeRpe(args.rpe) : existing.rpe;

  assertSetHasMeaningfulValue({
    reps: normalizedReps,
    weightKg: normalizedWeightKg,
    durationSec: normalizedDurationSec,
    distanceM: normalizedDistanceM,
    rpe: normalizedRpe,
  });

  const payload = {
    set_type:
      args.setType !== undefined
        ? normalizeSetType(args.setType)
        : existing.set_type,
    reps: normalizedReps,
    weight_kg: normalizedWeightKg,
    duration_sec: normalizedDurationSec,
    distance_m: normalizedDistanceM,
    rpe: normalizedRpe,
    notes:
      args.notes !== undefined
        ? normalizeOptionalText(args.notes)
        : existing.notes,
  };

  const { data, error } = await supabase
    .from("workout_session_sets")
    .update(payload)
    .eq("id", setId)
    .select(
      `
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
    `
    )
    .single<WorkoutSessionSetRecord>();

  if (error) throw error;
  if (!data) throw new Error("Failed to update workout session set.");

  await syncWorkoutSessionItemCompletion(existing.session_item_id);

  return data;
}

export async function deleteWorkoutSessionSet(setId: string) {
  const id = requireId(setId, "setId");
  const existing = await getWorkoutSessionSetById(id);

  await assertSessionIsOpen(existing.session_id);

  const { error } = await supabase
    .from("workout_session_sets")
    .delete()
    .eq("id", id);

  if (error) throw error;

  await reindexWorkoutSessionSets(existing.session_item_id);
  await syncWorkoutSessionItemCompletion(existing.session_item_id);

  return {
    deleted: true,
    id,
    sessionItemId: existing.session_item_id,
  };
}

export async function createWorkoutSessionFromTemplate({
  userId,
  templateId,
}: {
  userId: string;
  templateId: string;
}) {
  const uid = requireId(userId, "userId");
  const tid = requireId(templateId, "templateId");

  const { data: template, error: templateMetaError } = await supabase
    .from("workout_templates")
    .select("id,title,activity_type")
    .eq("id", tid)
    .single<WorkoutTemplateRecord>();

  if (templateMetaError) throw templateMetaError;

  if (!template) {
    throw new Error("Workout template not found.");
  }

  if (!template.activity_type?.trim()) {
    throw new Error(
      "Workout template is missing activity_type. Cannot create session."
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: uid,
      title: template.title?.trim() || "Workout Session",
      activity_type: template.activity_type.trim(),
      template_id: tid,
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_min: null,
    })
    .select(
      `
      id,
      user_id,
      title,
      activity_type,
      plan_id,
      template_id,
      started_at,
      ended_at
    `
    )
    .single<WorkoutSessionRecord>();

  if (sessionError) throw sessionError;

  if (!session) {
    throw new Error("Failed to create workout session.");
  }

  const sessionId = session.id;

  try {
    const { data: templateItems, error: templateItemsError } = await supabase
      .from("workout_template_items")
      .select(
        `
        id,
        exercise_id,
        sort_order,
        prescribed_sets,
        prescribed_reps,
        prescribed_rpe,
        prescribed_weight_kg,
        notes
      `
      )
      .eq("template_id", tid)
      .order("sort_order", { ascending: true })
      .returns<WorkoutTemplateItemRecord[]>();

    if (templateItemsError) throw templateItemsError;

    if (!templateItems?.length) {
      return session;
    }

    const sessionItemsPayload: WorkoutSessionItemInsert[] = templateItems.map(
      (item, index) => ({
        session_id: sessionId,
        exercise_id: item.exercise_id,
        sort_order: item.sort_order ?? index,
        prescribed_sets: item.prescribed_sets ?? null,
        prescribed_reps: item.prescribed_reps ?? null,
        prescribed_rpe: item.prescribed_rpe ?? null,
        prescribed_weight_kg: item.prescribed_weight_kg ?? null,
        notes: item.notes ?? null,
        is_completed: false,
      })
    );

    const { error: sessionItemsError } = await supabase
      .from("workout_session_items")
      .insert(sessionItemsPayload);

    if (sessionItemsError) throw sessionItemsError;

    return session;
  } catch (error) {
    await supabase.from("workout_sessions").delete().eq("id", sessionId);
    throw error;
  }
}

export async function createWorkoutSessionFromPlan({
  userId,
  planId,
}: {
  userId: string;
  planId: string;
}) {
  const uid = requireId(userId, "userId");
  const pid = requireId(planId, "planId");

  const { data: plan, error: planError } = await supabase
    .from("planned_workouts")
    .select("id,user_id,title,activity_type,template_id")
    .eq("id", pid)
    .single<PlannedWorkoutRecord>();

  if (planError) throw planError;

  if (!plan) {
    throw new Error("Planned workout not found.");
  }

  if (plan.user_id !== uid) {
    throw new Error("You do not have access to this planned workout.");
  }

  if (plan.template_id) {
    const session = await createWorkoutSessionFromTemplate({
      userId: uid,
      templateId: plan.template_id,
    });

    const { data: updatedSession, error: updateError } = await supabase
      .from("workout_sessions")
      .update({ plan_id: pid })
      .eq("id", session.id)
      .select(
        `
        id,
        user_id,
        title,
        activity_type,
        plan_id,
        template_id,
        started_at,
        ended_at
      `
      )
      .single<WorkoutSessionRecord>();

    if (updateError) throw updateError;
    if (!updatedSession) {
      throw new Error("Failed to link workout session to plan.");
    }

    return updatedSession;
  }

  const { data: session, error: sessionError } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: uid,
      plan_id: pid,
      title: plan.title?.trim() || "Workout Session",
      activity_type: plan.activity_type?.trim() || "strength",
      started_at: new Date().toISOString(),
      ended_at: null,
      duration_min: null,
    })
    .select(
      `
      id,
      user_id,
      title,
      activity_type,
      plan_id,
      template_id,
      started_at,
      ended_at
    `
    )
    .single<WorkoutSessionRecord>();

  if (sessionError) throw sessionError;
  if (!session) throw new Error("Failed to create workout session.");

  return session;
}