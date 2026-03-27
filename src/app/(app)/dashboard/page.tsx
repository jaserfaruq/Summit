import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Objective, Assessment, TrainingPlan, WeeklyTarget, ValidatedObjective } from "@/lib/types";
import ScoreArc from "@/components/ScoreArc";
import DeletePlanButton from "@/components/DeletePlanButton";
import DeleteAssessmentButton from "@/components/DeleteAssessmentButton";
import UpdateAssessmentButton from "@/components/UpdateAssessmentButton";
import ThisWeekSessions from "@/components/ThisWeekSessions";
import PartnerNotificationBanner from "@/components/PartnerNotificationBanner";
import AddObjectiveButton from "@/components/AddObjectiveButton";

function formatDimLabel(dim: string) {
  return dim.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" / ");
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

  // No objective — first CTA
  if (!activeObjective) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <h2 className="text-3xl font-bold text-white mb-3">Welcome to Summit Planner</h2>
        <p className="text-white/80 mb-8 leading-relaxed drop-shadow-md">
          Start by adding your first summit objective, then we&apos;ll assess your fitness for it.
        </p>
        <AddObjectiveButton />
      </div>
    );
  }

  // Has objective but no assessment
  const objectiveAssessment = latestAssessment?.objective_id === activeObjective.id
    ? latestAssessment
    : null;

  if (!objectiveAssessment) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <h2 className="text-3xl font-bold text-white mb-3">{activeObjective.name}</h2>
        <p className="text-white/70 mb-8 leading-relaxed drop-shadow-md">
          Assess your current fitness so we can build a plan calibrated to this objective.
        </p>
        <Link
          href={`/assessment/${activeObjective.id}`}
          className="btn-press inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Assess Your Fitness
        </Link>
      </div>
    );
  }

  // Has assessment but no plan
  if (!activePlan) {
    const scores = [
      { label: "Cardio", value: objectiveAssessment.cardio_score },
      { label: "Strength", value: objectiveAssessment.strength_score },
      { label: "Climbing", value: objectiveAssessment.climbing_score },
      { label: "Flexibility", value: objectiveAssessment.flexibility_score },
    ];
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in-up">
        <h2 className="text-3xl font-bold text-white mb-3">{activeObjective.name}</h2>
        <div className="flex justify-center gap-6 mb-2">
          {scores.map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-xl font-bold text-gold tabular-nums">{value}</div>
              <div className="text-xs text-white/60 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-white/60 mb-8 text-sm drop-shadow-md">Assessment complete. Ready to generate your plan.</p>
        <div className="flex flex-col items-center gap-3">
          <Link
            href={`/plan?generate=true&objectiveId=${activeObjective.id}&assessmentId=${objectiveAssessment.id}`}
            className="btn-press inline-block bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-3 px-8 rounded-lg transition-colors"
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

  // Full dashboard
  const weeksRemaining = Math.ceil(
    (new Date(activeObjective.target_date).getTime() - Date.now()) /
      (7 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

      {/* Objective header */}
      <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white leading-tight">{activeObjective.name}</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <TierBadge tier={activeObjective.tier} />
              <span className="text-white/60 text-sm">{formatDate(activeObjective.target_date)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-3xl font-bold text-gold tabular-nums leading-none">{weeksRemaining}</div>
              <div className="text-[11px] text-white/60 uppercase tracking-widest mt-1">weeks out</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-dark-border/50">
          <UpdateAssessmentButton planId={activePlan.id} objectiveId={activeObjective.id} />
          <DeletePlanButton planId={activePlan.id} />
        </div>
      </div>

      {/* Objective details */}
      <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-5 animate-fade-in-up stagger-2">
        {validatedObjective?.description ? (
          <p className="text-sm text-dark-text/70 mb-3 leading-relaxed">{validatedObjective.description}</p>
        ) : activeObjective.relevance_profiles && typeof activeObjective.relevance_profiles === "object" && "cardio" in activeObjective.relevance_profiles && (
          <p className="text-sm text-dark-text/70 mb-3 leading-relaxed">
            {(activeObjective.relevance_profiles as { cardio: { summary: string } }).cardio.summary}
          </p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-dark-muted">Type </span>
            <span className="text-dark-text capitalize">{activeObjective.type.replace(/_/g, " ")}</span>
          </div>
          {validatedObjective?.route && (
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

      {/* Readiness */}
      <div className="animate-fade-in-up stagger-3">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-3">Readiness</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreArc
            label="Cardio"
            tagline={activeObjective.taglines?.cardio || ""}
            current={activeObjective.current_cardio_score}
            target={activeObjective.target_cardio_score}
            animationDelay={0}
          />
          <ScoreArc
            label="Strength"
            tagline={activeObjective.taglines?.strength || ""}
            current={activeObjective.current_strength_score}
            target={activeObjective.target_strength_score}
            animationDelay={100}
          />
          <ScoreArc
            label="Climbing"
            tagline={activeObjective.taglines?.climbing_technical || ""}
            current={activeObjective.current_climbing_score}
            target={activeObjective.target_climbing_score}
            animationDelay={200}
          />
          <ScoreArc
            label="Flexibility"
            tagline={activeObjective.taglines?.flexibility || ""}
            current={activeObjective.current_flexibility_score}
            target={activeObjective.target_flexibility_score}
            animationDelay={300}
          />
        </div>
      </div>

      {/* This week */}
      {currentWeekTarget && (
        <div className="animate-fade-in-up stagger-4">
          <ThisWeekSessions
            weekTarget={currentWeekTarget}
            planId={activePlan.id}
          />
        </div>
      )}

      {/* Partner notification */}
      <div className="animate-fade-in-up stagger-4">
        <PartnerNotificationBanner />
      </div>

      {/* Graduation benchmarks */}
      {activeObjective.graduation_benchmarks && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 p-6 animate-fade-in-up stagger-5">
          <h3 className="text-lg font-semibold text-white mb-4">Graduation Benchmarks</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const benchmarks = activeObjective.graduation_benchmarks?.[dim];
              if (!benchmarks || benchmarks.length === 0) return null;
              return (
                <div key={dim} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gold uppercase tracking-wide">
                    {formatDimLabel(dim)}
                  </h4>
                  {benchmarks.map((b, i) => (
                    <div key={i} className="text-sm text-dark-muted pl-3 border-l-2 border-dark-border">
                      <span className="font-medium text-dark-text">{b.exerciseName}</span>
                      <span className="text-dark-muted"> — {b.graduationTarget}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-3 pb-2 animate-fade-in-up stagger-6">
        <Link
          href="/plan"
          className="btn-press flex-1 text-center py-3 bg-gold text-dark-bg rounded-lg font-semibold hover:bg-gold/90 transition-colors text-sm"
        >
          View Full Plan
        </Link>
        <Link
          href="/progress"
          className="btn-press flex-1 text-center py-3 bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 text-dark-text rounded-lg font-semibold hover:bg-dark-card transition-colors text-sm"
        >
          View Progress
        </Link>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const colors = {
    gold: "bg-medal-gold/20 text-medal-gold border-medal-gold/30",
    silver: "bg-white/10 text-white/70 border-white/20",
    bronze: "bg-burnt-orange/20 text-burnt-orange border-burnt-orange/30",
  };
  const isGold = tier === "gold";
  return (
    <span
      className={`relative inline-block px-2 py-0.5 text-xs font-semibold rounded border overflow-hidden ${
        colors[tier as keyof typeof colors] || colors.bronze
      }`}
    >
      {isGold && <span className="absolute inset-0 tier-gold-shimmer" />}
      <span className="relative">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
    </span>
  );
}
