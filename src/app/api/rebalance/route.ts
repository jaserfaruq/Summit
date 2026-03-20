import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_4_SYSTEM } from "@/lib/prompts";
import { RebalanceRequest, PlanWeek } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours, dimensionProgressFractions, DimensionProgress } from "@/lib/scoring";

export const maxDuration = 60;

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

  // Calculate maintenance status per dimension
  const totalWeekCount = remainingWeeks ? Math.max(...remainingWeeks.map(w => w.week_number)) : currentWeek;
  const dimStatus = dimensionProgressFractions(actualScores, targetScores, currentWeek, totalWeekCount);
  const maintenanceDims = Object.entries(dimStatus)
    .filter(([, v]) => (v as DimensionProgress).maintenance)
    .map(([k]) => k);

  const dimStatusLines = Object.entries(dimStatus).map(([dim, prog]) => {
    const p = prog as DimensionProgress;
    const dimLabel = dim === "climbing_technical" ? "Climbing/Technical" : dim.charAt(0).toUpperCase() + dim.slice(1);
    if (p.maintenance) {
      return `- ${dimLabel}: MAINTENANCE (current ${actualScores[dim as keyof typeof actualScores]} vs target ${targetScores[dim as keyof typeof targetScores]}) — 1 session/week, 60% volume`;
    }
    return `- ${dimLabel}: ${p.fraction}% of graduation targets`;
  }).join("\n");

  const userMessage = `Current week: ${currentWeek}
Actual scores: ${JSON.stringify(actualScores)}
Expected scores: ${JSON.stringify(expectedScores)}
Target scores: ${JSON.stringify(targetScores)}
Rebalance tier: ${tier} (${tier === 1 ? "full rebalance of all remaining regular weeks" : "emergency - next 1-2 weeks only"})

Objective: ${objective.name}. Type: ${objective.type}.
Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}
Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Per-dimension status:
${dimStatusLines}
${maintenanceDims.length > 0 ? `\nDimensions in MAINTENANCE MODE: ${maintenanceDims.join(", ")}. Prescribe only 1 session/week at 60% volume for these. Reallocate freed time to behind-schedule dimensions.` : ""}

Remaining regular weeks to regenerate (${weeksToRebalance.length} weeks):
${weeksToRebalance.map((w) => `Week ${w.week_number}: ${w.week_start}, currently ${w.total_hours}h`).join("\n")}`;

  try {
    const responseText = await callClaude(PROMPT_4_SYSTEM, userMessage);
    const parsed = parseClaudeJSON<{ weeks: PlanWeek[] }>(responseText);

    // Calculate realistic durations for each rebalanced week's sessions
    for (const updatedWeek of parsed.weeks) {
      if (updatedWeek.sessions) {
        calculateAllSessionMinutes(updatedWeek.sessions);
      }
    }

    // Update each rebalanced week
    for (const updatedWeek of parsed.weeks) {
      const matchingTarget = weeksToRebalance.find(
        (w) => w.week_number === updatedWeek.weekNumber
      );
      if (matchingTarget) {
        const totalHours = updatedWeek.sessions
          ? calculateWeekTotalHours(updatedWeek.sessions)
          : updatedWeek.totalHoursTarget;
        await supabase
          .from("weekly_targets")
          .update({
            sessions: updatedWeek.sessions,
            total_hours: totalHours,
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
