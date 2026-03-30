import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { CompleteWeekRequest, DimensionScores, Dimension, SessionRating, RATING_MULTIPLIERS, WorkoutRating } from "@/lib/types";
import { calculateAllScoresFromRatings, shouldHighlightRebalance, generateCompletionSummary } from "@/lib/scoring";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_3B_SYSTEM } from "@/lib/prompts";
export const maxDuration = 60;

const DIMENSIONS: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];

interface RelevanceResult {
  adjustedMultiplier: number;
  explanation: string;
}

interface BatchedRelevanceInput {
  dimension: Dimension;
  rating: WorkoutRating;
  comment: string;
  sessionDetails: string;
}

interface BatchedRelevanceResponse {
  evaluations: Record<string, RelevanceResult>;
}

/**
 * Call Claude with Prompt 3B to evaluate relevance of user comments
 * across ALL dimensions in a single batched call (instead of 1-4 sequential calls).
 */
async function evaluateRelevanceBatched(
  inputs: BatchedRelevanceInput[],
  objectiveName: string,
  relevanceProfiles: Record<string, { keyComponents: string[]; irrelevantComponents: string[] }>
): Promise<Record<Dimension, RelevanceResult>> {
  const dimensionBlocks = inputs.map((input) => {
    const profile = relevanceProfiles[input.dimension];
    const baseMultiplier = RATING_MULTIPLIERS[input.rating];
    return `--- ${input.dimension} ---
Rating: ${input.rating} (base multiplier: ${baseMultiplier})
Comment: "${input.comment}"
Prescribed session: ${input.sessionDetails}
Key components: ${JSON.stringify(profile?.keyComponents || [])}
Irrelevant components: ${JSON.stringify(profile?.irrelevantComponents || [])}`;
  });

  const userMessage = `The objective is: ${objectiveName}

Evaluate the following dimensions:

${dimensionBlocks.join("\n\n")}

For each dimension, adjust the base multiplier by up to ±0.25 based on how relevant the athlete's actual training was to the key components.`;

  const responseText = await callClaude(PROMPT_3B_SYSTEM, userMessage, 1024, "sonnet");
  const parsed = parseClaudeJSON<BatchedRelevanceResponse>(responseText);

  // Clamp each multiplier within allowed range
  const results: Record<string, RelevanceResult> = {};
  for (const input of inputs) {
    const dimResult = parsed.evaluations?.[input.dimension];
    if (dimResult) {
      const baseMultiplier = RATING_MULTIPLIERS[input.rating];
      const minMultiplier = Math.max(0, baseMultiplier - 0.25);
      const maxMultiplier = baseMultiplier + 0.25;
      dimResult.adjustedMultiplier = Math.max(minMultiplier, Math.min(maxMultiplier, dimResult.adjustedMultiplier));
      results[input.dimension] = dimResult;
    }
  }

  return results as Record<Dimension, RelevanceResult>;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CompleteWeekRequest = await request.json();
  const { planId, weekNumber, ratings } = body;

  // Validate comments are provided for non-3 ratings
  for (const r of ratings) {
    if (r.rating !== 3 && (!r.comment || r.comment.trim().length === 0)) {
      return NextResponse.json(
        { error: `Comment required for rating ${r.rating} on ${r.sessionName}` },
        { status: 400 }
      );
    }
  }

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

  // Build rating data
  const ratingData: { dimension: Dimension; rating: 1 | 2 | 3 | 4 | 5 }[] = ratings.map((r: SessionRating) => ({
    dimension: r.dimension,
    rating: r.rating as 1 | 2 | 3 | 4 | 5,
  }));

  // For non-3 ratings, call Prompt 3B to get AI-adjusted multipliers
  const aiMultipliers: Partial<Record<Dimension, number>> = {};
  const aiExplanations: Partial<Record<Dimension, string>> = {};

  const relevanceProfiles = (objective.relevance_profiles || {}) as Record<
    string,
    { keyComponents: string[]; irrelevantComponents: string[] }
  >;

  // Collect all dimensions needing AI evaluation, then batch into ONE Claude call
  const batchInputs: BatchedRelevanceInput[] = [];
  for (const dim of DIMENSIONS) {
    const dimRatings = ratings.filter((r: SessionRating) => r.dimension === dim);
    const nonThreeRatings = dimRatings.filter((r: SessionRating) => r.rating !== 3);

    if (nonThreeRatings.length > 0 && relevanceProfiles[dim]) {
      const primaryRating = nonThreeRatings[0];
      batchInputs.push({
        dimension: dim,
        rating: primaryRating.rating as WorkoutRating,
        comment: primaryRating.comment || "",
        sessionDetails: primaryRating.sessionName || dim,
      });
    }
  }

  if (batchInputs.length > 0) {
    try {
      const batchResults = await evaluateRelevanceBatched(
        batchInputs,
        objective.name as string,
        relevanceProfiles
      );
      for (const input of batchInputs) {
        const result = batchResults[input.dimension];
        if (result) {
          aiMultipliers[input.dimension] = result.adjustedMultiplier;
          aiExplanations[input.dimension] = result.explanation;
        }
      }
    } catch (err) {
      console.error("Batched AI relevance evaluation failed:", err);
      // Fall back to base multipliers (no AI adjustment)
    }
  }

  // Calculate updated scores with AI-adjusted multipliers
  const updatedScores = calculateAllScoresFromRatings(ratingData, currentScores, expectedScores, aiMultipliers);

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

  // Report generation is now triggered by the client after receiving this response.
  // Previously used a detached promise here, but Vercel serverless can kill
  // the function after sending the response, making it unreliable.

  return NextResponse.json({
    updatedScores: safeUpdatedScores,
    expectedScores,
    gaps,
    summary,
    rebalanceRecommended: rebalanceCheck.recommended,
    aiExplanations,
  });
}
