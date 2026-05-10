import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_ASSESS_Q_SYSTEM } from "@/lib/prompts";
import { AIQuestion } from "@/lib/types";

interface InlineObjective {
  name: string;
  type: string;
  distance_miles: number | null;
  elevation_gain_ft: number | null;
  technical_grade: string | null;
  target_cardio_score: number;
  target_strength_score: number;
  target_climbing_score: number;
  target_flexibility_score: number;
  graduation_benchmarks: unknown;
  relevance_profiles: unknown;
  matched_validated_id: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { objectiveId, objective: inlineObjective, standardAnswers, previousQuestions, previousAnswers } = await request.json();

  if (!standardAnswers || !previousQuestions || !previousAnswers) {
    return NextResponse.json(
      { error: "standardAnswers, previousQuestions, and previousAnswers are required" },
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
${objective.technical_grade ? `Technical grade: ${objective.technical_grade}` : ""}
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}
Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}
Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

Standard answers provided:
${JSON.stringify(standardAnswers, null, 2)}

You already asked these questions: ${JSON.stringify(previousQuestions, null, 2)}
The athlete answered: ${JSON.stringify(previousAnswers, null, 2)}

Generate 2-3 additional questions targeting gaps in what you know. Do not repeat topics already covered.`;

  try {
    const responseText = await callClaude(PROMPT_ASSESS_Q_SYSTEM, userMessage, 2048, "sonnet");
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
