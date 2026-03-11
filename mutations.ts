import { supabase } from "./supabase";

export async function createWorkout(params: {
  userId: string;
  title?: string | null;
  activityType?: string | null;
  durationMin?: number | null;
}) {
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: params.userId,
      title: params.title ?? null,
      activityType: params.activityType ?? null,
      durationMin: params.durationMin ?? null,
    })
    .select('id,title,"activityType","durationMin",created_at')
    .single();

  if (error) throw error;
  return data;
}