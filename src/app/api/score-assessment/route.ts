import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_ASSESS_SCORE_SYSTEM } from "@/lib/prompts";
import { DimensionScores, ProgrammingHints, AIReasoning, DimensionGraduationBenchmarks } from "@/lib/types";

interface ScoreAssessmentResponse {
  climbingRole: "lead" | "follow" | null;
  adjustedTargets: DimensionScores;
  adjustedBenchmarks?: DimensionGraduationBenchmarks;
  scores: DimensionScores;
  reasoning: AIReasoning;
  programmingHints: ProgrammingHints;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectiveId, standardAnswers, aiQuestions, aiAnswers, freeformText } = await request.json();

  if (!objectiveId || !standardAnswers) {
    return NextResponse.json(
      { error: "objectiveId and standardAnswers are required" },
      { status: 400 }
    );
  }

  // Fetch the objective
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", objectiveId)
    .eq("user_id", user.id)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
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

  const userMessage = `Objective: ${objective.name}${objective.type ? ` (${objective.type})` : ""}
Route: ${objective.technical_grade || "N/A"}
Distance: ${objective.distance_miles || "N/A"} miles
Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft
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
    const responseText = await callClaude(PROMPT_ASSESS_SCORE_SYSTEM, userMessage, 8192, "opus");
    const result = parseClaudeJSON<ScoreAssessmentResponse>(responseText);

    // Store climbing_role on the objective
    const climbingRole = result.climbingRole === "lead" || result.climbingRole === "follow"
      ? result.climbingRole
      : null;

    const objectiveUpdates: Record<string, unknown> = {
      climbing_role: climbingRole,
      current_cardio_score: result.scores.cardio,
      current_strength_score: result.scores.strength,
      current_climbing_score: result.scores.climbing_technical,
      current_flexibility_score: result.scores.flexibility,
    };

    // If follow role, update target scores and graduation benchmarks
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

    // Update training_days_per_week on user's profile from assessment answers
    if (standardAnswers.training_days_per_week) {
      await supabase
        .from("profiles")
        .update({ training_days_per_week: standardAnswers.training_days_per_week })
        .eq("id", user.id);
    }

    // Store the assessment with all fields
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

    // Write to score_history with confidence = "low"
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
    });
  } catch (error) {
    console.error("Error scoring assessment:", error);
    return NextResponse.json(
      { error: "Failed to score assessment" },
      { status: 500 }
    );
  }
}
