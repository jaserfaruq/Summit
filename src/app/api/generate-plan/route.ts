import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { GeneratePlanRequest } from "@/lib/types";
import { generateWeekSchedule, expectedScoresAtWeek } from "@/lib/scoring";
import { fetchHeroImageUrl } from "@/lib/unsplash";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GeneratePlanRequest = await request.json();
  const { objectiveId, assessmentId } = body;

  // Fetch objective
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", objectiveId)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
  }

  // Fetch assessment
  const { data: assessment, error: assError } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (assError || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Calculate weeks available
  const now = new Date();
  const targetDate = new Date(objective.target_date);
  const totalWeeks = Math.max(
    4,
    Math.floor((targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
  );

  // Build week schedule algorithmically — no Claude call needed
  const weekTypes = generateWeekSchedule(totalWeeks);
  const daysPerWeek = profile?.training_days_per_week || 5;

  const currentScores = {
    cardio: assessment.cardio_score,
    strength: assessment.strength_score,
    climbing_technical: assessment.climbing_score,
    flexibility: assessment.flexibility_score,
  };

  const targetScores = {
    cardio: objective.target_cardio_score,
    strength: objective.target_strength_score,
    climbing_technical: objective.target_climbing_score,
    flexibility: objective.target_flexibility_score,
  };

  // Base hours: scale by training days, cap at 10 for recreational athletes
  const baseHours = Math.min(daysPerWeek * 1.2, 10);

  const weeks = weekTypes.map((weekType, i) => {
    const weekNumber = i + 1;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Volume scaling by week type
    let volumeMultiplier = 1.0;
    if (weekType === "test") volumeMultiplier = 0.8;
    else if (weekType === "taper") volumeMultiplier = 0.6;

    // Progressive volume: ramp up ~5% per week, capped by week type
    const progressionFactor = Math.min(1.0, 0.7 + (weekNumber / totalWeeks) * 0.3);
    const totalHours = Math.round(baseHours * volumeMultiplier * progressionFactor * 10) / 10;

    return {
      weekNumber,
      weekStartDate: weekStartStr,
      weekType,
      totalHoursTarget: totalHours,
      expectedScores: expectedScoresAtWeek(currentScores, targetScores, weekNumber, totalWeeks),
    };
  });

  const planSummary = {
    philosophy: buildPlanPhilosophy(objective.name, currentScores, targetScores, objective.taglines, totalWeeks),
    weeklyStructure: `${daysPerWeek} sessions per week across cardio, strength, climbing/technical, and flexibility. Sessions are generated on-demand when you expand each week.`,
    equipmentNeeded: profile?.equipment_access || ["basic gym equipment"],
    keyExercises: extractKeyExercises(objective.graduation_benchmarks),
  };

  // Fetch hero image (non-blocking — plan still works without it)
  let heroImageUrl: string | null = null;
  try {
    heroImageUrl = await fetchHeroImageUrl(objective.name);
  } catch (error) {
    console.warn("Hero image fetch failed, continuing without:", error);
  }

  try {
    // Store the plan
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        user_id: user.id,
        objective_id: objectiveId,
        assessment_id: assessmentId,
        plan_data: {
          planSummary,
          heroImageUrl,
          weeks: weeks.map((w) => ({ ...w, sessions: [] })),
        },
        graduation_workouts: objective.graduation_benchmarks,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to save plan:", planError);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    // Store weekly targets with empty sessions
    const weeklyTargets = weeks.map((week) => ({
      plan_id: plan.id,
      week_number: week.weekNumber,
      week_start: week.weekStartDate,
      week_type: week.weekType,
      total_hours: week.totalHoursTarget,
      expected_scores: week.expectedScores,
      sessions: [], // Generated on-demand via /api/generate-week-sessions
    }));

    const { error: weekError } = await supabase
      .from("weekly_targets")
      .insert(weeklyTargets);

    if (weekError) {
      console.error("Error saving weekly targets:", weekError);
    }

    // Update current scores on objective from assessment
    await supabase
      .from("objectives")
      .update({
        current_cardio_score: assessment.cardio_score,
        current_strength_score: assessment.strength_score,
        current_climbing_score: assessment.climbing_score,
        current_flexibility_score: assessment.flexibility_score,
      })
      .eq("id", objectiveId);

    return NextResponse.json({
      planId: plan.id,
      weekCount: weeks.length,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: "Failed to generate plan. Please try again." },
      { status: 500 }
    );
  }
}

const DIM_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  climbing_technical: "Climbing/Technical",
  flexibility: "Flexibility",
};

/**
 * Build a data-driven plan philosophy that explains WHY the plan
 * is structured the way it is, based on actual score gaps.
 */
function buildPlanPhilosophy(
  objectiveName: string,
  current: Record<string, number>,
  target: Record<string, number>,
  taglines: Record<string, string> | null,
  totalWeeks: number
): string {
  const dims = ["cardio", "strength", "climbing_technical", "flexibility"];

  // Categorize each dimension
  const bigGaps: { dim: string; gap: number; pct: number }[] = [];
  const moderateGaps: { dim: string; gap: number }[] = [];
  const maintenance: { dim: string }[] = [];
  const minimal: { dim: string }[] = [];

  for (const dim of dims) {
    const cur = current[dim] ?? 0;
    const tgt = target[dim] ?? 0;
    const gap = tgt - cur;
    const pctBehind = tgt > 0 ? Math.round((gap / tgt) * 100) : 0;

    if (cur >= tgt) {
      maintenance.push({ dim });
    } else if (pctBehind >= 50) {
      bigGaps.push({ dim, gap, pct: pctBehind });
    } else if (gap >= 10) {
      moderateGaps.push({ dim, gap });
    } else {
      minimal.push({ dim });
    }
  }

  // Sort big gaps by size (largest first)
  bigGaps.sort((a, b) => b.pct - a.pct);

  const parts: string[] = [];

  // Opening line
  parts.push(`This ${totalWeeks}-week plan prepares you for ${objectiveName}.`);

  // Big gaps — these drive the plan's focus
  if (bigGaps.length > 0) {
    const gapDescriptions = bigGaps.map((g) => {
      const label = DIM_LABELS[g.dim];
      const tagline = taglines?.[g.dim];
      const taglineSuffix = tagline ? ` — ${tagline.toLowerCase()}` : "";
      return `${label} (${current[g.dim]} → ${target[g.dim]}${taglineSuffix})`;
    });

    if (bigGaps.length === 1) {
      parts.push(`Your biggest priority is ${gapDescriptions[0]}. The plan dedicates the most training volume here to close this gap.`);
    } else {
      parts.push(`Your biggest gaps are in ${gapDescriptions.join(" and ")}. The plan prioritizes these dimensions with the most training volume.`);
    }
  }

  // Moderate gaps
  if (moderateGaps.length > 0) {
    const labels = moderateGaps.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${moderateGaps.length === 1 ? "needs" : "need"} steady progression to reach target.`);
  }

  // Maintenance dimensions
  if (maintenance.length > 0) {
    const labels = maintenance.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${maintenance.length === 1 ? "is" : "are"} already at or above target — the plan maintains ${maintenance.length === 1 ? "this" : "these"} with reduced volume and reallocates that time to weaker areas.`);
  }

  // Minimal gaps (close to target)
  if (minimal.length > 0 && bigGaps.length > 0) {
    const labels = minimal.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${minimal.length === 1 ? "is" : "are"} close to target and ${minimal.length === 1 ? "needs" : "need"} only light work.`);
  }

  // Periodization note
  const testWeekCount = Math.floor(totalWeeks / 4);
  parts.push(`Test weeks every ~4 weeks (${testWeekCount} total) calibrate your progress with benchmark workouts, followed by a 2-week taper to peak on your target date.`);

  return parts.join(" ");
}

// Extract exercise names from graduation benchmarks for the plan summary
function extractKeyExercises(graduationBenchmarks: unknown): string[] {
  const exercises: string[] = [];
  if (!graduationBenchmarks || typeof graduationBenchmarks !== "object") return exercises;
  const benchmarks = graduationBenchmarks as Record<string, Array<{ exerciseName?: string }>>;
  for (const dim of Object.keys(benchmarks)) {
    const dimBenchmarks = benchmarks[dim];
    if (Array.isArray(dimBenchmarks)) {
      for (const b of dimBenchmarks) {
        if (b.exerciseName) exercises.push(b.exerciseName);
      }
    }
  }
  return exercises;
}
