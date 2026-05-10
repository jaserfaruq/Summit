import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_ASSESS_SCORE_SYSTEM } from "@/lib/prompts";
import { DimensionScores, ProgrammingHints, AIReasoning, DimensionGraduationBenchmarks, GapAnalysis } from "@/lib/types";
import { classifyGaps } from "@/lib/scoring";

interface ScoreAssessmentResponse {
  climbingRole: "lead" | "follow" | null;
  adjustedTargets: DimensionScores;
  adjustedBenchmarks?: DimensionGraduationBenchmarks;
  scores: DimensionScores;
  reasoning: AIReasoning;
  programmingHints: ProgrammingHints;
}

interface InlineObjective {
  name: string;
  type: string;
  distance_miles: number | null;
  elevation_gain_ft: number | null;
  target_cardio_score: number;
  target_strength_score: number;
  target_climbing_score: number;
  target_flexibility_score: number;
  graduation_benchmarks: unknown;
  relevance_profiles: unknown;
  matched_validated_id: string | null;
  target_date?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { objectiveId, objective: inlineObjective, standardAnswers, aiQuestions, aiAnswers, freeformText } = await request.json();

  if (!standardAnswers) {
    return NextResponse.json(
      { error: "standardAnswers is required" },
      { status: 400 }
    );
  }

  let objective: InlineObjective | null = null;

  if (user && objectiveId) {
    const { data, error: objError } = await supabase
      .from("objectives")
      .select("*")
      .eq("id", objectiveId)
      .eq("user_id", user.id)
      .single();
    if (objError || !data) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }
    objective = data as InlineObjective;
  } else if (inlineObjective) {
    objective = inlineObjective as InlineObjective;
  } else {
    return NextResponse.json(
      { error: "objectiveId (when authenticated) or objective (guest) is required" },
      { status: 400 }
    );
  }

  // Determine climbing role from AI answers (look for the lead/follow question)
  let climbingRoleFromAnswers: string | null = null;
  if (aiQuestions && aiAnswers) {
    for (const q of aiQuestions) {
      if (q.question?.toLowerCase().includes("lead or follow")) {
        const answer = aiAnswers[q.id];
        if (typeof answer === "string") {
          climbingRoleFromAnswers = answer.toLowerCase();
        }
        break;
      }
    }
  }

  // Fetch route name from validated objective if matched
  let routeName = objective.name;
  if (objective.matched_validated_id) {
    const { data: validatedObj } = await supabase
      .from("validated_objectives")
      .select("route")
      .eq("id", objective.matched_validated_id)
      .single();
    if (validatedObj?.route) routeName = validatedObj.route;
  }

  const userMessage = `Objective: ${objective.name}${objective.type ? ` (${objective.type})` : ""}
Route: ${routeName}
${objective.distance_miles ? `Distance: ${objective.distance_miles} miles` : ""}
${objective.elevation_gain_ft ? `Elevation gain: ${objective.elevation_gain_ft} ft` : ""}
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}
Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}
Relevance profiles (key components): ${JSON.stringify(objective.relevance_profiles)}
Climbing role: ${climbingRoleFromAnswers || "not applicable"}

Standard fitness baseline:
${JSON.stringify(standardAnswers, null, 2)}

Objective-specific answers:
${JSON.stringify(aiAnswers || {}, null, 2)}

Additional context from athlete:
${freeformText || "None provided"}`;

  try {
    const responseText = await callClaude(PROMPT_ASSESS_SCORE_SYSTEM, userMessage, 8192, "opus4_7");
    const result = parseClaudeJSON<ScoreAssessmentResponse>(responseText);

    const climbingRole = result.climbingRole === "lead" || result.climbingRole === "follow"
      ? result.climbingRole
      : null;

    // Compute final targets (may have been adjusted for "follow" role)
    const finalTargets: DimensionScores = climbingRole === "follow" && result.adjustedTargets
      ? result.adjustedTargets
      : {
          cardio: objective.target_cardio_score,
          strength: objective.target_strength_score,
          climbing_technical: objective.target_climbing_score,
          flexibility: objective.target_flexibility_score,
        };

    // Compute gap analysis (uses target_date if available)
    const targetDate = objective.target_date ? new Date(objective.target_date) : null;
    const totalWeeks = targetDate
      ? Math.max(4, Math.floor((targetDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
      : 12;
    const gapAnalysis: GapAnalysis = classifyGaps(result.scores, finalTargets, totalWeeks);

    // Guest mode: return the result without persisting
    if (!user || !objectiveId) {
      return NextResponse.json({
        assessmentId: null,
        scores: result.scores,
        reasoning: result.reasoning,
        programmingHints: result.programmingHints,
        adjustedTargets: finalTargets,
        adjustedBenchmarks: result.adjustedBenchmarks,
        climbingRole: result.climbingRole,
        gapAnalysis,
      });
    }

    // Authed mode: persist as before
    const objectiveUpdates: Record<string, unknown> = {
      climbing_role: climbingRole,
      current_cardio_score: result.scores.cardio,
      current_strength_score: result.scores.strength,
      current_climbing_score: result.scores.climbing_technical,
      current_flexibility_score: result.scores.flexibility,
    };

    if (climbingRole === "follow" && result.adjustedTargets) {
      objectiveUpdates.target_cardio_score = result.adjustedTargets.cardio;
      objectiveUpdates.target_strength_score = result.adjustedTargets.strength;
      objectiveUpdates.target_climbing_score = result.adjustedTargets.climbing_technical;
      objectiveUpdates.target_flexibility_score = result.adjustedTargets.flexibility;

      if (result.adjustedBenchmarks) {
        objectiveUpdates.graduation_benchmarks = result.adjustedBenchmarks;
      }
    }

    await supabase.from("objectives").update(objectiveUpdates).eq("id", objectiveId);

    if (standardAnswers.training_days_per_week) {
      await supabase
        .from("profiles")
        .update({ training_days_per_week: standardAnswers.training_days_per_week })
        .eq("id", user.id);
    }

    const { data: assessment, error: assessError } = await supabase
      .from("assessments")
      .insert({
        user_id: user.id,
        objective_id: objectiveId,
        cardio_score: result.scores.cardio,
        strength_score: result.scores.strength,
        climbing_score: result.scores.climbing_technical,
        flexibility_score: result.scores.flexibility,
        standard_answers: standardAnswers,
        ai_questions: aiQuestions || null,
        ai_answers: aiAnswers || null,
        freeform_text: freeformText || null,
        ai_reasoning: result.reasoning,
        raw_data: { programmingHints: result.programmingHints },
      })
      .select()
      .single();

    if (assessError || !assessment) {
      console.error("Failed to save assessment:", assessError);
      return NextResponse.json({ error: "Failed to save assessment" }, { status: 500 });
    }

    const today = new Date().toISOString().split("T")[0];
    await supabase.from("score_history").insert({
      user_id: user.id,
      objective_id: objectiveId,
      week_ending: today,
      cardio_score: result.scores.cardio,
      strength_score: result.scores.strength,
      climbing_score: result.scores.climbing_technical,
      flexibility_score: result.scores.flexibility,
      change_reason: "assessment",
      is_test_week: false,
      confidence: "low",
    });

    return NextResponse.json({
      assessmentId: assessment.id,
      scores: result.scores,
      reasoning: result.reasoning,
      programmingHints: result.programmingHints,
      adjustedTargets: result.adjustedTargets,
      adjustedBenchmarks: result.adjustedBenchmarks,
      climbingRole: result.climbingRole,
      gapAnalysis,
    });
  } catch (error) {
    console.error("Error scoring assessment:", error);
    return NextResponse.json(
      { error: "Failed to score assessment" },
      { status: 500 }
    );
  }
}
