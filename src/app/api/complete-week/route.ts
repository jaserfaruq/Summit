import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { CompleteWeekRequest, DimensionScores, Dimension, SessionRating } from "@/lib/types";
import { calculateAllScoresFromRatings, shouldHighlightRebalance, generateCompletionSummary } from "@/lib/scoring";

export const maxDuration = 60;

const DIMENSIONS: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CompleteWeekRequest = await request.json();
  const { planId, weekNumber, ratings } = body;

  // Fetch the weekly target
  const { data: weekTarget, error: weekError } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .single();

  if (weekError || !weekTarget) {
    return NextResponse.json({ error: "Week target not found" }, { status: 404 });
  }

  // Fetch the plan and objective
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*, objectives(*)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const objective = (plan as Record<string, unknown>).objectives as Record<string, unknown>;

  const currentScores: DimensionScores = {
    cardio: objective.current_cardio_score as number,
    strength: objective.current_strength_score as number,
    climbing_technical: objective.current_climbing_score as number,
    flexibility: objective.current_flexibility_score as number,
  };

  const targetScores: DimensionScores = {
    cardio: objective.target_cardio_score as number,
    strength: objective.target_strength_score as number,
    climbing_technical: objective.target_climbing_score as number,
    flexibility: objective.target_flexibility_score as number,
  };

  const expectedScores = weekTarget.expected_scores as DimensionScores;

  // Calculate updated scores from 1-5 ratings
  const ratingData: { dimension: Dimension; rating: 1 | 2 | 3 | 4 | 5 }[] = ratings.map((r: SessionRating) => ({
    dimension: r.dimension,
    rating: r.rating as 1 | 2 | 3 | 4 | 5,
  }));

  const updatedScores = calculateAllScoresFromRatings(ratingData, currentScores, expectedScores);

  // Validate scores are finite numbers
  const safeScore = (score: number, fallback: number) =>
    Number.isFinite(score) ? score : fallback;

  const safeUpdatedScores: DimensionScores = {
    cardio: safeScore(updatedScores.cardio, currentScores.cardio),
    strength: safeScore(updatedScores.strength, currentScores.strength),
    climbing_technical: safeScore(updatedScores.climbing_technical, currentScores.climbing_technical),
    flexibility: safeScore(updatedScores.flexibility, currentScores.flexibility),
  };

  // Write to score_history
  await supabase.from("score_history").insert({
    user_id: user.id,
    objective_id: objective.id as string,
    week_ending: weekTarget.week_start,
    cardio_score: safeUpdatedScores.cardio,
    strength_score: safeUpdatedScores.strength,
    climbing_score: safeUpdatedScores.climbing_technical,
    flexibility_score: safeUpdatedScores.flexibility,
    change_reason: "weekly_rating",
    is_test_week: false,
    confidence: "low",
  });

  // Update current scores on objective
  await supabase
    .from("objectives")
    .update({
      current_cardio_score: safeUpdatedScores.cardio,
      current_strength_score: safeUpdatedScores.strength,
      current_climbing_score: safeUpdatedScores.climbing_technical,
      current_flexibility_score: safeUpdatedScores.flexibility,
    })
    .eq("id", objective.id as string);

  // Only advance the active week if this is the current week
  const currentWeekNumber = (plan as Record<string, unknown>).current_week_number as number;
  if (weekNumber >= currentWeekNumber) {
    await supabase
      .from("training_plans")
      .update({ current_week_number: weekNumber + 1 })
      .eq("id", planId);
  }

  // Generate feedback
  const rebalanceCheck = shouldHighlightRebalance(safeUpdatedScores, expectedScores);
  const summary = generateCompletionSummary(safeUpdatedScores, expectedScores, targetScores);

  const gaps: Record<Dimension, number> = {} as Record<Dimension, number>;
  for (const dim of DIMENSIONS) {
    gaps[dim] = safeUpdatedScores[dim] - expectedScores[dim];
  }

  return NextResponse.json({
    updatedScores: safeUpdatedScores,
    expectedScores,
    gaps,
    summary,
    rebalanceRecommended: rebalanceCheck.recommended,
  });
}
