import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours } from "@/lib/scoring";

export const maxDuration = 120;

interface GenerateWeekSessionsRequest {
  planId: string;
  weekNumber: number;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateWeekSessionsRequest = await request.json();
  const { planId, weekNumber } = body;

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

  // Fetch the specific weekly target
  const { data: weekTarget, error: weekError } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .single();

  if (weekError || !weekTarget) {
    return NextResponse.json({ error: "Week not found" }, { status: 404 });
  }

  // If sessions already exist, return them
  if (weekTarget.sessions && (weekTarget.sessions as PlanSession[]).length > 0) {
    return NextResponse.json({ sessions: weekTarget.sessions });
  }

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

  // Calculate total weeks in plan
  const { count: totalWeeks } = await supabase
    .from("weekly_targets")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId);

  const userMessage = `Athlete profile: Available ${profile?.training_days_per_week || 5}/week. Equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}. Location: ${profile?.location || "not specified"}. Injuries: none.

Objective: ${objective.name}. Type: ${objective.type}. Target date: ${objective.target_date}. Distance: ${objective.distance_miles || "N/A"} miles. Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft. Technical grade: ${objective.technical_grade || "N/A"}.

Current scores: Cardio ${objective.current_cardio_score}, Strength ${objective.current_strength_score}, Climbing/Technical ${objective.current_climbing_score}, Flexibility ${objective.current_flexibility_score}.
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}.

THIS IS WEEK ${weekNumber} of ${totalWeeks || "?"} total weeks.
Week type: ${weekTarget.week_type}.
Week start date: ${weekTarget.week_start}.
Target hours: ${weekTarget.total_hours}.
Expected scores this week: ${JSON.stringify(weekTarget.expected_scores)}.

Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

Progress fraction: Week ${weekNumber} sessions should be at approximately ${Math.round((weekNumber / (totalWeeks || weekNumber)) * 100)}% of graduation targets.`;

  try {
    const responseText = await callClaudeWithCache(PROMPT_2B_SYSTEM, userMessage, 8192, "opus");
    const result = parseClaudeJSON<{ sessions: PlanSession[] }>(responseText);
    calculateAllSessionMinutes(result.sessions);

    // Save sessions and recalculated total hours to the weekly target
    const totalHours = calculateWeekTotalHours(result.sessions);
    const { error: updateError } = await supabase
      .from("weekly_targets")
      .update({ sessions: result.sessions, total_hours: totalHours })
      .eq("id", weekTarget.id);

    if (updateError) {
      console.error("Error saving week sessions:", updateError);
    }

    return NextResponse.json({ sessions: result.sessions });
  } catch (error: unknown) {
    console.error("Error generating week sessions:", error);
    const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
    const detail = err.error?.message || err.message || String(error);
    const errorType = err.error?.type || (err.message?.includes("timed out") ? "timeout" : "unknown");
    return NextResponse.json(
      {
        error: `Failed to generate sessions: ${detail}`,
        errorType,
        errorStatus: err.status,
      },
      { status: 500 }
    );
  }
}
