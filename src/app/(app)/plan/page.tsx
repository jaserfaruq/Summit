"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession, WorkoutLog, ValidatedObjective } from "@/lib/types";
import WeekBadge from "@/components/WeekBadge";
import DeletePlanButton from "@/components/DeletePlanButton";
import Link from "next/link";

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
  const [weekCompleteResult, setWeekCompleteResult] = useState<Record<number, {
    updatedScores: Record<string, number>;
    rebalanceTriggered: boolean;
  }>>({});
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ generated: number; total: number } | null>(null);

  const shouldGenerate = searchParams.get("generate") === "true";
  const objectiveId = searchParams.get("objectiveId");
  const assessmentId = searchParams.get("assessmentId");

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

    const today = new Date();
    const currentWeek = weeksArr.find((w) => {
      const start = new Date(w.week_start);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return today >= start && today < end;
    });
    if (currentWeek) setExpandedWeek(currentWeek.week_number);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (shouldGenerate && objectiveId && assessmentId) {
      generatePlan(objectiveId, assessmentId);
    } else {
      fetchPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateAllSessions(planId: string) {
    setBatchGenerating(true);
    try {
      const res = await fetch("/api/generate-all-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (res.ok) {
        const result = await res.json();
        setBatchProgress({ generated: result.generated, total: result.total });
      }
      // Refresh plan data to pick up generated sessions
      await fetchPlan();
    } catch (error) {
      console.error("Batch session generation error:", error);
    }
    setBatchGenerating(false);
  }

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

      // Trigger background batch generation of all week sessions
      if (planResult.planId) {
        generateAllSessions(planResult.planId);
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

    const weekStart = new Date(week.week_start + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekLogs = workoutLogs.filter((log) => {
      const logDate = new Date(log.logged_date + "T00:00:00");
      return logDate >= weekStart && logDate < weekEnd;
    });

    const logsForApi = weekLogs.map((log) => ({
      logged_date: log.logged_date,
      dimension: log.dimension,
      duration_min: log.duration_min,
      details: log.details,
      benchmark_results: log.benchmark_results,
      completed_as_prescribed: log.completed_as_prescribed,
      session_name: log.session_name,
      notes: log.notes,
    }));

    try {
      const res = await fetch("/api/complete-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          weekNumber: week.week_number,
          workoutLogs: logsForApi,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to complete week");
      }

      const result = await res.json();
      setWeekCompleteResult((prev) => ({
        ...prev,
        [week.week_number]: result,
      }));

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

  function getLogsForWeek(week: WeeklyTarget): WorkoutLog[] {
    const weekStart = new Date(week.week_start + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return workoutLogs.filter((log) => {
      const logDate = new Date(log.logged_date + "T00:00:00");
      return logDate >= weekStart && logDate < weekEnd;
    });
  }

  function isSessionLogged(sessionName: string, week: WeeklyTarget): boolean {
    const weekLogs = getLogsForWeek(week);
    return weekLogs.some((log) => log.session_name === sessionName);
  }

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

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{objective?.name}</h2>
          <p className="text-dark-muted text-sm">
            {weeks.length} weeks · Target: {objective?.target_date ? new Date(objective.target_date).toLocaleDateString() : ""}
          </p>
          {objective && (
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-gold font-medium">Current Scores:</span>
              <span>C: {objective.current_cardio_score}</span>
              <span>S: {objective.current_strength_score}</span>
              <span>CT: {objective.current_climbing_score}</span>
              <span>F: {objective.current_flexibility_score}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!batchGenerating && weeks.some((w) => !weekSessions[w.week_number] || weekSessions[w.week_number].length === 0) && (
            <button
              onClick={() => generateAllSessions(plan.id)}
              className="text-xs bg-gold/90 text-dark-bg px-3 py-1.5 rounded hover:bg-gold transition-colors font-medium"
            >
              Generate All Sessions
            </button>
          )}
          <DeletePlanButton planId={plan.id} onDeleted={() => {
          setPlan(null);
          setWeeks([]);
          setObjective(null);
          setWeekSessions({});
          setWorkoutLogs([]);
        }} />
        </div>
      </div>

      {/* Objective details */}
      {objective && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
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
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
          <h3 className="font-semibold text-white mb-2">Plan Philosophy</h3>
          <p className="text-sm text-dark-muted mb-3">{planSummary.philosophy}</p>
          <p className="text-sm text-dark-muted mb-3">{planSummary.weeklyStructure}</p>
          {planSummary.keyExercises && planSummary.keyExercises.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {planSummary.keyExercises.map((ex, i) => (
                <span key={i} className="bg-dark-border text-dark-muted text-xs px-2 py-1 rounded">
                  {ex}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Graduation workouts */}
      {plan.graduation_workouts && (
        <div className="bg-dark-card rounded-xl border border-gold/20 p-5">
          <h3 className="font-semibold text-gold mb-3">Graduation Workouts (Finish Line)</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const benchmarks = (plan.graduation_workouts as unknown as Record<string, Array<{ exerciseName: string; graduationTarget: string }>>)?.[dim];
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

      {/* Batch generation progress */}
      {batchGenerating && (
        <div className="bg-dark-card rounded-xl border border-gold/30 p-4 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-white">Generating all week sessions...</p>
            <p className="text-xs text-dark-muted">
              This runs in the background — you can expand individual weeks while it works.
            </p>
          </div>
        </div>
      )}
      {batchProgress && !batchGenerating && (
        <div className="bg-dark-card rounded-xl border border-green-800/40 p-4">
          <p className="text-sm text-green-400">
            Generated sessions for {batchProgress.generated} of {batchProgress.total} weeks.
          </p>
        </div>
      )}

      {/* Week list */}
      <div className="space-y-3">
        {weeks.map((week) => {
          const isExpanded = expandedWeek === week.week_number;
          const today = new Date();
          const weekStart = new Date(week.week_start);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const isCurrent = today >= weekStart && today < weekEnd;
          const isPast = today >= weekEnd;

          const sessions = weekSessions[week.week_number] || [];
          const isLoadingSessions = loadingSessions[week.week_number];
          const sessionError = sessionErrors[week.week_number];
          const weekLogs = getLogsForWeek(week);
          const hasLogs = weekLogs.length > 0;
          const completeResult = weekCompleteResult[week.week_number];
          const isCompleting = completingWeek === week.week_number;
          const canComplete = (week.week_type === "test" || week.week_type === "regular") && hasLogs && !completeResult;

          return (
            <div
              key={week.id}
              className={`bg-dark-card rounded-xl border overflow-hidden ${
                isCurrent ? "border-gold/40 ring-1 ring-gold/20" : "border-dark-border"
              }`}
            >
              {/* Week header */}
              <button
                onClick={() => handleWeekToggle(week.week_number)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white">Week {week.week_number}</span>
                  <WeekBadge type={week.week_type} />
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
                            : session.isBenchmarkSession
                            ? "border-test-blue/30 bg-test-blue/10"
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
                            {!logged && session.isBenchmarkSession && (
                              <span className="text-blue-300 text-sm">★</span>
                            )}
                            <span className={`font-medium text-sm ${logged ? "line-through opacity-60" : "text-white"}`}>
                              {session.name}
                            </span>
                            <span className="text-xs text-dark-muted">{session.estimatedMinutes} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!logged && (
                              <Link
                                href={`/log?session=${encodeURIComponent(session.name)}&planId=${plan.id}&week=${week.week_number}`}
                                className="text-xs bg-gold/90 text-dark-bg px-2.5 py-1 rounded hover:bg-gold transition-colors font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Log
                              </Link>
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
                                    <li key={ex.exerciseNumber} className={ex.isBenchmark ? "bg-test-blue/10 p-2 rounded border border-test-blue/20" : ""}>
                                      <span className="font-medium text-dark-text">{ex.exerciseNumber}. {ex.description}</span>
                                      <br />
                                      <span className="text-dark-muted">{ex.details}</span>
                                      {ex.isBenchmark && ex.graduationTarget && (
                                        <span className="block text-blue-300 text-xs mt-0.5">
                                          Graduation target: {ex.graduationTarget}
                                        </span>
                                      )}
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
                  {canComplete && (isPast || isCurrent) && (
                    <button
                      onClick={() => handleCompleteWeek(week)}
                      disabled={isCompleting}
                      className={`w-full mt-3 py-3 rounded-lg font-medium text-sm transition-colors ${
                        week.week_type === "test"
                          ? "bg-test-blue text-white hover:bg-test-blue/90"
                          : "bg-gold text-dark-bg hover:bg-gold/90"
                      } disabled:opacity-50`}
                    >
                      {isCompleting
                        ? "Recalculating Scores..."
                        : week.week_type === "test"
                        ? `Complete Test Week ${week.week_number} & Recalculate Scores`
                        : `Complete Week ${week.week_number} & Update Scores`
                      }
                    </button>
                  )}

                  {/* Score update result */}
                  {completeResult && (
                    <div className={`mt-3 rounded-lg p-4 border ${
                      completeResult.rebalanceTriggered
                        ? "bg-burnt-orange/10 border-burnt-orange/30"
                        : "bg-green-900/20 border-green-800/40"
                    }`}>
                      <h4 className="text-sm font-semibold text-white mb-2">
                        {completeResult.rebalanceTriggered
                          ? "Scores Updated — Rebalancing Triggered"
                          : "Scores Updated"
                        }
                      </h4>
                      <div className="flex gap-4 text-xs text-dark-text">
                        <span>C: {completeResult.updatedScores.cardio}</span>
                        <span>S: {completeResult.updatedScores.strength}</span>
                        <span>CT: {completeResult.updatedScores.climbing_technical}</span>
                        <span>F: {completeResult.updatedScores.flexibility}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
