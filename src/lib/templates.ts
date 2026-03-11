// src/lib/templates.ts
import { supabase } from "./supabase";

export type Exercise = {
  id: string;
  name: string;
};

export type WorkoutTemplate = {
  id: string;
  user_id: string;
  title: string | null;
  activity_type: string;
};

export type WorkoutTemplateItem = {
  id: string;
  template_id: string;
  exercise_id: string;
  sort_order: number;
  prescribed_sets: number | null;
  prescribed_reps: number | null;
  prescribed_rpe: number | null;
  notes: string | null;
  exercise?: Exercise;
};

const TEMPLATE_SELECT = "id,user_id,title,activity_type";
const TEMPLATE_ITEM_SELECT =
  "id,template_id,exercise_id,sort_order,prescribed_sets,prescribed_reps,prescribed_rpe,notes,exercises(id,name)";

function requireId(id: string, label: string) {
  const v = String(id ?? "").trim();
  if (!v) throw new Error(`Missing ${label}.`);
  return v;
}

export async function getTemplateById(templateId: string) {
  const id = requireId(templateId, "templateId");

  const { data, error } = await supabase
    .from("workout_templates")
    .select(TEMPLATE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as WorkoutTemplate | null;
}

export async function listTemplateItems(templateId: string) {
  const id = requireId(templateId, "templateId");

  const { data, error } = await supabase
    .from("workout_template_items")
    .select(TEMPLATE_ITEM_SELECT)
    .eq("template_id", id)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    exercise: row.exercises ?? undefined,
  })) as WorkoutTemplateItem[];
}