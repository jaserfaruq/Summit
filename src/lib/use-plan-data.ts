import useSWR from "swr";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession, WorkoutLog, ValidatedObjective, Assessment } from "@/lib/types";

export interface CachedPlanData {
  plan: TrainingPlan | null;
  weeks: WeeklyTarget[];
  objective: Objective | null;
  validatedObj: ValidatedObjective | null;
  assessment: Assessment | null;
  workoutLogs: WorkoutLog[];
  weekSessions: Record<number, PlanSession[]>;
  scoredWeekNumbers: Set<number>;
  activeWeek: number | null;
}

const EMPTY: CachedPlanData = {
  plan: null,
  weeks: [],
  objective: null,
  validatedObj: null,
  assessment: null,
  workoutLogs: [],
  weekSessions: {},
  scoredWeekNumbers: new Set(),
  activeWeek: null,
};

async function fetchPlanData(): Promise<CachedPlanData> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const { data: plans } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const activePlan = (plans as TrainingPlan[] | null)?.[0];
  if (!activePlan) return EMPTY;

  // Parallel fetch: these 5 queries are independent
  const assessmentQuery = activePlan.assessment_id
    ? supabase.from("assessments").select("*").eq("id", activePlan.assessment_id).single()
    : Promise.resolve({ data: null });
  const [weekResult, objResult, logResult, scoreResult, assessmentResult] = await Promise.all([
    supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", activePlan.id)
      .order("week_number"),
    supabase
      .from("objectives")
      .select("*")
      .eq("id", activePlan.objective_id)
      .single(),
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("plan_id", activePlan.id),
    supabase
      .from("score_history")
      .select("week_ending")
      .eq("user_id", user.id)
      .eq("objective_id", activePlan.objective_id)
      .eq("change_reason", "weekly_rating"),
    assessmentQuery,
  ]);

  const weeksArr = (weekResult.data as WeeklyTarget[]) || [];
  const cached: Record<number, PlanSession[]> = {};
  for (const w of weeksArr) {
    if (w.sessions && w.sessions.length > 0) {
      cached[w.week_number] = w.sessions;
      const totalMin = (w.sessions as PlanSession[]).reduce(
        (sum: number, s: PlanSession) => sum + (s.estimatedMinutes || 0),
        0
      );
      w.total_hours = Math.round((totalMin / 60) * 10) / 10;
    }
  }

  const objTyped = objResult.data as Objective;

  // Fetch validated objective (non-blocking for the main return)
  let validatedObj: ValidatedObjective | null = null;
  if (objTyped?.matched_validated_id) {
    const { data: voData } = await supabase
      .from("validated_objectives")
      .select("*")
      .eq("id", objTyped.matched_validated_id)
      .single();
    validatedObj = voData as ValidatedObjective | null;
  }

  // Compute scored week numbers
  const scoreData = scoreResult.data;
  const scoredWeekNumbers = new Set<number>();
  if (scoreData && weeksArr.length > 0) {
    const scoredEndings = new Set(scoreData.map((s: { week_ending: string }) => s.week_ending));
    for (const w of weeksArr) {
      if (scoredEndings.has(w.week_start)) {
        scoredWeekNumbers.add(w.week_number);
      }
    }
  }

  return {
    plan: activePlan,
    weeks: weeksArr,
    objective: objTyped,
    validatedObj,
    assessment: (assessmentResult.data as Assessment | null) ?? null,
    workoutLogs: (logResult.data as WorkoutLog[]) || [],
    weekSessions: cached,
    scoredWeekNumbers,
    activeWeek: activePlan.current_week_number || null,
  };
}

export function usePlanData() {
  const { data, error, isLoading, mutate } = useSWR("plan-data", fetchPlanData, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  return {
    data: data ?? EMPTY,
    error,
    isLoading,
    mutate,
  };
}
