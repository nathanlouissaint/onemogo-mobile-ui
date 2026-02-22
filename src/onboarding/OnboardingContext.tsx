import React, { createContext, useContext, useMemo, useReducer } from "react";

export type GoalValue =
  | "lose_fat"
  | "build_muscle"
  | "improve_strength"
  | "general_fitness";

export type StrengthTrackingMode = "prs" | "volume" | "both";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type OnboardingDraft = {
  goal: GoalValue | null;
  trainingDaysPerWeek: number | null;
  strengthTrackingMode: StrengthTrackingMode | null;
  experienceLevel: ExperienceLevel | null;
  baselineWeight: number | null;
};

const initialDraft: OnboardingDraft = {
  goal: null,
  trainingDaysPerWeek: null,
  strengthTrackingMode: null,
  experienceLevel: null,
  baselineWeight: null,
};

type Action =
  | { type: "SET_GOAL"; value: GoalValue }
  | { type: "SET_DAYS"; value: number }
  | { type: "SET_STRENGTH_MODE"; value: StrengthTrackingMode }
  | { type: "SET_EXPERIENCE"; value: ExperienceLevel }
  | { type: "SET_WEIGHT"; value: number }
  | { type: "RESET" };

function reducer(state: OnboardingDraft, action: Action): OnboardingDraft {
  switch (action.type) {
    case "SET_GOAL":
      return { ...state, goal: action.value };
    case "SET_DAYS":
      return { ...state, trainingDaysPerWeek: action.value };
    case "SET_STRENGTH_MODE":
      return { ...state, strengthTrackingMode: action.value };
    case "SET_EXPERIENCE":
      return { ...state, experienceLevel: action.value };
    case "SET_WEIGHT":
      return { ...state, baselineWeight: action.value };
    case "RESET":
      return initialDraft;
    default:
      return state;
  }
}

type OnboardingContextValue = {
  draft: OnboardingDraft;
  setGoal: (v: GoalValue) => void;
  setDays: (v: number) => void;
  setStrengthMode: (v: StrengthTrackingMode) => void;
  setExperience: (v: ExperienceLevel) => void;
  setWeight: (v: number) => void;
  reset: () => void;
  isComplete: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, initialDraft);

  const value = useMemo<OnboardingContextValue>(() => {
    const isComplete =
      !!draft.goal &&
      typeof draft.trainingDaysPerWeek === "number" &&
      !!draft.strengthTrackingMode &&
      !!draft.experienceLevel &&
      typeof draft.baselineWeight === "number";

    return {
      draft,
      setGoal: (v) => dispatch({ type: "SET_GOAL", value: v }),
      setDays: (v) => dispatch({ type: "SET_DAYS", value: v }),
      setStrengthMode: (v) => dispatch({ type: "SET_STRENGTH_MODE", value: v }),
      setExperience: (v) => dispatch({ type: "SET_EXPERIENCE", value: v }),
      setWeight: (v) => dispatch({ type: "SET_WEIGHT", value: v }),
      reset: () => dispatch({ type: "RESET" }),
      isComplete,
    };
  }, [draft]);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}