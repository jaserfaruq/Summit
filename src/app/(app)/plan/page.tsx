"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession } from "@/lib/types";
import WeekBadge from "@/components/WeekBadge";
import Link from "next/link";

export default function PlanPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [weeks, setWeeks] = useState<WeeklyTarget[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [generating, setGenerating] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shouldGenerate = searchParams.get("generate") === "true";
  const objectiveId = searchParams.get("objectiveId");
  const assessmentId = searchParams.get("assessmentId");

  useEffect(() => {
    if (shouldGenerate && objectiveId && assessmentId) {
      generatePlan(objectiveId, assessmentId);
    } else {
      fetchPlan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPlan() {
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

    setWeeks((weekData as WeeklyTarget[]) || []);

    const { data: objData } = await supabase
      .from("objectives")
      .select("*")
      .eq("id", activePlan.objective_id)
      .single();

    setObjective(objData as Objective);

    // Expand current week
    const today = new Date();
    const currentWeek = (weekData as WeeklyTarget[])?.find((w) => {
      const start = new Date(w.week_start);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return today >= start && today < end;
    });
    if (currentWeek) setExpandedWeek(currentWeek.week_number);

    setLoading(false);
  }

  async function generatePlan(objId: string, assId: string) {
    setGenerating(true);
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
        throw new Error("Failed to generate plan");
      }

      router.replace("/plan");
      fetchPlan();
    } catch (error) {
      console.error("Plan generation error:", error);
    }
    setGenerating(false);
  }

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse">
          <div className="text-4xl mb-4">⛰️</div>
          <h2 className="text-2xl font-bold text-forest mb-2">Generating Your Training Plan</h2>
          <p className="text-sage">
            Our AI coach is designing a periodized plan tailored to your objective and current fitness...
          </p>
          <div className="mt-8 w-12 h-12 border-4 border-forest border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
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
          <h3 className="font-semibold text-forest mb-3">🏁 Graduation Workouts (Finish Line)</h3>
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

          return (
            <div
              key={week.id}
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                isCurrent ? "border-forest ring-1 ring-forest/20" : "border-sage/20"
              }`}
            >
              {/* Week header */}
              <button
                onClick={() => setExpandedWeek(isExpanded ? null : week.week_number)}
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
                  {week.sessions.map((session: PlanSession, i: number) => {
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
