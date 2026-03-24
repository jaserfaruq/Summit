import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_ASSESS_Q_SYSTEM } from "@/lib/prompts";
import { AIQuestion } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { objectiveId, standardAnswers, previousQuestions, previousAnswers } = await request.json();

  if (!objectiveId || !standardAnswers || !previousQuestions || !previousAnswers) {
    return NextResponse.json(
      { error: "objectiveId, standardAnswers, previousQuestions, and previousAnswers are required" },
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

  const userMessage = `Objective: ${objective.name}${objective.type ? ` (${objective.type})` : ""}
Route: ${objective.technical_grade || "N/A"}
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}
Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}
Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

Standard answers provided:
${JSON.stringify(standardAnswers, null, 2)}

You already asked these questions: ${JSON.stringify(previousQuestions, null, 2)}
The athlete answered: ${JSON.stringify(previousAnswers, null, 2)}

Generate 2-3 additional questions targeting gaps in what you know. Do not repeat topics already covered.`;

  try {
    const responseText = await callClaude(PROMPT_ASSESS_Q_SYSTEM, userMessage, 4096, "opus");
    const result = parseClaudeJSON<{ questions: AIQuestion[] }>(responseText);

    return NextResponse.json({ questions: result.questions });
  } catch (error) {
    console.error("Error generating more questions:", error);
    return NextResponse.json(
      { error: "Failed to generate additional questions" },
      { status: 500 }
    );
  }
}
