import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_6_SYSTEM } from "@/lib/prompts";
import { PlanSession, AlternativeSession, GenerateAlternativesRequest } from "@/lib/types";
import { calculateAllSessionMinutes, dimensionProgressFractions } from "@/lib/scoring";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateAlternativesRequest = await request.json();
  const { planId, weekNumber, sessionIndex } = body;

  // Fetch the plan
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Fetch the weekly target
  const { data: weekTarget, error: weekError } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .single();

  if (weekError || !weekTarget) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  const sessions = weekTarget.sessions as PlanSession[];
  if (!sessions || sessionIndex < 0 || sessionIndex >= sessions.length) {
    return NextResponse.json({ error: "Invalid session index" }, { status: 400 });
  }

  const targetSession = sessions[sessionIndex];
  // If this is already an alternative, use the original for generation
  const sessionForPrompt = targetSession.originalSession || targetSession;
  const otherSessions = sessions.filter((_, i) => i !== sessionIndex);

  // Fetch objective
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", plan.objective_id)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Calculate total weeks
  const { count: totalWeeks } = await supabase
    .from("weekly_targets")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId);

  // Get the relevance profile for this dimension
  const relevanceProfiles = objective.relevance_profiles as Record<string, unknown>;
  const dimensionRelevance = relevanceProfiles?.[sessionForPrompt.dimension] || {};

  // Calculate progress fractions
  const currentScores = {
    cardio: (objective.current_cardio_score as number) || 0,
    strength: (objective.current_strength_score as number) || 0,
    climbing_technical: (objective.current_climbing_score as number) || 0,
    flexibility: (objective.current_flexibility_score as number) || 0,
  };
  const targetScores = {
    cardio: (objective.target_cardio_score as number) || 0,
    strength: (objective.target_strength_score as number) || 0,
    climbing_technical: (objective.target_climbing_score as number) || 0,
    flexibility: (objective.target_flexibility_score as number) || 0,
  };
  const fractions = dimensionProgressFractions(currentScores, targetScores, weekNumber, totalWeeks || weekNumber);
  const dimFraction = fractions[sessionForPrompt.dimension];

  const userMessage = `Original session to replace:
${JSON.stringify(sessionForPrompt, null, 2)}

Other sessions this week (avoid duplicating these exercises):
${JSON.stringify(otherSessions.map(s => ({ name: s.name, dimension: s.dimension, training: s.training.map(t => t.description) })), null, 2)}

Dimension: ${sessionForPrompt.dimension}
Relevance profile for this dimension: ${JSON.stringify(dimensionRelevance, null, 2)}

Athlete equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}
Athlete location: ${profile?.location || "not specified"}

Week ${weekNumber} of ${totalWeeks || "?"}. Progress fraction for ${sessionForPrompt.dimension}: ${dimFraction?.fraction || 50}%.`;

  try {
    const responseText = await callClaudeWithCache(PROMPT_6_SYSTEM, userMessage, 4096, "sonnet");
    const result = parseClaudeJSON<{ alternatives: AlternativeSession[] }>(responseText);

    // Calculate estimated minutes for each alternative
    calculateAllSessionMinutes(result.alternatives);

    // Compute duration difference
    for (const alt of result.alternatives) {
      const diff = alt.estimatedMinutes - sessionForPrompt.estimatedMinutes;
      if (Math.abs(diff) > 5) {
        alt.durationDifference = diff > 0 ? `+${diff} min` : `${diff} min`;
      }
    }

    return NextResponse.json({
      original: sessionForPrompt,
      alternatives: result.alternatives,
    });
  } catch (error: unknown) {
    console.error("Error generating alternatives:", error);
    const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
    const detail = err.error?.message || err.message || String(error);
    return NextResponse.json(
      { error: `Failed to generate alternatives: ${detail}` },
      { status: 500 }
    );
  }
}
