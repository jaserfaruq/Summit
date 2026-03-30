import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_1_SYSTEM } from "@/lib/prompts";
import { EstimateScoresRequest, EstimateScoresResponse } from "@/lib/types";

export const maxDuration = 60;

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

  // Trim benchmark exercises to only fields Claude needs for selection
  const trimmedBenchmarks = benchmarkExercises.map((b) => ({
    id: b.id,
    name: b.name,
    dimension: b.dimension,
    measurement_type: b.measurement_type,
    measurement_unit: b.measurement_unit,
    description: b.description,
  }));

  const userMessage = `Objective: ${objectiveDetails.name}. Route: ${objectiveDetails.route || "N/A"}. Type: ${objectiveDetails.type}. Season: ${objectiveDetails.season || "N/A"}. Duration: ${objectiveDetails.duration || "N/A"}. Summit elevation: ${objectiveDetails.elevation || "N/A"}. Total gain: ${objectiveDetails.totalGain || "N/A"}. Distance: ${objectiveDetails.distance || "N/A"}. Technical grade: ${objectiveDetails.grade || "N/A"}. Additional details: ${objectiveDetails.details || "N/A"}. Pack weight: ${objectiveDetails.packWeight || "N/A"}.

Available benchmark exercises: ${JSON.stringify(trimmedBenchmarks)}

${anchors.length > 0 ? `Calibration anchors: ${JSON.stringify(anchors.map(a => ({ name: a.name, targetScores: a.target_scores })))}` : ""}`;

  // Use streaming response with keep-alive to prevent Safari's ~60s timeout
  // from killing the connection while Opus thinks
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send a keep-alive space every 10s to keep the connection open
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(" "));
      }, 10000);

      try {
        const t0 = Date.now();
        const responseText = await callClaude(systemPrompt, userMessage, 6144);
        console.log(`[estimate-scores] Claude call took ${Date.now() - t0}ms`);
        const parsed = parseClaudeJSON<EstimateScoresResponse>(responseText);

        // Enforce minimum benchmark counts per dimension
        const gb = parsed.graduationBenchmarks;
        if (!gb.cardio || gb.cardio.length < 2) {
          throw new Error("AI returned fewer than 2 cardio graduation benchmarks");
        }
        if (!gb.strength || gb.strength.length < 2) {
          throw new Error("AI returned fewer than 2 strength graduation benchmarks");
        }

        clearInterval(keepAlive);
        controller.enqueue(encoder.encode(JSON.stringify(parsed)));
        controller.close();
      } catch (error) {
        clearInterval(keepAlive);
        console.error("Error estimating scores:", error);
        controller.enqueue(encoder.encode(JSON.stringify({ error: "Failed to estimate scores" })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/json" },
  });
}
