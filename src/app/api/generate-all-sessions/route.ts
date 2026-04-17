import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession, SkillPracticeItem } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours } from "@/lib/scoring";
import { buildSessionUserMessage } from "@/lib/build-session-message";

// Allow up to 5 minutes for batch generation of all weeks
export const maxDuration = 300;

const MAX_CONCURRENT = 3; // Generate 3 weeks in parallel at a time

interface GenerateAllSessionsRequest {
  planId: string;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateAllSessionsRequest = await request.json();
  const { planId } = body;

  // Fetch the plan
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Fetch all weekly targets
  const { data: allWeeks, error: weeksError } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .order("week_number");

  if (weeksError || !allWeeks) {
    return NextResponse.json({ error: "Weeks not found" }, { status: 404 });
  }

  // Filter to weeks that don't already have sessions
  const weeksToGenerate = allWeeks.filter(
    (w) => !w.sessions || (w.sessions as PlanSession[]).length === 0
  );

  if (weeksToGenerate.length === 0) {
    return NextResponse.json({ generated: 0, total: allWeeks.length });
  }

  // Fetch objective and profile once (shared across all weeks)
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", plan.objective_id)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const totalWeeks = allWeeks.length;

  // Extract programmingHints and climbing role for session generation
  const programmingHints = plan.plan_data?.programmingHints || null;
  const climbingRole = objective.climbing_role || null;
  const daysPerWeek = profile?.training_days_per_week || 5;

  // Generate sessions in batches of MAX_CONCURRENT
  let generated = 0;
  const errors: { weekNumber: number; error: string }[] = [];

  for (let i = 0; i < weeksToGenerate.length; i += MAX_CONCURRENT) {
    const batch = weeksToGenerate.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (weekTarget) => {
        const userMessage = buildSessionUserMessage(
          profile, objective,
          { week_number: weekTarget.week_number as number, week_type: weekTarget.week_type as string, week_start: weekTarget.week_start as string, total_hours: weekTarget.total_hours as number, expected_scores: weekTarget.expected_scores as Record<string, number> },
          totalWeeks, programmingHints, climbingRole, daysPerWeek
        );

        const responseText = await callClaudeWithCache(
          PROMPT_2B_SYSTEM, userMessage, 8192, "opus4_7"
        );
        const result = parseClaudeJSON<{ sessions: PlanSession[]; suggestedSkillPractice?: SkillPracticeItem[] }>(responseText);
        calculateAllSessionMinutes(result.sessions);

        const totalHours = calculateWeekTotalHours(result.sessions);
        const updateData: Record<string, unknown> = { sessions: result.sessions, total_hours: totalHours };
        if (result.suggestedSkillPractice && result.suggestedSkillPractice.length > 0) {
          updateData.suggested_skill_practice = result.suggestedSkillPractice;
        }
        const { error: updateError } = await supabase
          .from("weekly_targets")
          .update(updateData)
          .eq("id", weekTarget.id);

        if (updateError) {
          // If update failed (e.g., suggested_skill_practice column missing), retry without it
          if (result.suggestedSkillPractice) {
            const { error: retryError } = await supabase
              .from("weekly_targets")
              .update({ sessions: result.sessions, total_hours: totalHours })
              .eq("id", weekTarget.id);
            if (retryError) {
              throw new Error(`DB update failed for week ${weekTarget.week_number}: ${retryError.message}`);
            }
          } else {
            throw new Error(`DB update failed for week ${weekTarget.week_number}: ${updateError.message}`);
          }
        }

        return weekTarget.week_number;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        generated++;
      } else {
        const errorMsg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        errors.push({ weekNumber: -1, error: errorMsg });
      }
    }
  }

  return NextResponse.json({
    generated,
    total: allWeeks.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}

