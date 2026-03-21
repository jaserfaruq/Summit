import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Objective, Assessment, TrainingPlan, WeeklyTarget, ValidatedObjective } from "@/lib/types";
import ScoreArc from "@/components/ScoreArc";
import DeletePlanButton from "@/components/DeletePlanButton";
import DeleteAssessmentButton from "@/components/DeleteAssessmentButton";
import UpdateAssessmentButton from "@/components/UpdateAssessmentButton";
import ThisWeekSessions from "@/components/ThisWeekSessions";

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

    currentWeekTarget = allWeekTargets.find(
      (w) => w.week_number === activePlan.current_week_number
    ) || allWeekTargets[0] || null;
  }

  // Fetch validated objective for display
  const activeObjective = userObjectives?.[0];
  let validatedObjective: ValidatedObjective | null = null;
  if (activeObjective) {
    if (activeObjective.matched_validated_id) {
      const { data: vo } = await supabase
        .from("validated_objectives")
        .select("*")
        .eq("id", activeObjective.matched_validated_id)
        .single();
      validatedObjective = vo as ValidatedObjective | null;
    }
  }

  // No objective — first CTA is to add one
  if (!activeObjective) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Welcome to Summit Planner</h2>
        <p className="text-dark-muted mb-8">
          Start by adding your first summit objective, then we&apos;ll assess your fitness for it.
        </p>
        <Link
          href="/calendar"
          className="inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          Add Your First Objective
        </Link>
      </div>
    );
  }

  // Has objective but no assessment for it — assess fitness
  // Check for an assessment linked to this specific objective
  const objectiveAssessment = latestAssessment?.objective_id === activeObjective.id
    ? latestAssessment
    : null;

  if (!objectiveAssessment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{activeObjective.name}</h2>
        <p className="text-dark-muted mb-8">
          Assess your current fitness level for this objective so we can build your training plan.
        </p>
        <Link
          href={`/assessment/${activeObjective.id}`}
          className="inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
        >
          Assess Your Fitness for {activeObjective.name}
        </Link>
      </div>
    );
  }

  // Has assessment but no plan — generate plan
  if (!activePlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">{activeObjective.name}</h2>
        <p className="text-dark-muted mb-2">
          Cardio: {objectiveAssessment.cardio_score} | Strength: {objectiveAssessment.strength_score} |
          Climbing: {objectiveAssessment.climbing_score} | Flexibility: {objectiveAssessment.flexibility_score}
        </p>
        <p className="text-dark-muted mb-8">Assessment complete. Generate your training plan.</p>
        <div className="flex flex-col items-center gap-4">
          <Link
            href={`/plan?generate=true&objectiveId=${activeObjective.id}&assessmentId=${objectiveAssessment.id}`}
            className="inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors text-lg"
          >
            Generate Training Plan
          </Link>
          <DeleteAssessmentButton
            assessmentId={objectiveAssessment.id}
            objectiveId={activeObjective.id}
          />
        </div>
      </div>
    );
  }

  // Full dashboard with plan
  const weeksRemaining = Math.ceil(
    (new Date(activeObjective.target_date).getTime() - Date.now()) /
      (7 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

      {/* Objective countdown */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{activeObjective.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <TierBadge tier={activeObjective.tier} />
            <span className="text-dark-muted text-sm">
              {new Date(activeObjective.target_date).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-gold">{weeksRemaining}</div>
            <div className="text-sm text-dark-muted">weeks remaining</div>
          </div>
          <UpdateAssessmentButton planId={activePlan.id} objectiveId={activeObjective.id} />
          <DeletePlanButton planId={activePlan.id} />
        </div>
      </div>

      {/* Objective details */}
      <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5">
        {validatedObjective?.description ? (
          <p className="text-sm text-dark-muted mb-3">{validatedObjective.description}</p>
        ) : activeObjective.relevance_profiles && typeof activeObjective.relevance_profiles === "object" && "cardio" in activeObjective.relevance_profiles && (
          <p className="text-sm text-dark-muted mb-3">
            {(activeObjective.relevance_profiles as { cardio: { summary: string } }).cardio.summary}
          </p>
        )}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div>
            <span className="text-dark-muted">Type </span>
            <span className="text-dark-text capitalize">{activeObjective.type.replace("_", " ")}</span>
          </div>
          {(validatedObjective?.route) && (
            <div>
              <span className="text-dark-muted">Route </span>
              <span className="text-dark-text">{validatedObjective.route}</span>
            </div>
          )}
          {(activeObjective.distance_miles || validatedObjective?.distance_miles) && (
            <div>
              <span className="text-dark-muted">Distance </span>
              <span className="text-dark-text">{activeObjective.distance_miles || validatedObjective?.distance_miles} mi</span>
            </div>
          )}
          {(activeObjective.elevation_gain_ft || validatedObjective?.total_gain_ft) && (
            <div>
              <span className="text-dark-muted">Gain </span>
              <span className="text-dark-text">{(activeObjective.elevation_gain_ft || validatedObjective?.total_gain_ft)?.toLocaleString()} ft</span>
            </div>
          )}
          {validatedObjective?.summit_elevation_ft && (
            <div>
              <span className="text-dark-muted">Summit </span>
              <span className="text-dark-text">{validatedObjective.summit_elevation_ft.toLocaleString()} ft</span>
            </div>
          )}
          {(activeObjective.technical_grade || validatedObjective?.technical_grade) && (
            <div>
              <span className="text-dark-muted">Grade </span>
              <span className="text-dark-text">{activeObjective.technical_grade || validatedObjective?.technical_grade}</span>
            </div>
          )}
          {validatedObjective?.difficulty && (
            <div>
              <span className="text-dark-muted">Difficulty </span>
              <span className="text-dark-text capitalize">{validatedObjective.difficulty}</span>
            </div>
          )}
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
        <ThisWeekSessions
          weekTarget={currentWeekTarget}
          planId={activePlan.id}
        />
      )}

      {/* Graduation benchmarks */}
      {activeObjective.graduation_benchmarks && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Graduation Benchmarks</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const benchmarks = activeObjective.graduation_benchmarks?.[dim];
              if (!benchmarks || benchmarks.length === 0) return null;
              return (
                <div key={dim} className="space-y-2">
                  <h4 className="text-sm font-semibold text-gold capitalize">
                    {dim.replace("_", " / ")}
                  </h4>
                  {benchmarks.map((b, i) => (
                    <div key={i} className="text-sm text-dark-muted pl-3 border-l-2 border-dark-border">
                      <span className="font-medium text-dark-text">{b.exerciseName}</span>: {b.graduationTarget}
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
          className="flex-1 text-center py-3 bg-gold text-dark-bg rounded-lg font-medium hover:bg-gold/90 transition-colors"
        >
          View Full Plan
        </Link>
        <Link
          href="/progress"
          className="flex-1 text-center py-3 border border-dark-border text-dark-text rounded-lg font-medium hover:bg-dark-card transition-colors"
        >
          View Progress
        </Link>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors = {
    gold: "bg-gold/20 text-gold border-gold/30",
    silver: "bg-white/10 text-white/70 border-white/20",
    bronze: "bg-burnt-orange/20 text-burnt-orange border-burnt-orange/30",
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
