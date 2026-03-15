import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_1_SYSTEM } from "@/lib/prompts";
import { EstimateScoresRequest, EstimateScoresResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: EstimateScoresRequest = await request.json();
  const { objectiveDetails, benchmarkExercises, anchors, validatorFeedback } = body;

  // Build system prompt with optional feedback/anchors
  let systemPrompt = PROMPT_1_SYSTEM;
  if (validatorFeedback && validatorFeedback.length > 0) {
    systemPrompt += `\n\nExperienced validators have confirmed these components for similar objectives: ${JSON.stringify(validatorFeedback)}. Use this to refine your assessment.`;
  }
  if (anchors && anchors.length > 0) {
    systemPrompt += `\n\nHere are calibrated profiles for similar validated objectives: ${JSON.stringify(anchors.map(a => ({
      name: a.name,
      type: a.type,
      targetScores: a.target_scores,
      taglines: a.taglines,
      relevanceProfiles: a.relevance_profiles,
      graduationBenchmarks: a.graduation_benchmarks,
    })))}. Use these as anchors to calibrate your assessment relative to known standards.`;
  }

  const userMessage = `Objective: ${objectiveDetails.name}. Route: ${objectiveDetails.route || "N/A"}. Type: ${objectiveDetails.type}. Season: ${objectiveDetails.season || "N/A"}. Duration: ${objectiveDetails.duration || "N/A"}. Summit elevation: ${objectiveDetails.elevation || "N/A"}. Total gain: ${objectiveDetails.totalGain || "N/A"}. Distance: ${objectiveDetails.distance || "N/A"}. Technical grade: ${objectiveDetails.grade || "N/A"}. Additional details: ${objectiveDetails.details || "N/A"}. Pack weight: ${objectiveDetails.packWeight || "N/A"}.

Available benchmark exercises: ${JSON.stringify(benchmarkExercises)}

${anchors.length > 0 ? `Calibration anchors: ${JSON.stringify(anchors.map(a => ({ name: a.name, targetScores: a.target_scores })))}` : ""}`;

  try {
    const responseText = await callClaude(systemPrompt, userMessage);
    const parsed = parseClaudeJSON<EstimateScoresResponse>(responseText);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error estimating scores:", error);
    return NextResponse.json(
      { error: "Failed to estimate scores" },
      { status: 500 }
    );
  }
}
