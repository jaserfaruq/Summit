"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession, WorkoutLog, ValidatedObjective, Dimension, WeekCompletionFeedback, DifficultyLevel, DIFFICULTY_LABELS, DIFFICULTY_SCALE_FACTORS, DifficultyAdjustment, PlanData, WeeklyReport } from "@/lib/types";
import DeletePlanButton from "@/components/DeletePlanButton";
import ScoreArc from "@/components/ScoreArc";
import AlternativesPanel from "@/components/AlternativesPanel";
import Link from "next/link";

/** Inline SVG mountain silhouette used when no hero image URL is stored */
const MOUNTAIN_SVG_FALLBACK = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a1a2e"/><stop offset="40%" stop-color="#16213e"/><stop offset="70%" stop-color="#1b4d3e"/><stop offset="100%" stop-color="#0f3d3e"/></linearGradient><linearGradient id="g" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0%" stop-color="#d4782f" stop-opacity=".4"/><stop offset="100%" stop-color="#d4782f" stop-opacity="0"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2a3a30"/><stop offset="100%" stop-color="#1a2a20"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1f2f25"/><stop offset="100%" stop-color="#0f1f15"/></linearGradient></defs><rect width="1200" height="400" fill="url(#s)"/><ellipse cx="600" cy="120" rx="300" ry="60" fill="url(#g)"/><polygon points="0,400 150,180 300,280 500,120 650,220 800,160 950,240 1050,140 1200,250 1200,400" fill="url(#a)" opacity=".7"/><polygon points="500,120 520,130 540,125" fill="#e8e8e8" opacity=".5"/><polygon points="800,160 825,172 845,168" fill="#e8e8e8" opacity=".5"/><polygon points="1050,140 1075,155 1090,150" fill="#e8e8e8" opacity=".5"/><polygon points="0,400 100,250 250,320 400,200 550,300 700,230 850,290 1000,210 1100,280 1200,220 1200,400" fill="url(#b)"/></svg>`)}`;

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8"><div className="animate-pulse h-8 bg-dark-border rounded w-1/3" /></div>}>
      <PlanContent />
    </Suspense>
  );
}

function PlanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [weeks, setWeeks] = useState<WeeklyTarget[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [loadingSessions, setLoadingSessions] = useState<Record<number, boolean>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<number, string>>({});
  const [weekSessions, setWeekSessions] = useState<Record<number, PlanSession[]>>({});
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [validatedObj, setValidatedObj] = useState<ValidatedObjective | null>(null);
  const [completingWeek, setCompletingWeek] = useState<number | null>(null);
  const [weekCompleteResult, setWeekCompleteResult] = useState<Record<number, WeekCompletionFeedback>>({});
  const [rebalancing, setRebalancing] = useState(false);
  const [adjustingDifficulty, setAdjustingDifficulty] = useState<DifficultyLevel | null>(null);
  const [deletingLog, setDeletingLog] = useState<string | null>(null);
  const [scoredWeekNumbers, setScoredWeekNumbers] = useState<Set<number>>(new Set());
  const [alternativesPanel, setAlternativesPanel] = useState<{
    weekNumber: number;
    sessionIndex: number;
    session: PlanSession;
  } | null>(null);
  const [reportModal, setReportModal] = useState<{ weekNumber: number; report: WeeklyReport } | null>(null);
  const [pollingReportWeeks, setPollingReportWeeks] = useState<Set<number>>(new Set());

  const shouldGenerate = searchParams.get("generate") === "true";
  const objectiveId = searchParams.get("objectiveId");
  const assessmentId = searchParams.get("assessmentId");
  const loggedParam = searchParams.get("logged");

  const fetchPlan = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: plans } = await supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);

    const activePlan = (plans as TrainingPlan[] | null)?.[0];
    if (!activePlan) {
      setLoading(false);
      return;
    }

    setPlan(activePlan);

    const { data: weekData } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", activePlan.id)
      .order("week_number");

    const weeksArr = (weekData as WeeklyTarget[]) || [];
    setWeeks(weeksArr);

    const cached: Record<number, PlanSession[]> = {};
    for (const w of weeksArr) {
      if (w.sessions && w.sessions.length > 0) {
        cached[w.week_number] = w.sessions;
        // Recompute total_hours from actual session durations
        const totalMin = (w.sessions as PlanSession[]).reduce(
          (sum: number, s: PlanSession) => sum + (s.estimatedMinutes || 0),
          0
        );
        w.total_hours = Math.round((totalMin / 60) * 10) / 10;
      }
    }
    setWeekSessions(cached);

    const { data: objData } = await supabase
      .from("objectives")
      .select("*")
      .eq("id", activePlan.objective_id)
      .single();

    const objTyped = objData as Objective;
    setObjective(objTyped);

    if (objTyped?.matched_validated_id) {
      const { data: voData } = await supabase
        .from("validated_objectives")
        .select("*")
        .eq("id", objTyped.matched_validated_id)
        .single();
      setValidatedObj(voData as ValidatedObjective | null);
    }

    const { data: logData } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", user.id);

    setWorkoutLogs((logData as WorkoutLog[]) || []);

    // Fetch score_history to detect which weeks have already been scored
    // Only look at weekly_rating entries — not assessment entries which share week_ending dates
    const { data: scoreData } = await supabase
      .from("score_history")
      .select("week_ending")
      .eq("user_id", user.id)
      .eq("objective_id", activePlan.objective_id)
      .eq("change_reason", "weekly_rating");

    if (scoreData && weeksArr.length > 0) {
      const scoredEndings = new Set(scoreData.map((s: { week_ending: string }) => s.week_ending));
      const scored = new Set<number>();
      for (const w of weeksArr) {
        if (scoredEndings.has(w.week_start)) {
          scored.add(w.week_number);
        }
      }
      setScoredWeekNumbers(scored);
    }

    // Auto-expand the active week (tracked by current_week_number, not calendar)
    if (activePlan.current_week_number) {
      setExpandedWeek(activePlan.current_week_number);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (shouldGenerate && objectiveId && assessmentId) {
      generatePlan(objectiveId, assessmentId);
    } else {
      fetchPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedParam]);

  async function generatePlan(objId: string, assId: string) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "",
          objectiveId: objId,
          assessmentId: assId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate plan");
      }

      const planResult = await res.json();
      router.replace("/plan");
      await fetchPlan();

      // Fire batch session generation in the background (don't await)
      if (planResult.planId) {
        fetch("/api/generate-all-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: planResult.planId }),
        }).catch((err) => console.error("Background session generation failed:", err));
      }
    } catch (error) {
      console.error("Plan generation error:", error);
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate plan. Please try again."
      );
    }
    setGenerating(false);
  }

  async function loadWeekSessions(weekNumber: number) {
    if (!plan) return;
    if (weekSessions[weekNumber] && weekSessions[weekNumber].length > 0) return;

    setLoadingSessions((prev) => ({ ...prev, [weekNumber]: true }));
    setSessionErrors((prev) => {
      const next = { ...prev };
      delete next[weekNumber];
      return next;
    });

    try {
      const res = await fetch("/api/generate-week-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, weekNumber }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load sessions");
      }

      const { sessions } = await res.json();
      setWeekSessions((prev) => ({ ...prev, [weekNumber]: sessions }));

      // Update the week's total_hours from actual session durations
      const totalMinutes = (sessions as PlanSession[]).reduce(
        (sum: number, s: PlanSession) => sum + (s.estimatedMinutes || 0),
        0
      );
      const computedHours = Math.round((totalMinutes / 60) * 10) / 10;
      setWeeks((prev) =>
        prev.map((w) =>
          w.week_number === weekNumber ? { ...w, total_hours: computedHours } : w
        )
      );
    } catch (error) {
      console.error(`Error loading sessions for week ${weekNumber}:`, error);
      setSessionErrors((prev) => ({
        ...prev,
        [weekNumber]: error instanceof Error ? error.message : "Failed to load sessions",
      }));
    }

    setLoadingSessions((prev) => ({ ...prev, [weekNumber]: false }));
  }

  function handleWeekToggle(weekNumber: number) {
    const isExpanded = expandedWeek === weekNumber;
    const newExpanded = isExpanded ? null : weekNumber;
    setExpandedWeek(newExpanded);
    if (newExpanded !== null) loadWeekSessions(newExpanded);
  }

  async function handleCompleteWeek(week: WeeklyTarget) {
    if (!plan) return;
    setCompletingWeek(week.week_number);

    // Get logs for this week — extract ratings per session
    const weekLogs = workoutLogs.filter(
      (log) => log.week_number === week.week_number && log.plan_id === plan.id
    );

    const ratings = weekLogs
      .filter((log) => log.rating != null)
      .map((log) => ({
        sessionName: log.session_name || "",
        dimension: log.dimension as Dimension,
        rating: (log.rating || 3) as 1 | 2 | 3 | 4 | 5,
        comment: log.rating_comment || log.notes || "",
      }));

    try {
      const res = await fetch("/api/complete-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          weekNumber: week.week_number,
          ratings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to complete week");
      }

      const result: WeekCompletionFeedback = await res.json();
      setWeekCompleteResult((prev) => ({
        ...prev,
        [week.week_number]: result,
      }));

      // Mark this week as scored locally
      setScoredWeekNumbers((prev) => { const next = new Set(Array.from(prev)); next.add(week.week_number); return next; });

      // Only advance current week if this was the current week
      if (plan.current_week_number === week.week_number) {
        setPlan((prev) => prev ? { ...prev, current_week_number: week.week_number + 1 } : null);
        setExpandedWeek(week.week_number + 1);
      }

      if (objective) {
        const supabase = createClient();
        const { data: updatedObj } = await supabase
          .from("objectives")
          .select("*")
          .eq("id", objective.id)
          .single();
        if (updatedObj) setObjective(updatedObj as Objective);
      }
    } catch (error) {
      console.error("Error completing week:", error);
      alert(error instanceof Error ? error.message : "Failed to complete week");
    }

    setCompletingWeek(null);
  }

  async function handleRebalance() {
    if (!plan) return;
    if (!confirm("Rebalance plan? This will redistribute training volume across dimensions based on your current progress and regenerate all remaining sessions.")) {
      return;
    }
    setRebalancing(true);
    try {
      const res = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          currentWeek: plan.current_week_number,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rebalance plan");
      }

      // Refresh plan data to pick up rebalanced sessions
      await fetchPlan();
    } catch (error) {
      console.error("Error rebalancing:", error);
      alert(error instanceof Error ? error.message : "Failed to rebalance plan");
    }
    setRebalancing(false);
  }

  async function handleAdjustDifficulty(level: DifficultyLevel) {
    if (!plan) return;
    const label = DIFFICULTY_LABELS[level];
    if (!confirm(`Adjust plan to "${label}"? This will update your target scores and graduation benchmarks, and regenerate remaining sessions.`)) {
      return;
    }
    setAdjustingDifficulty(level);
    try {
      const res = await fetch("/api/adjust-difficulty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, level }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to adjust difficulty");
      }

      // Refresh plan data to pick up new targets and cleared sessions
      await fetchPlan();
    } catch (error) {
      console.error("Error adjusting difficulty:", error);
      alert(error instanceof Error ? error.message : "Failed to adjust difficulty");
    }
    setAdjustingDifficulty(null);
  }

  function getLogsForWeek(week: WeeklyTarget): WorkoutLog[] {
    return workoutLogs.filter(
      (log) => log.week_number === week.week_number && log.plan_id === plan?.id
    );
  }

  function isSessionLogged(sessionName: string, week: WeeklyTarget): boolean {
    const weekLogs = getLogsForWeek(week);
    return weekLogs.some((log) => log.session_name === sessionName);
  }

  function getLogForSession(sessionName: string, week: WeeklyTarget): WorkoutLog | undefined {
    const weekLogs = getLogsForWeek(week);
    return weekLogs.find((log) => log.session_name === sessionName);
  }

  async function handleDeleteLog(logId: string) {
    if (!confirm("Delete this workout log? If the week was already completed, scores will be reverted.")) return;
    setDeletingLog(logId);
    try {
      const res = await fetch("/api/delete-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete workout");
      }
      const result = await res.json();
      if (result.weekReverted) {
        alert("Week un-completed and scores reverted to previous values.");
      }
      await fetchPlan();
    } catch (error) {
      console.error("Error deleting workout:", error);
      alert(error instanceof Error ? error.message : "Failed to delete workout");
    }
    setDeletingLog(null);
  }

  // Poll for weekly report on completed weeks that don't have one yet
  useEffect(() => {
    if (pollingReportWeeks.size === 0) return;
    const interval = setInterval(async () => {
      const supabase = createClient();
      for (const wn of Array.from(pollingReportWeeks)) {
        const week = weeks.find((w) => w.week_number === wn);
        if (!week) continue;
        const { data } = await supabase
          .from("weekly_targets")
          .select("weekly_report")
          .eq("id", week.id)
          .single();
        if (data?.weekly_report) {
          setWeeks((prev) =>
            prev.map((w) =>
              w.week_number === wn ? { ...w, weekly_report: data.weekly_report } : w
            )
          );
          setPollingReportWeeks((prev) => {
            const next = new Set(Array.from(prev));
            next.delete(wn);
            return next;
          });
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingReportWeeks, weeks]);

  // Start polling for any completed week that is missing a report
  useEffect(() => {
    if (weeks.length === 0 || !plan) return;
    const needsPolling = new Set<number>();
    for (const week of weeks) {
      const isScored = scoredWeekNumbers.has(week.week_number) || weekCompleteResult[week.week_number];
      if (isScored && !week.weekly_report) {
        needsPolling.add(week.week_number);
      }
    }
    if (needsPolling.size > 0) {
      setPollingReportWeeks(needsPolling);
    }
  }, [weeks, scoredWeekNumbers, weekCompleteResult, plan]);

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        {generateError ? (
          <div>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Plan Generation Failed</h2>
            <p className="text-red-400 mb-6">{generateError}</p>
            <button
              onClick={() => {
                if (objectiveId && assessmentId) {
                  generatePlan(objectiveId, assessmentId);
                }
              }}
              className="bg-gold text-dark-bg px-6 py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="animate-pulse">
            <div className="text-4xl mb-4">⛰️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Generating Your Training Plan</h2>
            <p className="text-dark-muted">
              Our AI coach is designing a periodized plan tailored to your objective and current fitness...
            </p>
            <div className="mt-8 w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-border rounded w-1/3" />
          <div className="h-4 bg-dark-border rounded w-1/2" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-dark-border rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">No Active Plan</h2>
        <p className="text-dark-muted mb-8">Add an objective and complete your assessment to generate a training plan.</p>
        <Link
          href="/dashboard"
          className="inline-block bg-gold text-dark-bg px-6 py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const planSummary = plan.plan_data?.planSummary;
  const heroImageUrl = plan.plan_data?.heroImageUrl;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Hero header with blurred background image */}
      <div className="relative rounded-xl overflow-hidden -mx-4 sm:mx-0">
        {/* Background image layer */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl || MOUNTAIN_SVG_FALLBACK}
            alt=""
            className="w-full h-full object-cover blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        </div>

        {/* Content over image */}
        <div className="relative px-6 py-8 sm:py-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">{objective?.name}</h2>
              <p className="text-white/70 text-sm mt-1 drop-shadow">
                {weeks.length} weeks · Target: {objective?.target_date ? new Date(objective.target_date).toLocaleDateString() : ""}
              </p>
              {objective && (
                <div className="flex gap-3 sm:gap-4 mt-3">
                  <ScoreArc label="Cardio" current={objective.current_cardio_score} target={objective.target_cardio_score} size="mini" />
                  <ScoreArc label="Strength" current={objective.current_strength_score} target={objective.target_strength_score} size="mini" />
                  <ScoreArc label="Climbing" current={objective.current_climbing_score} target={objective.target_climbing_score} size="mini" />
                  <ScoreArc label="Flexibility" current={objective.current_flexibility_score} target={objective.target_flexibility_score} size="mini" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DeletePlanButton planId={plan.id} onDeleted={() => {
              setPlan(null);
              setWeeks([]);
              setObjective(null);
              setWeekSessions({});
              setWorkoutLogs([]);
            }} />
            </div>
          </div>
        </div>
      </div>

      {/* Objective details */}
      {objective && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5">
          {validatedObj?.description ? (
            <p className="text-sm text-dark-muted mb-3">{validatedObj.description}</p>
          ) : objective.relevance_profiles && typeof objective.relevance_profiles === "object" && "cardio" in objective.relevance_profiles && (
            <p className="text-sm text-dark-muted mb-3">
              {(objective.relevance_profiles as { cardio: { summary: string } }).cardio.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div>
              <span className="text-dark-muted">Type </span>
              <span className="text-dark-text capitalize">{objective.type.replace("_", " ")}</span>
            </div>
            {validatedObj?.route && (
              <div>
                <span className="text-dark-muted">Route </span>
                <span className="text-dark-text">{validatedObj.route}</span>
              </div>
            )}
            {(objective.distance_miles || validatedObj?.distance_miles) && (
              <div>
                <span className="text-dark-muted">Distance </span>
                <span className="text-dark-text">{objective.distance_miles || validatedObj?.distance_miles} mi</span>
              </div>
            )}
            {(objective.elevation_gain_ft || validatedObj?.total_gain_ft) && (
              <div>
                <span className="text-dark-muted">Gain </span>
                <span className="text-dark-text">{(objective.elevation_gain_ft || validatedObj?.total_gain_ft)?.toLocaleString()} ft</span>
              </div>
            )}
            {validatedObj?.summit_elevation_ft && (
              <div>
                <span className="text-dark-muted">Summit </span>
                <span className="text-dark-text">{validatedObj.summit_elevation_ft.toLocaleString()} ft</span>
              </div>
            )}
            {(objective.technical_grade || validatedObj?.technical_grade) && (
              <div>
                <span className="text-dark-muted">Grade </span>
                <span className="text-dark-text">{objective.technical_grade || validatedObj?.technical_grade}</span>
              </div>
            )}
            {validatedObj?.difficulty && (
              <div>
                <span className="text-dark-muted">Difficulty </span>
                <span className="text-dark-text capitalize">{validatedObj.difficulty}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan summary */}
      {planSummary && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5">
          <h3 className="font-semibold text-white mb-2">Plan Philosophy</h3>
          <p className="text-sm text-dark-muted mb-3">{planSummary.philosophy}</p>
          <p className="text-sm text-dark-muted">{planSummary.weeklyStructure}</p>
        </div>
      )}

      {/* Graduation workouts — prefer objective benchmarks (synced from seed), then validated, then plan snapshot */}
      {(objective?.graduation_benchmarks || plan.graduation_workouts || validatedObj?.graduation_benchmarks) && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-gold/20 p-5">
          <h3 className="font-semibold text-gold mb-3">Graduation Workouts (Finish Line)</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const source = objective?.graduation_benchmarks || validatedObj?.graduation_benchmarks || plan.graduation_workouts;
              const benchmarks = (source as unknown as Record<string, Array<{ exerciseName: string; graduationTarget: string }>>)?.[dim];
              if (!benchmarks || benchmarks.length === 0) return null;
              return (
                <div key={dim}>
                  <h4 className="text-xs font-semibold text-gold uppercase mb-1">{dim.replace("_", " / ")}</h4>
                  {benchmarks.map((b, i) => (
                    <p key={i} className="text-sm text-dark-muted">
                      {b.exerciseName}: <strong className="text-dark-text">{b.graduationTarget}</strong>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Adjust Difficulty & Rebalance */}
      {objective && plan && (
        <DifficultyAdjuster
          plan={plan}
          adjustingDifficulty={adjustingDifficulty}
          onAdjust={handleAdjustDifficulty}
          rebalancing={rebalancing}
          onRebalance={handleRebalance}
          rebalanceHighlighted={(() => {
            const current = {
              cardio: objective.current_cardio_score,
              strength: objective.current_strength_score,
              climbing_technical: objective.current_climbing_score,
              flexibility: objective.current_flexibility_score,
            };
            const currentWeekData = weeks.find(w => w.week_number === plan.current_week_number);
            if (!currentWeekData?.expected_scores) return false;
            const expected = currentWeekData.expected_scores as unknown as Record<string, number>;
            return Object.keys(current).some(
              dim => Math.abs((expected[dim] || 0) - current[dim as keyof typeof current]) >= 5
            );
          })()}
        />
      )}

      {/* Week list */}
      <div className="space-y-3">
        {weeks.map((week) => {
          const isExpanded = expandedWeek === week.week_number;
          const isCurrent = plan.current_week_number === week.week_number;

          const sessions = weekSessions[week.week_number] || [];
          const isLoadingSessions = loadingSessions[week.week_number];
          const sessionError = sessionErrors[week.week_number];
          const weekLogs = getLogsForWeek(week);
          const hasLogs = weekLogs.length > 0;
          const completeResult = weekCompleteResult[week.week_number];
          const isCompleting = completingWeek === week.week_number;
          const alreadyScored = scoredWeekNumbers.has(week.week_number);
          const isPastOrCurrent = week.week_number <= plan.current_week_number;
          const canComplete = isPastOrCurrent && hasLogs && !completeResult && !alreadyScored;

          return (
            <div
              key={week.id}
              className={`bg-dark-card/80 backdrop-blur-sm rounded-xl border overflow-hidden ${
                isCurrent ? "border-gold/40 ring-1 ring-gold/20" : "border-dark-border/50"
              }`}
            >
              {/* Week header */}
              <button
                onClick={() => handleWeekToggle(week.week_number)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">Week {week.week_number}</span>
                  {isCurrent && (
                    <span className="text-xs bg-gold text-dark-bg px-2 py-0.5 rounded font-medium">Current</span>
                  )}
                  {hasLogs && (
                    <span className="text-xs text-green-400 font-medium">
                      {weekLogs.length} logged
                    </span>
                  )}
                  {completeResult && (
                    <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded font-medium">
                      Scores Updated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-dark-muted">
                    {new Date(week.week_start).toLocaleDateString()}
                    {sessions.length > 0 ? ` · ${week.total_hours}h` : ""}
                  </span>
                  <span className="text-dark-muted">{isExpanded ? "▾" : "▸"}</span>
                </div>
              </button>

              {/* Expected scores bar */}
              {week.expected_scores && (
                <div className="px-5 pb-2 flex gap-4 text-xs text-dark-muted">
                  <span>C: {(week.expected_scores as unknown as Record<string, number>).cardio}</span>
                  <span>S: {(week.expected_scores as unknown as Record<string, number>).strength}</span>
                  <span>CT: {(week.expected_scores as unknown as Record<string, number>).climbing_technical}</span>
                  <span>F: {(week.expected_scores as unknown as Record<string, number>).flexibility}</span>
                </div>
              )}

              {/* Sessions */}
              {isExpanded && (
                <div className="px-5 pb-5 space-y-2">
                  {isLoadingSessions && (
                    <div className="py-6 text-center">
                      <div className="w-8 h-8 border-3 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-dark-muted">Generating sessions for Week {week.week_number}...</p>
                    </div>
                  )}

                  {sessionError && !isLoadingSessions && (
                    <div className="py-4 text-center bg-red-900/20 rounded-lg border border-red-800">
                      <p className="text-sm text-red-400 mb-3">{sessionError}</p>
                      <button
                        onClick={() => loadWeekSessions(week.week_number)}
                        className="text-sm bg-gold text-dark-bg px-4 py-2 rounded hover:bg-gold/90 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isLoadingSessions && !sessionError && sessions.length === 0 && (
                    <div className="py-4 text-center text-dark-muted text-sm">
                      No sessions generated yet. They should appear shortly.
                    </div>
                  )}

                  {sessions.map((session: PlanSession, i: number) => {
                    const sessionKey = `${week.week_number}-${i}`;
                    const isSessionExpanded = expandedSession === sessionKey;
                    const logged = isSessionLogged(session.name, week);

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border ${
                          logged
                            ? "border-green-800/40 bg-green-900/10"
                            : "border-dark-border bg-dark-surface"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSession(isSessionExpanded ? null : sessionKey);
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-2">
                            {logged && <span className="text-green-400 text-sm">✓</span>}
                            <span className={`font-medium text-sm ${logged ? "line-through opacity-60" : "text-white"}`}>
                              {session.name}
                            </span>
                            {session.isAlternative && (
                              <span className="text-[10px] bg-burnt-orange/20 text-burnt-orange px-1.5 py-0.5 rounded font-medium">Alt</span>
                            )}
                            <span className="text-xs text-dark-muted">{session.estimatedMinutes} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {logged && (() => {
                              const log = getLogForSession(session.name, week);
                              return log ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                                  disabled={deletingLog === log.id}
                                  className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                  title="Delete this workout log"
                                >
                                  {deletingLog === log.id ? "..." : "✕"}
                                </button>
                              ) : null;
                            })()}
                            {!logged && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAlternativesPanel({ weekNumber: week.week_number, sessionIndex: i, session });
                                  }}
                                  className="text-xs text-dark-muted hover:text-white px-2 py-1 rounded hover:bg-dark-border/50 transition-colors"
                                >
                                  Alternatives
                                </button>
                                <Link
                                  href={`/log?session=${encodeURIComponent(session.name)}&planId=${plan.id}&week=${week.week_number}`}
                                  className="text-xs bg-gold/90 text-dark-bg px-2.5 py-1 rounded hover:bg-gold transition-colors font-medium"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Log
                                </Link>
                              </>
                            )}
                            <span className="text-dark-muted text-xs">{isSessionExpanded ? "▾" : "▸"}</span>
                          </div>
                        </button>

                        {isSessionExpanded && (
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm text-dark-muted italic">{session.objective}</p>

                            {session.warmUp && (
                              <div>
                                <h5 className="text-xs font-semibold text-gold uppercase mb-1">
                                  Warm-Up ({session.warmUp.rounds} round{session.warmUp.rounds > 1 ? "s" : ""})
                                </h5>
                                <ul className="text-sm text-dark-muted space-y-0.5">
                                  {session.warmUp.exercises.map((ex, j) => (
                                    <li key={j}>• {ex.name} — {ex.reps}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {session.training && (
                              <div>
                                <h5 className="text-xs font-semibold text-gold uppercase mb-1">Training</h5>
                                <ol className="text-sm text-dark-muted space-y-1.5">
                                  {session.training.map((ex) => (
                                    <li key={ex.exerciseNumber}>
                                      <span className="font-medium text-dark-text">
                                        {ex.exerciseNumber}. {ex.description}
                                        {ex.durationMinutes ? (
                                          <span className="text-dark-muted font-normal text-xs ml-2">{ex.durationMinutes} min</span>
                                        ) : null}
                                      </span>
                                      <br />
                                      <span className="text-dark-muted">{ex.details}</span>
                                      {ex.intensityNote && (
                                        <span className="block text-dark-muted text-xs italic">{ex.intensityNote}</span>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {session.cooldown && (
                              <div>
                                <h5 className="text-xs font-semibold text-gold uppercase mb-1">Cooldown</h5>
                                <p className="text-sm text-dark-muted">{session.cooldown}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Complete Week button */}
                  {canComplete && (
                    <button
                      onClick={() => handleCompleteWeek(week)}
                      disabled={isCompleting}
                      className="w-full mt-3 py-3 rounded-lg font-medium text-sm transition-colors bg-gold text-dark-bg hover:bg-gold/90 disabled:opacity-50"
                    >
                      {isCompleting
                        ? "Updating Scores..."
                        : `Complete Week ${week.week_number} & Update Scores`
                      }
                    </button>
                  )}

                  {/* Score update result with trajectory feedback */}
                  {completeResult && (
                    <div className={`mt-3 rounded-lg p-4 border ${
                      completeResult.rebalanceRecommended
                        ? "bg-burnt-orange/10 border-burnt-orange/30"
                        : "bg-green-900/20 border-green-800/40"
                    }`}>
                      <h4 className="text-sm font-semibold text-white mb-2">Scores Updated</h4>
                      <div className="flex gap-4 text-xs text-dark-text mb-2">
                        <span>C: {completeResult.updatedScores.cardio}</span>
                        <span>S: {completeResult.updatedScores.strength}</span>
                        <span>CT: {completeResult.updatedScores.climbing_technical}</span>
                        <span>F: {completeResult.updatedScores.flexibility}</span>
                      </div>
                      {completeResult.summary && (
                        <p className="text-xs text-dark-muted">{completeResult.summary}</p>
                      )}
                      {completeResult.rebalanceRecommended && (
                        <p className="text-xs text-burnt-orange mt-1">
                          Consider rebalancing your plan — some dimensions are significantly off track.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Weekly Report button */}
                  {(alreadyScored || completeResult) && (
                    <div className="mt-3">
                      {week.weekly_report ? (
                        <button
                          onClick={() => setReportModal({ weekNumber: week.week_number, report: week.weekly_report! })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-burnt-orange/15 text-burnt-orange border border-burnt-orange/30 hover:bg-burnt-orange/25"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Report
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-dark-muted">
                          <div className="w-3.5 h-3.5 border-2 border-dark-muted border-t-transparent rounded-full animate-spin" />
                          Report generating…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alternatives Panel */}
      {alternativesPanel && plan && (
        <AlternativesPanel
          isOpen={!!alternativesPanel}
          onClose={() => setAlternativesPanel(null)}
          planId={plan.id}
          weekNumber={alternativesPanel.weekNumber}
          sessionIndex={alternativesPanel.sessionIndex}
          session={alternativesPanel.session}
          onSessionReplaced={(newSessions) => {
            setWeekSessions(prev => ({
              ...prev,
              [alternativesPanel.weekNumber]: newSessions,
            }));
            setAlternativesPanel(null);
          }}
        />
      )}

      {/* Weekly Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setReportModal(null)}>
          <div
            className="bg-dark-card border border-dark-border rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-white">Week {reportModal.weekNumber} Report</h3>
              <button
                onClick={() => setReportModal(null)}
                className="text-dark-muted hover:text-white transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <ReportSection title="Week Summary" content={reportModal.report.summary} />
              <ReportSection title="Score Changes & Why" content={reportModal.report.scoreChanges} />
              <ReportSection title="Where You Stand" content={reportModal.report.whereYouStand} />
              <ReportSection title="Next Week Focus" content={reportModal.report.nextWeekFocus} />
              {reportModal.report.considerAdjusting && (
                <ReportSection title="Consider Adjusting?" content={reportModal.report.considerAdjusting} accent />
              )}
              <p className="text-xs text-dark-muted text-right">
                Generated {new Date(reportModal.report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, content, accent }: { title: string; content: string; accent?: boolean }) {
  return (
    <div>
      <h4 className={`text-sm font-semibold mb-2 ${accent ? "text-burnt-orange" : "text-gold"}`}>
        {title}
      </h4>
      <div className="text-sm text-dark-text leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

const DIFFICULTY_INFO: Record<DifficultyLevel, { description: string; prevalence: string }> = {
  much_easier: {
    description: "Scales target scores to 60% of the remaining gap. Best for recovery from injury, returning after a long break, or when the objective feels overwhelming.",
    prevalence: "Used by ~10% of athletes — typically those adapting after setbacks.",
  },
  slightly_easier: {
    description: "Scales target scores to 80% of the remaining gap. Good when sessions consistently feel too hard (rating 1–2) or life stress is limiting recovery.",
    prevalence: "Used by ~25% of athletes — the most common downward adjustment.",
  },
  slightly_harder: {
    description: "Scales target scores to 120% of the remaining gap. For when sessions consistently feel too easy (rating 4–5) and you want to push toward a stronger finish.",
    prevalence: "Used by ~20% of athletes — common mid-plan when fitness is building fast.",
  },
  much_harder: {
    description: "Scales target scores to 150% of the remaining gap. For experienced athletes who want an aggressive build. Significantly increases weekly volume and intensity.",
    prevalence: "Used by ~5% of athletes — only recommended with a strong training base.",
  },
};

function DifficultyAdjuster({
  plan,
  adjustingDifficulty,
  onAdjust,
  rebalancing,
  onRebalance,
  rebalanceHighlighted,
}: {
  plan: TrainingPlan;
  adjustingDifficulty: DifficultyLevel | null;
  onAdjust: (level: DifficultyLevel) => void;
  rebalancing: boolean;
  onRebalance: () => void;
  rebalanceHighlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeInfo, setActiveInfo] = useState<DifficultyLevel | "rebalance" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close info popover on outside click
  useEffect(() => {
    if (!activeInfo) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInfo(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activeInfo]);

  const netLabel = (() => {
    const adjustments = (plan.plan_data as PlanData)?.difficultyAdjustments;
    if (!adjustments || adjustments.length === 0) return "Original";
    const net = adjustments.reduce(
      (sum: number, a: DifficultyAdjustment) => sum + (a.level.includes("harder") ? 1 : -1),
      0
    );
    if (net === 0) return "Original";
    return net > 0 ? `+${net} harder` : `${net} easier`;
  })();

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50" ref={containerRef}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <h3 className="text-sm font-semibold text-white">Adjust Plan</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-muted">{netLabel}</span>
          <svg
            className={`w-4 h-4 text-dark-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Difficulty buttons */}
          <div className="space-y-2">
            <p className="text-xs text-dark-muted font-medium uppercase tracking-wide">Difficulty</p>
            <div className="grid grid-cols-2 gap-2">
              {(["much_easier", "slightly_easier", "slightly_harder", "much_harder"] as DifficultyLevel[]).map((level) => (
                <div key={level} className="relative">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAdjust(level)}
                      disabled={!!adjustingDifficulty}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${
                        level.includes("easier")
                          ? "bg-blue-900/20 border-blue-800/40 text-blue-300 hover:bg-blue-900/30"
                          : "bg-burnt-orange/10 border-burnt-orange/30 text-burnt-orange hover:bg-burnt-orange/20"
                      } disabled:opacity-50`}
                    >
                      {adjustingDifficulty === level ? "Adjusting..." : `${DIFFICULTY_LABELS[level]} (${DIFFICULTY_SCALE_FACTORS[level]}x)`}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInfo(activeInfo === level ? null : level);
                      }}
                      className="flex-shrink-0 w-7 h-7 rounded-full border border-dark-border/60 text-dark-muted hover:text-white hover:border-white/40 flex items-center justify-center text-xs font-semibold transition-colors"
                      aria-label={`Info about ${DIFFICULTY_LABELS[level]}`}
                    >
                      i
                    </button>
                  </div>

                  {activeInfo === level && (
                    <div className="absolute z-20 bottom-full mb-2 left-0 right-0 bg-dark-bg border border-dark-border rounded-lg p-3 shadow-xl">
                      <p className="text-xs text-dark-text leading-relaxed">{DIFFICULTY_INFO[level].description}</p>
                      <p className="text-xs text-dark-muted mt-2 italic">{DIFFICULTY_INFO[level].prevalence}</p>
                      <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-dark-bg border-r border-b border-dark-border rotate-45" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rebalance button */}
          <div className="pt-1 relative">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onRebalance}
                disabled={rebalancing}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${
                  rebalanceHighlighted
                    ? "bg-burnt-orange/20 border-burnt-orange/40 text-burnt-orange hover:bg-burnt-orange/30"
                    : "bg-dark-border/20 border-dark-border/50 text-dark-muted hover:bg-dark-border/30 hover:text-white"
                } disabled:opacity-50`}
              >
                {rebalancing ? "Rebalancing..." : "Rebalance Plan"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfo(activeInfo === "rebalance" ? null : "rebalance");
                }}
                className="flex-shrink-0 w-7 h-7 rounded-full border border-dark-border/60 text-dark-muted hover:text-white hover:border-white/40 flex items-center justify-center text-xs font-semibold transition-colors"
                aria-label="Info about Rebalance Plan"
              >
                i
              </button>
            </div>
            {activeInfo === "rebalance" && (
              <div className="absolute z-20 bottom-full mb-2 left-0 right-0 bg-dark-bg border border-dark-border rounded-lg p-3 shadow-xl">
                <p className="text-xs text-dark-text leading-relaxed">Redistributes training volume across dimensions based on your actual progress. Dimensions ahead of schedule drop to maintenance (min 60% volume), freeing time for dimensions that are behind.</p>
                <p className="text-xs text-dark-muted mt-2 italic">Highlighted when any dimension is 5+ points off the expected trajectory.</p>
                <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-dark-bg border-r border-b border-dark-border rotate-45" />
              </div>
            )}
            {rebalanceHighlighted && (
              <p className="text-[10px] text-burnt-orange/70 mt-1 text-center">One or more dimensions are 5+ points off trajectory</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
