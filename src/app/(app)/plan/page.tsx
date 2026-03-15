"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession } from "@/lib/types";
import WeekBadge from "@/components/WeekBadge";
import Link from "next/link";

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8"><div className="animate-pulse h-8 bg-sage/20 rounded w-1/3" /></div>}>
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

  // Track session loading/error state per week
  const [loadingSessions, setLoadingSessions] = useState<Record<number, boolean>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<number, string>>({});
  // Cache loaded sessions per week
  const [weekSessions, setWeekSessions] = useState<Record<number, PlanSession[]>>({});

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

    // Pre-populate cached sessions for weeks that already have them
    const cached: Record<number, PlanSession[]> = {};
    for (const w of weeksArr) {
      if (w.sessions && w.sessions.length > 0) {
        cached[w.week_number] = w.sessions;
      }
    }
    setWeekSessions(cached);

    const { data: objData } = await supabase
      .from("objectives")
      .select("*")
      .eq("id", activePlan.objective_id)
      .single();

    setObjective(objData as Objective);

    // Expand current week
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

      router.replace("/plan");
      await fetchPlan();
    } catch (error) {
      console.error("Plan generation error:", error);
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate plan. Please try again."
      );
    }
    setGenerating(false);
  }

  // Load sessions for a specific week on-demand
  async function loadWeekSessions(weekNumber: number) {
    if (!plan) return;

    // Already loaded
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
        body: JSON.stringify({
          planId: plan.id,
          weekNumber,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load sessions");
      }

      const { sessions } = await res.json();
      setWeekSessions((prev) => ({ ...prev, [weekNumber]: sessions }));
    } catch (error) {
      console.error(`Error loading sessions for week ${weekNumber}:`, error);
      setSessionErrors((prev) => ({
        ...prev,
        [weekNumber]: error instanceof Error ? error.message : "Failed to load sessions",
      }));
    }

    setLoadingSessions((prev) => ({ ...prev, [weekNumber]: false }));
  }

  // When a week is expanded, trigger session loading
  function handleWeekToggle(weekNumber: number) {
    const isExpanded = expandedWeek === weekNumber;
    const newExpanded = isExpanded ? null : weekNumber;
    setExpandedWeek(newExpanded);

    if (newExpanded !== null) {
      loadWeekSessions(newExpanded);
    }
  }

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        {generateError ? (
          <div>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-forest mb-2">Plan Generation Failed</h2>
            <p className="text-red-600 mb-6">{generateError}</p>
            <button
              onClick={() => {
                if (objectiveId && assessmentId) {
                  generatePlan(objectiveId, assessmentId);
                }
              }}
              className="bg-forest text-white px-6 py-3 rounded-lg font-medium hover:bg-forest/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="animate-pulse">
            <div className="text-4xl mb-4">⛰️</div>
            <h2 className="text-2xl font-bold text-forest mb-2">Generating Your Training Plan</h2>
            <p className="text-sage">
              Our AI coach is designing a periodized plan tailored to your objective and current fitness...
            </p>
            <div className="mt-8 w-12 h-12 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-sage/20 rounded w-1/3" />
          <div className="h-4 bg-sage/20 rounded w-1/2" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-sage/20 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-forest mb-4">No Active Plan</h2>
        <p className="text-sage mb-8">Add an objective and complete your assessment to generate a training plan.</p>
        <Link
          href="/dashboard"
          className="inline-block bg-forest text-white px-6 py-3 rounded-lg font-medium hover:bg-forest/90 transition-colors"
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
      <div>
        <h2 className="text-2xl font-bold text-forest">{objective?.name}</h2>
        <p className="text-sage text-sm">
          {weeks.length} weeks · Target: {objective?.target_date ? new Date(objective.target_date).toLocaleDateString() : ""}
        </p>
      </div>

      {/* Plan summary */}
      {planSummary && (
        <div className="bg-white rounded-xl shadow-sm border border-sage/20 p-5">
          <h3 className="font-semibold text-forest mb-2">Plan Philosophy</h3>
          <p className="text-sm text-gray-600 mb-3">{planSummary.philosophy}</p>
          <p className="text-sm text-gray-600 mb-3">{planSummary.weeklyStructure}</p>
          {planSummary.keyExercises && planSummary.keyExercises.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {planSummary.keyExercises.map((ex, i) => (
                <span key={i} className="bg-sage/10 text-sage text-xs px-2 py-1 rounded">
                  {ex}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Graduation workouts */}
      {plan.graduation_workouts && (
        <div className="bg-forest/5 rounded-xl border border-forest/20 p-5">
          <h3 className="font-semibold text-forest mb-3">Graduation Workouts (Finish Line)</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const benchmarks = (plan.graduation_workouts as unknown as Record<string, Array<{ exerciseName: string; graduationTarget: string }>>)?.[dim];
              if (!benchmarks || benchmarks.length === 0) return null;
              return (
                <div key={dim}>
                  <h4 className="text-xs font-semibold text-forest uppercase mb-1">{dim.replace("_", " / ")}</h4>
                  {benchmarks.map((b, i) => (
                    <p key={i} className="text-sm text-gray-600">
                      {b.exerciseName}: <strong>{b.graduationTarget}</strong>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
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

          const sessions = weekSessions[week.week_number] || [];
          const isLoadingSessions = loadingSessions[week.week_number];
          const sessionError = sessionErrors[week.week_number];

          return (
            <div
              key={week.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                isCurrent ? "border-forest ring-1 ring-forest/20" : "border-sage/20"
              }`}
            >
              {/* Week header */}
              <button
                onClick={() => handleWeekToggle(week.week_number)}
                className="w-full px-5 py-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-forest">Week {week.week_number}</span>
                  <WeekBadge type={week.week_type} />
                  {isCurrent && (
                    <span className="text-xs bg-forest text-white px-2 py-0.5 rounded">Current</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-sage">
                    {new Date(week.week_start).toLocaleDateString()} · {week.total_hours}h
                  </span>
                  <span className="text-sage">{isExpanded ? "▾" : "▸"}</span>
                </div>
              </button>

              {/* Expected scores bar */}
              {week.expected_scores && (
                <div className="px-5 pb-2 flex gap-4 text-xs text-sage">
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
                      <div className="w-8 h-8 border-3 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-sage">Generating sessions for Week {week.week_number}...</p>
                    </div>
                  )}

                  {sessionError && !isLoadingSessions && (
                    <div className="py-4 text-center bg-red-50 rounded-lg border border-red-200">
                      <p className="text-sm text-red-600 mb-3">{sessionError}</p>
                      <button
                        onClick={() => loadWeekSessions(week.week_number)}
                        className="text-sm bg-forest text-white px-4 py-2 rounded hover:bg-forest/90 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isLoadingSessions && !sessionError && sessions.length === 0 && (
                    <div className="py-4 text-center text-sage text-sm">
                      No sessions generated yet. They should appear shortly.
                    </div>
                  )}

                  {sessions.map((session: PlanSession, i: number) => {
                    const sessionKey = `${week.week_number}-${i}`;
                    const isSessionExpanded = expandedSession === sessionKey;

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border ${
                          session.isBenchmarkSession
                            ? "border-test-blue/30 bg-test-blue/5"
                            : "border-sage/10 bg-gray-50"
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
                            {session.isBenchmarkSession && (
                              <span className="text-test-blue text-sm">★</span>
                            )}
                            <span className="font-medium text-sm">{session.name}</span>
                            <span className="text-xs text-sage">{session.estimatedMinutes} min</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/log?session=${encodeURIComponent(session.name)}&planId=${plan.id}&week=${week.week_number}`}
                              className="text-xs bg-forest text-white px-2.5 py-1 rounded hover:bg-forest/90 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Log
                            </Link>
                            <span className="text-sage text-xs">{isSessionExpanded ? "▾" : "▸"}</span>
                          </div>
                        </button>

                        {isSessionExpanded && (
                          <div className="px-4 pb-4 space-y-3">
                            <p className="text-sm text-gray-600 italic">{session.objective}</p>

                            {/* Warm-up */}
                            {session.warmUp && (
                              <div>
                                <h5 className="text-xs font-semibold text-sage uppercase mb-1">
                                  Warm-Up ({session.warmUp.rounds} round{session.warmUp.rounds > 1 ? "s" : ""})
                                </h5>
                                <ul className="text-sm text-gray-600 space-y-0.5">
                                  {session.warmUp.exercises.map((ex, j) => (
                                    <li key={j}>• {ex.name} — {ex.reps}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Training */}
                            {session.training && (
                              <div>
                                <h5 className="text-xs font-semibold text-sage uppercase mb-1">Training</h5>
                                <ol className="text-sm text-gray-600 space-y-1.5">
                                  {session.training.map((ex) => (
                                    <li key={ex.exerciseNumber} className={ex.isBenchmark ? "bg-test-blue/5 p-2 rounded" : ""}>
                                      <span className="font-medium">{ex.exerciseNumber}. {ex.description}</span>
                                      <br />
                                      <span className="text-gray-500">{ex.details}</span>
                                      {ex.isBenchmark && ex.graduationTarget && (
                                        <span className="block text-test-blue text-xs mt-0.5">
                                          Graduation target: {ex.graduationTarget}
                                        </span>
                                      )}
                                      {ex.intensityNote && (
                                        <span className="block text-sage text-xs italic">{ex.intensityNote}</span>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Cooldown */}
                            {session.cooldown && (
                              <div>
                                <h5 className="text-xs font-semibold text-sage uppercase mb-1">Cooldown</h5>
                                <p className="text-sm text-gray-600">{session.cooldown}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
