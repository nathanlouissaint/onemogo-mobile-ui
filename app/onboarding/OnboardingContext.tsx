// src/onboarding/OnboardingContext.tsx
import React, { createContext, useContext, useMemo, useState } from "react";

export type StrengthTrackingMode = "prs" | "volume" | "both";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type GoalValue =
  | "lose_fat"
  | "build_muscle"
  | "improve_strength"
  | "general_fitness";

export type OnboardingDraft = {
  goal: GoalValue | null;
  trainingDaysPerWeek: number | null;
  strengthTrackingMode: StrengthTrackingMode | null;
  experienceLevel: ExperienceLevel | null;
  baselineWeight: number | null;
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setGoal: (goal: GoalValue) => void;
  setDays: (days: number) => void;
  setStrengthMode: (mode: StrengthTrackingMode) => void;
  setExperience: (level: ExperienceLevel) => void;
  setBaselineWeight: (weight: number) => void;
  reset: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const INITIAL: OnboardingDraft = {
  goal: null,
  trainingDaysPerWeek: null,
  strengthTrackingMode: null,
  experienceLevel: null,
  baselineWeight: null,
};

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(INITIAL);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      draft,
      setGoal: (goal) => setDraft((d) => ({ ...d, goal })),
      setDays: (trainingDaysPerWeek) => setDraft((d) => ({ ...d, trainingDaysPerWeek })),
      setStrengthMode: (strengthTrackingMode) =>
        setDraft((d) => ({ ...d, strengthTrackingMode })),
      setExperience: (experienceLevel) => setDraft((d) => ({ ...d, experienceLevel })),
      setBaselineWeight: (baselineWeight) => setDraft((d) => ({ ...d, baselineWeight })),
      reset: () => setDraft(INITIAL),
    }),
    [draft]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}