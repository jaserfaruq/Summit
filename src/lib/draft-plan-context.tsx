"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  ObjectiveType,
  Tier,
  DimensionScores,
  DimensionTaglines,
  DimensionRelevanceProfiles,
  DimensionGraduationBenchmarks,
  AIQuestion,
  AIReasoning,
  ProgrammingHints,
  StandardAnswers,
  GapAnalysis,
  PlanSession,
  WeekType,
} from "@/lib/types";

const STORAGE_KEY = "summit-draft-plan";

export interface DraftObjective {
  name: string;
  type: ObjectiveType;
  target_date: string;
  distance_miles: number | null;
  elevation_gain_ft: number | null;
  technical_grade: string | null;
  pitch_count: number | null;
  target_cardio_score: number;
  target_strength_score: number;
  target_climbing_score: number;
  target_flexibility_score: number;
  current_cardio_score: number;
  current_strength_score: number;
  current_climbing_score: number;
  current_flexibility_score: number;
  taglines: DimensionTaglines;
  relevance_profiles: DimensionRelevanceProfiles | Record<string, never>;
  graduation_benchmarks: DimensionGraduationBenchmarks;
  climbing_role: "lead" | "follow" | null;
  matched_validated_id: string | null;
  tier: Tier;
}

export interface DraftAssessment {
  cardio_score: number;
  strength_score: number;
  climbing_score: number;
  flexibility_score: number;
  standard_answers: StandardAnswers;
  ai_questions: AIQuestion[] | null;
  ai_answers: Record<string, string | number> | null;
  freeform_text: string | null;
  ai_reasoning: AIReasoning | null;
  programming_hints: ProgrammingHints | null;
  climbing_role: "lead" | "follow" | null;
  adjusted_targets: DimensionScores | null;
  gap_analysis: GapAnalysis | null;
}

export interface DraftWeek {
  weekNumber: number;
  weekStartDate: string;
  weekType: WeekType;
  totalHoursTarget: number;
  expectedScores: DimensionScores;
  sessions: PlanSession[];
}

export interface DraftPlan {
  planSummary: {
    philosophy: string;
    weeklyStructure: string;
    equipmentNeeded: string[];
    keyExercises: string[];
  };
  heroImageUrl: string | null;
  programmingHints: ProgrammingHints | null;
  gapAnalysis: GapAnalysis | null;
  graduationWorkouts: DimensionGraduationBenchmarks;
  weeks: DraftWeek[];
}

export interface DraftPlanState {
  objective: DraftObjective | null;
  assessment: DraftAssessment | null;
  plan: DraftPlan | null;
  createdAt: string;
}

interface DraftPlanContextValue {
  draft: DraftPlanState | null;
  hasDraft: boolean;
  isLoaded: boolean;
  setObjective: (objective: DraftObjective) => void;
  setAssessment: (assessment: DraftAssessment) => void;
  setPlan: (plan: DraftPlan) => void;
  setWeekSessions: (weekNumber: number, sessions: PlanSession[]) => void;
  clearDraft: () => void;
  resumeRoute: () => string;
}

const DraftPlanContext = createContext<DraftPlanContextValue>({
  draft: null,
  hasDraft: false,
  isLoaded: false,
  setObjective: () => {},
  setAssessment: () => {},
  setPlan: () => {},
  setWeekSessions: () => {},
  clearDraft: () => {},
  resumeRoute: () => "/dashboard",
});

export function useDraftPlan() {
  return useContext(DraftPlanContext);
}

function readFromStorage(): DraftPlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftPlanState;
  } catch {
    return null;
  }
}

function writeToStorage(state: DraftPlanState | null) {
  if (typeof window === "undefined") return;
  try {
    if (state === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Quota or serialization failure — ignore so the UI keeps working
  }
}

export function DraftPlanProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftPlanState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setDraft(readFromStorage());
    setIsLoaded(true);
  }, []);

  const persist = useCallback((next: DraftPlanState | null) => {
    setDraft(next);
    writeToStorage(next);
  }, []);

  const setObjective = useCallback((objective: DraftObjective) => {
    setDraft((prev) => {
      const next: DraftPlanState = prev
        ? { ...prev, objective }
        : { objective, assessment: null, plan: null, createdAt: new Date().toISOString() };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setAssessment = useCallback((assessment: DraftAssessment) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const adjustedObjective: DraftObjective = {
        ...prev.objective!,
        current_cardio_score: assessment.cardio_score,
        current_strength_score: assessment.strength_score,
        current_climbing_score: assessment.climbing_score,
        current_flexibility_score: assessment.flexibility_score,
        climbing_role: assessment.climbing_role,
      };
      // If AI adjusted targets (follow role), apply them to the objective too
      if (assessment.adjusted_targets) {
        adjustedObjective.target_cardio_score = assessment.adjusted_targets.cardio;
        adjustedObjective.target_strength_score = assessment.adjusted_targets.strength;
        adjustedObjective.target_climbing_score = assessment.adjusted_targets.climbing_technical;
        adjustedObjective.target_flexibility_score = assessment.adjusted_targets.flexibility;
      }
      const next: DraftPlanState = { ...prev, objective: adjustedObjective, assessment };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setPlan = useCallback((plan: DraftPlan) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next: DraftPlanState = { ...prev, plan };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setWeekSessions = useCallback((weekNumber: number, sessions: PlanSession[]) => {
    setDraft((prev) => {
      if (!prev?.plan) return prev;
      const updatedWeeks = prev.plan.weeks.map((w) =>
        w.weekNumber === weekNumber ? { ...w, sessions } : w
      );
      const next: DraftPlanState = {
        ...prev,
        plan: { ...prev.plan, weeks: updatedWeeks },
      };
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    persist(null);
  }, [persist]);

  const resumeRoute = useCallback(() => {
    if (!draft?.objective) return "/dashboard";
    if (!draft.assessment) return "/assessment/draft";
    return "/plan";
  }, [draft]);

  return (
    <DraftPlanContext.Provider
      value={{
        draft,
        hasDraft: draft !== null && draft.objective !== null,
        isLoaded,
        setObjective,
        setAssessment,
        setPlan,
        setWeekSessions,
        clearDraft,
        resumeRoute,
      }}
    >
      {children}
    </DraftPlanContext.Provider>
  );
}
