import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Objective, Assessment, TrainingPlan, WeeklyTarget, ScoreHistory } from "@/lib/types";
import ScoreArc from "@/components/ScoreArc";
import WeekBadge from "@/components/WeekBadge";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch latest assessment
  const { data: assessments } = await supabase
    .from("assessments")
    .select("*")
    .eq("user_id", user.id)
    .order("assessed_at", { ascending: false })
    .limit(1);

  const latestAssessment = (assessments as Assessment[] | null)?.[0];

  // Fetch objectives
  const { data: objectives } = await supabase
    .from("objectives")
    .select("*")
    .eq("user_id", user.id)
    .order("target_date", { ascending: true });

  const userObjectives = objectives as Objective[] | null;

  // Fetch active plan
  const { data: plans } = await supabase
    .from("training_plans")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const activePlan = (plans as TrainingPlan[] | null)?.[0];

  // Fetch current week's targets if plan exists
  let currentWeekTarget: WeeklyTarget | null = null;
  let allWeekTargets: WeeklyTarget[] = [];
  if (activePlan) {
    const { data: weekTargets } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", activePlan.id)
      .order("week_number");

    allWeekTargets = (weekTargets as WeeklyTarget[]) || [];

    const today = new Date();
    currentWeekTarget = allWeekTargets.find((w) => {
      const weekStart = new Date(w.week_start);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return today >= weekStart && today < weekEnd;
    }) || allWeekTargets[0] || null;
  }

  // Fetch score history for the active objective
  const activeObjective = userObjectives?.[0];
  let scoreHistory: ScoreHistory[] = [];
  if (activeObjective) {
    const { data: history } = await supabase
      .from("score_history")
      .select("*")
      .eq("objective_id", activeObjective.id)
      .order("week_ending");
    scoreHistory = (history as ScoreHistory[]) || [];
  }

  // No assessment state
  if (!latestAssessment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-forest mb-4">Welcome to Summit Planner</h2>
        <p className="text-gray-600 mb-8">
          Start by taking a quick fitness assessment to establish your baseline scores.
        </p>
        <Link
          href="/assessment"
          className="inline-block bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          Take Your Fitness Assessment
        </Link>
      </div>
    );
  }

  // Has assessment but no objective
  if (!activeObjective) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-forest mb-4">Assessment Complete</h2>
        <p className="text-gray-600 mb-2">
          Cardio: {latestAssessment.cardio_score} | Strength: {latestAssessment.strength_score} |
          Climbing: {latestAssessment.climbing_score} | Flexibility: {latestAssessment.flexibility_score}
        </p>
        <p className="text-gray-600 mb-8">Now add your first summit objective to start training.</p>
        <Link
          href="/calendar"
          className="inline-block bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          Add Your First Objective
        </Link>
      </div>
    );
  }

  // Has objective but no plan
  if (!activePlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-forest mb-4">{activeObjective.name}</h2>
        <div className="flex justify-center gap-4 mb-4">
          <TierBadge tier={activeObjective.tier} />
          <span className="text-gray-500">
            Target: {new Date(activeObjective.target_date).toLocaleDateString()}
          </span>
        </div>
        <p className="text-gray-600 mb-8">Generate a training plan to start building toward your objective.</p>
        <Link
          href={`/plan?generate=true&objectiveId=${activeObjective.id}&assessmentId=${latestAssessment.id}`}
          className="inline-block bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          Generate Training Plan
        </Link>
      </div>
    );
  }

  // Full dashboard with plan
  const weeksRemaining = Math.ceil(
    (new Date(activeObjective.target_date).getTime() - Date.now()) /
      (7 * 24 * 60 * 60 * 1000)
  );

  const hasTestWeekData = scoreHistory.some((s) => s.is_test_week);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Estimated scores banner */}
      {!hasTestWeekData && (
        <div className="bg-test-blue/10 border border-test-blue/20 text-test-blue px-4 py-3 rounded-lg text-sm">
          Estimated scores — take your first benchmark test to calibrate.
        </div>
      )}

      {/* Objective countdown */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-forest">{activeObjective.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <TierBadge tier={activeObjective.tier} />
            <span className="text-sage text-sm">
              {new Date(activeObjective.target_date).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-forest">{weeksRemaining}</div>
          <div className="text-sm text-sage">weeks remaining</div>
        </div>
      </div>

      {/* Readiness section: 4 progress arcs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreArc
          label="Cardio"
          tagline={activeObjective.taglines?.cardio || ""}
          current={activeObjective.current_cardio_score}
          target={activeObjective.target_cardio_score}
        />
        <ScoreArc
          label="Strength"
          tagline={activeObjective.taglines?.strength || ""}
          current={activeObjective.current_strength_score}
          target={activeObjective.target_strength_score}
        />
        <ScoreArc
          label="Climbing"
          tagline={activeObjective.taglines?.climbing_technical || ""}
          current={activeObjective.current_climbing_score}
          target={activeObjective.target_climbing_score}
        />
        <ScoreArc
          label="Flexibility"
          tagline={activeObjective.taglines?.flexibility || ""}
          current={activeObjective.current_flexibility_score}
          target={activeObjective.target_flexibility_score}
        />
      </div>

      {/* This week summary */}
      {currentWeekTarget && (
        <div className="bg-white rounded-xl shadow-sm border border-sage/20 p-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-forest">This Week</h3>
            <WeekBadge type={currentWeekTarget.week_type} />
            <span className="text-sage text-sm ml-auto">
              Week {currentWeekTarget.week_number} · {currentWeekTarget.total_hours}h planned
            </span>
          </div>
          <div className="space-y-2">
            {currentWeekTarget.sessions.map((session, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  session.isBenchmarkSession
                    ? "border-test-blue/30 bg-test-blue/5"
                    : "border-sage/10 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {session.isBenchmarkSession && (
                    <span className="text-test-blue">★</span>
                  )}
                  <span className="font-medium text-sm">{session.name}</span>
                  <span className="text-sage text-xs">{session.estimatedMinutes} min</span>
                </div>
                <Link
                  href={`/log?session=${encodeURIComponent(session.name)}&planId=${activePlan.id}&week=${currentWeekTarget.week_number}`}
                  className="text-sm bg-forest text-white px-3 py-1 rounded hover:bg-forest/90 transition-colors"
                >
                  Mark Complete
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graduation benchmarks */}
      {activeObjective.graduation_benchmarks && (
        <div className="bg-white rounded-xl shadow-sm border border-sage/20 p-6">
          <h3 className="text-lg font-semibold text-forest mb-4">Graduation Benchmarks</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const benchmarks = activeObjective.graduation_benchmarks?.[dim];
              if (!benchmarks || benchmarks.length === 0) return null;
              return (
                <div key={dim} className="space-y-2">
                  <h4 className="text-sm font-semibold text-forest capitalize">
                    {dim.replace("_", " / ")}
                  </h4>
                  {benchmarks.map((b, i) => (
                    <div key={i} className="text-sm text-gray-600 pl-3 border-l-2 border-sage/30">
                      <span className="font-medium">{b.exerciseName}</span>: {b.graduationTarget}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/plan"
          className="flex-1 text-center py-3 bg-forest text-white rounded-lg font-medium hover:bg-forest/90 transition-colors"
        >
          View Full Plan
        </Link>
        <Link
          href="/progress"
          className="flex-1 text-center py-3 border-2 border-forest text-forest rounded-lg font-medium hover:bg-forest hover:text-white transition-colors"
        >
          View Progress
        </Link>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors = {
    gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
    silver: "bg-gray-100 text-gray-700 border-gray-300",
    bronze: "bg-orange-100 text-orange-800 border-orange-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-semibold rounded border ${
        colors[tier as keyof typeof colors] || colors.bronze
      }`}
    >
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </span>
  );
}
