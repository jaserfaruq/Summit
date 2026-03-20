import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours, dimensionProgressFractions } from "@/lib/scoring";

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
    .eq("user_id", user.id)
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

  // Generate sessions in batches of MAX_CONCURRENT
  let generated = 0;
  const errors: { weekNumber: number; error: string }[] = [];

  for (let i = 0; i < weeksToGenerate.length; i += MAX_CONCURRENT) {
    const batch = weeksToGenerate.slice(i, i + MAX_CONCURRENT);

    const results = await Promise.allSettled(
      batch.map(async (weekTarget) => {
        const userMessage = buildUserMessage(
          profile, objective, weekTarget, totalWeeks
        );

        const responseText = await callClaudeWithCache(
          PROMPT_2B_SYSTEM, userMessage, 8192, "opus"
        );
        const result = parseClaudeJSON<{ sessions: PlanSession[] }>(responseText);
        calculateAllSessionMinutes(result.sessions);

        const totalHours = calculateWeekTotalHours(result.sessions);
        const { error: updateError } = await supabase
          .from("weekly_targets")
          .update({ sessions: result.sessions, total_hours: totalHours })
          .eq("id", weekTarget.id);

        if (updateError) {
          throw new Error(`DB update failed for week ${weekTarget.week_number}: ${updateError.message}`);
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

function buildUserMessage(
  profile: { training_days_per_week?: number; equipment_access?: string[]; location?: string } | null,
  objective: Record<string, unknown>,
  weekTarget: Record<string, unknown>,
  totalWeeks: number
): string {
  const weekNumber = weekTarget.week_number as number;
  return `Athlete profile: Available ${profile?.training_days_per_week || 5}/week. Equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}. Location: ${profile?.location || "not specified"}. Injuries: none.

Objective: ${objective.name}. Type: ${objective.type}. Target date: ${objective.target_date}. Distance: ${objective.distance_miles || "N/A"} miles. Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft. Technical grade: ${objective.technical_grade || "N/A"}.

Current scores: Cardio ${objective.current_cardio_score}, Strength ${objective.current_strength_score}, Climbing/Technical ${objective.current_climbing_score}, Flexibility ${objective.current_flexibility_score}.
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}.

THIS IS WEEK ${weekNumber} of ${totalWeeks} total weeks.
Week type: ${weekTarget.week_type}.
Week start date: ${weekTarget.week_start}.
Target hours: ${weekTarget.total_hours}.
Expected scores this week: ${JSON.stringify(weekTarget.expected_scores)}.

Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

${buildProgressFractionBlock(objective, weekNumber, totalWeeks)}`;
}

function buildProgressFractionBlock(
  objective: Record<string, unknown>,
  weekNumber: number,
  totalWeeks: number
): string {
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
  const fractions = dimensionProgressFractions(currentScores, targetScores, weekNumber, totalWeeks);

  return `Per-dimension progress fractions for Week ${weekNumber} (percentage of graduation targets this week's sessions should reach):
- Cardio: ${fractions.cardio}%${currentScores.cardio >= targetScores.cardio ? " (already meets target — maintenance with slight progression)" : ""}
- Strength: ${fractions.strength}%${currentScores.strength >= targetScores.strength ? " (already meets target — maintenance with slight progression)" : ""}
- Climbing/Technical: ${fractions.climbing_technical}%${currentScores.climbing_technical >= targetScores.climbing_technical ? " (already meets target — maintenance with slight progression)" : ""}
- Flexibility: ${fractions.flexibility}%${currentScores.flexibility >= targetScores.flexibility ? " (already meets target — maintenance with slight progression)" : ""}

IMPORTANT: These percentages reflect the athlete's CURRENT fitness level. Do NOT prescribe beginner-level training for dimensions where the athlete is already strong. Match session intensity to the progress fraction shown.`;
}
