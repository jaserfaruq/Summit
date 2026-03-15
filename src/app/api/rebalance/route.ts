import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_4_SYSTEM } from "@/lib/prompts";
import { RebalanceRequest, PlanWeek } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: RebalanceRequest = await request.json();
  const { planId, currentWeek, actualScores, expectedScores, targetScores, tier } = body;

  // Fetch remaining weekly targets
  const { data: remainingWeeks, error } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .gt("week_number", currentWeek)
    .order("week_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch plan for context
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*, objectives(*)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const objective = (plan as Record<string, unknown>).objectives as Record<string, unknown>;

  const weeksToRebalance = tier === 1
    ? remainingWeeks?.filter((w) => w.week_type === "regular") || []
    : remainingWeeks?.filter((w) => w.week_type === "regular").slice(0, 2) || [];

  if (weeksToRebalance.length === 0) {
    return NextResponse.json({ updatedWeeks: [] });
  }

  const userMessage = `Current week: ${currentWeek}
Actual scores: ${JSON.stringify(actualScores)}
Expected scores: ${JSON.stringify(expectedScores)}
Target scores: ${JSON.stringify(targetScores)}
Rebalance tier: ${tier} (${tier === 1 ? "full rebalance of all remaining regular weeks" : "emergency - next 1-2 weeks only"})

Objective: ${objective.name}. Type: ${objective.type}.
Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}
Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Remaining regular weeks to regenerate (${weeksToRebalance.length} weeks):
${weeksToRebalance.map((w) => `Week ${w.week_number}: ${w.week_start}, currently ${w.total_hours}h`).join("\n")}`;

  try {
    const responseText = await callClaude(PROMPT_4_SYSTEM, userMessage);
    const parsed = parseClaudeJSON<{ weeks: PlanWeek[] }>(responseText);

    // Update each rebalanced week
    for (const updatedWeek of parsed.weeks) {
      const matchingTarget = weeksToRebalance.find(
        (w) => w.week_number === updatedWeek.weekNumber
      );
      if (matchingTarget) {
        await supabase
          .from("weekly_targets")
          .update({
            sessions: updatedWeek.sessions,
            total_hours: updatedWeek.totalHoursTarget,
            expected_scores: updatedWeek.expectedScores,
          })
          .eq("id", matchingTarget.id);
      }
    }

    return NextResponse.json({ updatedWeeks: parsed.weeks });
  } catch (error) {
    console.error("Error rebalancing:", error);
    return NextResponse.json(
      { error: "Failed to rebalance plan" },
      { status: 500 }
    );
  }
}
