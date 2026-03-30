import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import {
  AdjustDifficultyRequest,
  DimensionScores,
  DifficultyAdjustment,
  DimensionGraduationBenchmarks,
  DIFFICULTY_SCALE_FACTORS,
  PlanData,
} from "@/lib/types";
import { expectedScoresAtWeek, scaleDifficultyTargets, classifyGaps } from "@/lib/scoring";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_RESCALE_BENCHMARKS_SYSTEM } from "@/lib/prompts";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: AdjustDifficultyRequest = await request.json();
  const { planId, level } = body;

  const scaleFactor = DIFFICULTY_SCALE_FACTORS[level];
  if (!scaleFactor) {
    return NextResponse.json(
      { error: "Invalid difficulty level" },
      { status: 400 }
    );
  }

  // Fetch plan with objective
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*, objectives(*)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const objective = (plan as Record<string, unknown>).objectives as Record<
    string,
    unknown
  >;

  const currentScores: DimensionScores = {
    cardio: objective.current_cardio_score as number,
    strength: objective.current_strength_score as number,
    climbing_technical: objective.current_climbing_score as number,
    flexibility: objective.current_flexibility_score as number,
  };

  const previousTargets: DimensionScores = {
    cardio: objective.target_cardio_score as number,
    strength: objective.target_strength_score as number,
    climbing_technical: objective.target_climbing_score as number,
    flexibility: objective.target_flexibility_score as number,
  };

  // Calculate new target scores
  const newTargets = scaleDifficultyTargets(
    currentScores,
    previousTargets,
    scaleFactor
  );

  // Fetch current graduation benchmarks
  const currentBenchmarks =
    objective.graduation_benchmarks as DimensionGraduationBenchmarks;

  try {
    // Call Claude to rescale graduation benchmarks
    const userMessage = `Objective: ${objective.name}. Type: ${objective.type}.

Previous target scores: Cardio ${previousTargets.cardio}, Strength ${previousTargets.strength}, Climbing/Technical ${previousTargets.climbing_technical}, Flexibility ${previousTargets.flexibility}.

New target scores: Cardio ${newTargets.cardio}, Strength ${newTargets.strength}, Climbing/Technical ${newTargets.climbing_technical}, Flexibility ${newTargets.flexibility}.

Direction: ${level.includes("harder") ? "harder" : "easier"}.

Current graduation benchmarks:
${JSON.stringify(currentBenchmarks, null, 2)}`;

    const benchmarkResponse = await callClaude(
      PROMPT_RESCALE_BENCHMARKS_SYSTEM,
      userMessage,
      4096,
      "sonnet"
    );

    const parsed = parseClaudeJSON<{
      graduationBenchmarks: DimensionGraduationBenchmarks;
    }>(benchmarkResponse);
    const newBenchmarks = parsed.graduationBenchmarks;

    // Update objectives table with new targets and benchmarks
    const { error: objUpdateError } = await supabase
      .from("objectives")
      .update({
        target_cardio_score: newTargets.cardio,
        target_strength_score: newTargets.strength,
        target_climbing_score: newTargets.climbing_technical,
        target_flexibility_score: newTargets.flexibility,
        graduation_benchmarks: newBenchmarks,
      })
      .eq("id", objective.id);

    if (objUpdateError) {
      return NextResponse.json(
        { error: objUpdateError.message },
        { status: 500 }
      );
    }

    // Append difficulty adjustment to plan_data
    const planData = plan.plan_data as PlanData;
    const adjustment: DifficultyAdjustment = {
      timestamp: new Date().toISOString(),
      level,
      scaleFactor,
      previousTargets,
      newTargets,
    };
    const adjustments = [
      ...(planData.difficultyAdjustments || []),
      adjustment,
    ];

    // Recalculate expected scores and clear sessions for remaining weeks
    const currentWeek = plan.current_week_number as number;

    const { data: remainingWeeks } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", planId)
      .gte("week_number", currentWeek)
      .order("week_number");

    const weeksToUpdate = remainingWeeks || [];

    // Total weeks in plan
    const { count: totalWeekCount } = await supabase
      .from("weekly_targets")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    const totalWeeks =
      totalWeekCount ||
      Math.max(
        ...weeksToUpdate.map((w: Record<string, number>) => w.week_number)
      );

    // Recompute gap analysis with new targets
    const remainingWeeksForGap = Math.max(1, totalWeeks - currentWeek + 1);
    const newGapAnalysis = classifyGaps(currentScores, newTargets, remainingWeeksForGap);

    const { error: planUpdateError } = await supabase
      .from("training_plans")
      .update({
        plan_data: { ...planData, difficultyAdjustments: adjustments, gapAnalysis: newGapAnalysis },
        graduation_workouts: newBenchmarks,
      })
      .eq("id", planId);

    if (planUpdateError) {
      console.error("Error updating plan:", planUpdateError);
    }

    // Fetch profile for hours calculation
    const { data: profile } = await supabase
      .from("profiles")
      .select("training_days_per_week")
      .eq("id", user.id)
      .single();

    const daysPerWeek = profile?.training_days_per_week || 5;
    const baseHours = Math.min(daysPerWeek * 1.2, 20);

    const updatedWeeks = [];

    for (const week of weeksToUpdate) {
      const weekNumber = week.week_number;

      // Linear interpolation from current scores to NEW targets
      const newExpectedScores = expectedScoresAtWeek(
        currentScores,
        newTargets,
        weekNumber - currentWeek + 1,
        totalWeeks - currentWeek + 1
      );

      // Recalculate hours with taper for final 2 weeks
      const isTaper = weekNumber > totalWeeks - 2;
      const volumeMultiplier = isTaper ? 0.6 : 1.0;
      const progressionFactor = Math.min(
        1.0,
        0.7 + (weekNumber / totalWeeks) * 0.3
      );
      const totalHours =
        Math.round(baseHours * volumeMultiplier * progressionFactor * 10) / 10;

      const { error: updateError } = await supabase
        .from("weekly_targets")
        .update({
          expected_scores: newExpectedScores,
          total_hours: totalHours,
          sessions: [], // Clear for on-demand regeneration
        })
        .eq("id", week.id);

      if (updateError) {
        console.error(`Error updating week ${weekNumber}:`, updateError);
      }

      updatedWeeks.push({
        weekNumber,
        expectedScores: newExpectedScores,
        totalHoursTarget: totalHours,
        sessions: [],
      });
    }

    return NextResponse.json({
      newTargets,
      newBenchmarks,
      updatedWeeks,
      adjustment,
    });
  } catch (error) {
    console.error("Error adjusting difficulty:", error);
    return NextResponse.json(
      { error: "Failed to adjust plan difficulty" },
      { status: 500 }
    );
  }
}
