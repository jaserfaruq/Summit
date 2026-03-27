import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours, dimensionProgressFractions } from "@/lib/scoring";
import { checkAndCreateNotifications } from "@/lib/partner-notifications";

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

  // Extract programmingHints from plan_data
  const programmingHints = plan.plan_data?.programmingHints || null;
  const climbingRole = objective.climbing_role || null;

  const programmingHintsBlock = programmingHints
    ? `\nATHLETE PROFILE (from assessment):\n${JSON.stringify(programmingHints, null, 2)}\nClimbing role: ${climbingRole || "not specified"}\n\nUse the programming hints to adapt session content to this specific athlete:\n- Start exercises at the recommended intensity level\n- Allocate time across dimensions as recommended\n- Apply specific adaptations noted above\n- If a dimension is flagged as "maintain", prescribe maintenance-level volume\n`
    : "";

  const daysPerWeek = profile?.training_days_per_week || 5;
  const userMessage = `Athlete profile: Available ${daysPerWeek} days/week. Generate EXACTLY ${daysPerWeek} sessions total — no more, no fewer. Equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}. Location: ${profile?.location || "not specified"}. Injuries: none.
${programmingHintsBlock}
Objective: ${objective.name}. Type: ${objective.type}. Target date: ${objective.target_date}. Distance: ${objective.distance_miles || "N/A"} miles. Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft. Technical grade: ${objective.technical_grade || "N/A"}.

Current scores: Cardio ${objective.current_cardio_score}, Strength ${objective.current_strength_score}, Climbing/Technical ${objective.current_climbing_score}, Flexibility ${objective.current_flexibility_score}.
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}.

THIS IS WEEK ${weekNumber} of ${totalWeeks || "?"} total weeks.
Week start date: ${weekTarget.week_start}.
Target hours: ${weekTarget.total_hours}.
Expected scores this week: ${JSON.stringify(weekTarget.expected_scores)}.

Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

${buildProgressFractionBlock(objective, weekNumber, totalWeeks || weekNumber)}`;

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

    // Fire-and-forget: check for partner matches and create notifications
    const serviceClient = createServiceClient();
    checkAndCreateNotifications(user.id, planId, weekNumber, result.sessions, serviceClient)
      .catch((err) => console.error("Error creating partner notifications:", err));

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

  const dimLabels: Record<string, string> = {
    cardio: "Cardio",
    strength: "Strength",
    climbing_technical: "Climbing/Technical",
    flexibility: "Flexibility",
  };

  const lines: string[] = [];
  const maintenanceDims: string[] = [];

  for (const [dim, label] of Object.entries(dimLabels)) {
    const prog = fractions[dim];
    const current = currentScores[dim as keyof typeof currentScores];
    const target = targetScores[dim as keyof typeof targetScores];

    if (prog.maintenance) {
      const performanceRatio = target > 0 ? Math.round((current / target) * 100) : 100;
      lines.push(`- ${label}: MAINTENANCE MODE (1 session/week, 60% volume) — current ${current} vs target ${target}. Athlete performs at ~${performanceRatio}% of graduation benchmarks. Prescribe the single session at this higher level, not at graduation target level.`);
      maintenanceDims.push(label);
    } else if (current >= target) {
      lines.push(`- ${label}: ${prog.fraction}% (already meets target — maintenance with slight progression)`);
    } else {
      lines.push(`- ${label}: ${prog.fraction}%`);
    }
  }

  let result = `Per-dimension progress fractions for Week ${weekNumber} (percentage of graduation targets this week's sessions should reach):
${lines.join("\n")}

IMPORTANT: These percentages reflect the athlete's CURRENT fitness level. Do NOT prescribe beginner-level training for dimensions where the athlete is already strong. Match session intensity to the progress fraction shown.`;

  if (maintenanceDims.length > 0) {
    result += `\n\nMAINTENANCE REALLOCATION: ${maintenanceDims.join(", ")} ${maintenanceDims.length === 1 ? "is" : "are"} in maintenance mode. Reallocate freed training time to dimensions furthest below their target scores, prioritizing the dimension with the highest target score.`;
  }

  return result;
}
