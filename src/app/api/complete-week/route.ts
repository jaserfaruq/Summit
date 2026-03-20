import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_3_SYSTEM } from "@/lib/prompts";
import { CompleteWeekRequest, DimensionScores, Dimension } from "@/lib/types";

export const maxDuration = 60;
import { calculateDimensionScore, checkRebalanceTrigger, dimensionProgressFractions } from "@/lib/scoring";

const DIMENSIONS: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: CompleteWeekRequest = await request.json();
  const { planId, weekNumber, workoutLogs } = body;

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
  const weekType = weekTarget.week_type;

  // Workout logs are already saved by the /log page.
  // If any are passed that don't have IDs, save them now.
  for (const log of workoutLogs) {
    if (!(log as Record<string, unknown>).id) {
      await supabase.from("workout_logs").insert({
        user_id: user.id,
        ...log,
      });
    }
  }

  // Taper weeks: no score changes, but still advance the active week
  if (weekType === "taper") {
    await supabase
      .from("training_plans")
      .update({ current_week_number: weekNumber + 1 })
      .eq("id", planId);

    return NextResponse.json({
      updatedScores: {
        cardio: objective.current_cardio_score as number,
        strength: objective.current_strength_score as number,
        climbing_technical: objective.current_climbing_score as number,
        flexibility: objective.current_flexibility_score as number,
      },
      rebalanceTriggered: false,
    });
  }

  let updatedScores: DimensionScores;
  let rebalanceTriggered = false;
  let adjustmentDetails: Record<string, { change: number; reasoning: string }> | undefined;

  if (weekType === "test") {
    // Test week: calculate scores from benchmark results
    const targetScores: DimensionScores = {
      cardio: objective.target_cardio_score as number,
      strength: objective.target_strength_score as number,
      climbing_technical: objective.target_climbing_score as number,
      flexibility: objective.target_flexibility_score as number,
    };

    updatedScores = { cardio: 0, strength: 0, climbing_technical: 0, flexibility: 0 };

    const currentScores: DimensionScores = {
      cardio: objective.current_cardio_score as number,
      strength: objective.current_strength_score as number,
      climbing_technical: objective.current_climbing_score as number,
      flexibility: objective.current_flexibility_score as number,
    };

    for (const dim of DIMENSIONS) {
      const dimLogs = workoutLogs.filter((l) => l.dimension === dim && l.benchmark_results);
      const allResults = dimLogs.flatMap((l) => l.benchmark_results || []);

      if (allResults.length > 0) {
        updatedScores[dim] = calculateDimensionScore(
          allResults.map((r) => ({ result: r.result, graduationTarget: r.graduationTarget })),
          targetScores[dim],
          currentScores[dim]
        );
      } else {
        // Keep current score if no benchmark data for this dimension
        updatedScores[dim] = currentScores[dim];
      }
    }

    // Write to score_history
    await supabase.from("score_history").insert({
      user_id: user.id,
      objective_id: objective.id as string,
      week_ending: weekTarget.week_start,
      ...updatedScores,
      cardio_score: updatedScores.cardio,
      strength_score: updatedScores.strength,
      climbing_score: updatedScores.climbing_technical,
      flexibility_score: updatedScores.flexibility,
      change_reason: "test_week",
      is_test_week: true,
      confidence: "high",
    });

    // Check for rebalancing (3+ pts off)
    const expected = weekTarget.expected_scores as DimensionScores;
    const trigger = checkRebalanceTrigger(updatedScores, expected, "test");
    rebalanceTriggered = trigger.triggered;
  } else {
    // Regular week: AI-estimated adjustments
    const currentScores: DimensionScores = {
      cardio: objective.current_cardio_score as number,
      strength: objective.current_strength_score as number,
      climbing_technical: objective.current_climbing_score as number,
      flexibility: objective.current_flexibility_score as number,
    };

    // Determine maintenance dimensions for PROMPT_3
    const targetDimScores: DimensionScores = {
      cardio: objective.target_cardio_score as number,
      strength: objective.target_strength_score as number,
      climbing_technical: objective.target_climbing_score as number,
      flexibility: objective.target_flexibility_score as number,
    };
    const dimProgress = dimensionProgressFractions(currentScores, targetDimScores, weekNumber, 1);
    const maintenanceInfo = Object.entries(dimProgress)
      .filter(([, v]) => v.maintenance)
      .map(([dim]) => dim);

    const userMessage = `Current scores: ${JSON.stringify(currentScores)}
Expected scores this week: ${JSON.stringify(weekTarget.expected_scores)}
Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}
${maintenanceInfo.length > 0 ? `\nMaintenance dimensions (intentionally reduced volume — do NOT penalize): ${maintenanceInfo.join(", ")}` : ""}

Workout logs for the week:
${workoutLogs.map((l) => `- ${l.dimension}: ${l.session_name || "custom"}, ${l.duration_min || "?"} min, completed as prescribed: ${l.completed_as_prescribed}. Details: ${JSON.stringify(l.details)}`).join("\n")}`;

    try {
      const responseText = await callClaude(PROMPT_3_SYSTEM, userMessage);
      const parsed = parseClaudeJSON<{
        adjustments: Record<string, { change: number; reasoning: string }>;
        emergencyRebalance: boolean;
        rebalanceDimensions: string[];
      }>(responseText);

      adjustmentDetails = parsed.adjustments;
      updatedScores = { ...currentScores };

      for (const dim of DIMENSIONS) {
        const adj = parsed.adjustments[dim];
        if (adj) {
          const clamped = Math.max(-3, Math.min(3, adj.change));
          updatedScores[dim] = currentScores[dim] + clamped;
        }
      }

      rebalanceTriggered = parsed.emergencyRebalance;
    } catch {
      // Fallback: if AI fails, apply small positive adjustments for completed sessions
      updatedScores = { ...currentScores };
      for (const log of workoutLogs) {
        if (log.completed_as_prescribed) {
          updatedScores[log.dimension as Dimension] += 1;
        }
      }
    }

    // Write to score_history
    await supabase.from("score_history").insert({
      user_id: user.id,
      objective_id: objective.id as string,
      week_ending: weekTarget.week_start,
      cardio_score: updatedScores.cardio,
      strength_score: updatedScores.strength,
      climbing_score: updatedScores.climbing_technical,
      flexibility_score: updatedScores.flexibility,
      change_reason: "regular_week",
      is_test_week: false,
      confidence: "low",
    });
  }

  // Validate scores are finite numbers before writing; fall back to current scores
  const safeScore = (score: number, fallback: number) =>
    Number.isFinite(score) ? score : fallback;

  const currentFallback: DimensionScores = {
    cardio: objective.current_cardio_score as number ?? 0,
    strength: objective.current_strength_score as number ?? 0,
    climbing_technical: objective.current_climbing_score as number ?? 0,
    flexibility: objective.current_flexibility_score as number ?? 0,
  };

  updatedScores = {
    cardio: safeScore(updatedScores.cardio, currentFallback.cardio),
    strength: safeScore(updatedScores.strength, currentFallback.strength),
    climbing_technical: safeScore(updatedScores.climbing_technical, currentFallback.climbing_technical),
    flexibility: safeScore(updatedScores.flexibility, currentFallback.flexibility),
  };

  // Update current scores on objective
  await supabase
    .from("objectives")
    .update({
      current_cardio_score: updatedScores.cardio,
      current_strength_score: updatedScores.strength,
      current_climbing_score: updatedScores.climbing_technical,
      current_flexibility_score: updatedScores.flexibility,
    })
    .eq("id", objective.id as string);

  // Advance the active week
  await supabase
    .from("training_plans")
    .update({ current_week_number: weekNumber + 1 })
    .eq("id", planId);

  return NextResponse.json({
    updatedScores,
    rebalanceTriggered,
    adjustmentDetails,
  });
}
