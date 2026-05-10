import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON, streamClaudeWithCache } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession, SkillPracticeItem, DimensionScores, ProgrammingHints } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours } from "@/lib/scoring";
import { checkAndCreateNotifications } from "@/lib/partner-notifications";
import { buildSessionUserMessage } from "@/lib/build-session-message";

export const maxDuration = 120;

interface GuestWeekTarget {
  week_number: number;
  week_type: string;
  week_start: string;
  total_hours: number;
  expected_scores: DimensionScores;
}

interface GuestObjective {
  name: string;
  type: string;
  target_date: string;
  distance_miles: number | null;
  elevation_gain_ft: number | null;
  technical_grade: string | null;
  target_cardio_score: number;
  target_strength_score: number;
  target_climbing_score: number;
  target_flexibility_score: number;
  current_cardio_score: number;
  current_strength_score: number;
  current_climbing_score: number;
  current_flexibility_score: number;
  graduation_benchmarks: unknown;
  relevance_profiles: unknown;
  climbing_role: "lead" | "follow" | null;
}

interface GenerateWeekSessionsRequest {
  planId?: string;
  weekNumber: number;
  stream?: boolean;
  // Guest-mode payload (when no planId)
  objective?: GuestObjective;
  weekTarget?: GuestWeekTarget;
  totalWeeks?: number;
  programmingHints?: ProgrammingHints | null;
  trainingDaysPerWeek?: number;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body: GenerateWeekSessionsRequest = await request.json();
  const { planId, weekNumber, stream: useStreaming } = body;

  let objective: GuestObjective;
  let weekTarget: GuestWeekTarget;
  let weekTargetId: string | null = null;
  let totalWeeks: number;
  let programmingHints: ProgrammingHints | null = null;
  let climbingRole: string | null = null;
  let daysPerWeek: number;
  let userIdForNotif: string | null = null;
  let profileForMessage: { training_days_per_week?: number; equipment_access?: string[]; location?: string } | null = null;

  if (user && planId) {
    // Authed path: fetch from DB
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const { data: weekTargetRow, error: weekError } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", planId)
      .eq("week_number", weekNumber)
      .single();

    if (weekError || !weekTargetRow) {
      return NextResponse.json({ error: "Week not found" }, { status: 404 });
    }

    if (weekTargetRow.sessions && (weekTargetRow.sessions as PlanSession[]).length > 0) {
      return NextResponse.json({ sessions: weekTargetRow.sessions, suggestedSkillPractice: weekTargetRow.suggested_skill_practice || null });
    }

    const { data: dbObjective, error: objError } = await supabase
      .from("objectives")
      .select("*")
      .eq("id", plan.objective_id)
      .single();

    if (objError || !dbObjective) {
      return NextResponse.json({ error: "Objective not found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const { count } = await supabase
      .from("weekly_targets")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    objective = dbObjective as GuestObjective;
    weekTarget = {
      week_number: weekTargetRow.week_number,
      week_type: weekTargetRow.week_type,
      week_start: weekTargetRow.week_start,
      total_hours: weekTargetRow.total_hours,
      expected_scores: weekTargetRow.expected_scores as DimensionScores,
    };
    weekTargetId = weekTargetRow.id;
    totalWeeks = count || weekNumber;
    programmingHints = (plan.plan_data?.programmingHints as ProgrammingHints | null) || null;
    climbingRole = dbObjective.climbing_role || null;
    daysPerWeek = profile?.training_days_per_week || 5;
    userIdForNotif = user.id;
    profileForMessage = profile;
  } else if (body.objective && body.weekTarget && body.totalWeeks) {
    // Guest path: trust the inline payload
    objective = body.objective;
    weekTarget = body.weekTarget;
    totalWeeks = body.totalWeeks;
    programmingHints = body.programmingHints || null;
    climbingRole = body.objective.climbing_role || null;
    daysPerWeek = body.trainingDaysPerWeek || 5;
    profileForMessage = { training_days_per_week: daysPerWeek };
  } else {
    return NextResponse.json(
      { error: "planId (when authenticated) or objective+weekTarget+totalWeeks (guest) is required" },
      { status: 400 }
    );
  }

  const userMessage = buildSessionUserMessage(
    profileForMessage,
    objective as unknown as Record<string, unknown>,
    {
      week_number: weekTarget.week_number,
      week_type: weekTarget.week_type,
      week_start: weekTarget.week_start,
      total_hours: weekTarget.total_hours,
      expected_scores: weekTarget.expected_scores as unknown as Record<string, number>,
    },
    totalWeeks,
    programmingHints as unknown as Record<string, unknown> | null,
    climbingRole,
    daysPerWeek
  );

  // Helper to save sessions to DB and trigger partner notifications (authed only)
  async function saveSessions(sessions: PlanSession[], suggestedSkillPractice?: SkillPracticeItem[]) {
    if (!weekTargetId || !userIdForNotif || !planId) return;
    const serviceClient = createServiceClient();
    const totalHours = calculateWeekTotalHours(sessions);
    const updateData: Record<string, unknown> = { sessions, total_hours: totalHours };
    if (suggestedSkillPractice && suggestedSkillPractice.length > 0) {
      updateData.suggested_skill_practice = suggestedSkillPractice;
    }
    const { error: updateError } = await serviceClient
      .from("weekly_targets")
      .update(updateData)
      .eq("id", weekTargetId);
    if (updateError) {
      console.error("Error saving week sessions:", JSON.stringify(updateError));
      const { error: retryError } = await serviceClient
        .from("weekly_targets")
        .update({ sessions, total_hours: totalHours })
        .eq("id", weekTargetId);
      if (retryError) {
        console.error("Error saving week sessions (retry):", JSON.stringify(retryError));
      } else {
        console.log("Retry save succeeded for week", weekTarget.week_number);
      }
    } else {
      console.log("Sessions saved successfully for week", weekTarget.week_number, "- session count:", sessions.length);
    }
    checkAndCreateNotifications(userIdForNotif, planId, weekNumber, sessions, serviceClient)
      .catch((err) => console.error("Error creating partner notifications:", err));
  }

  if (useStreaming) {
    try {
      const claudeStream = streamClaudeWithCache(PROMPT_2B_SYSTEM, userMessage, 8192, "opus4_7");
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let accumulated = "";

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          accumulated += text;
          controller.enqueue(chunk);
        },
        async flush(controller) {
          try {
            const result = parseClaudeJSON<{ sessions: PlanSession[]; suggestedSkillPractice?: SkillPracticeItem[] }>(accumulated);
            calculateAllSessionMinutes(result.sessions);
            await saveSessions(result.sessions, result.suggestedSkillPractice);
            controller.enqueue(encoder.encode("\n__SESSIONS_JSON__\n" + JSON.stringify({ sessions: result.sessions, suggestedSkillPractice: result.suggestedSkillPractice })));
          } catch (parseErr) {
            controller.enqueue(encoder.encode("\n__SESSIONS_ERROR__\n" + String(parseErr)));
          }
        },
      });

      const responseStream = claudeStream.pipeThrough(transformStream);
      return new Response(responseStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
        },
      });
    } catch (error: unknown) {
      console.error("Error streaming week sessions:", error);
      const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };
      const detail = err.error?.message || err.message || String(error);
      return NextResponse.json({ error: `Failed to generate sessions: ${detail}` }, { status: 500 });
    }
  }

  // Non-streaming mode
  try {
    const responseText = await callClaudeWithCache(PROMPT_2B_SYSTEM, userMessage, 8192, "opus4_7");
    const result = parseClaudeJSON<{ sessions: PlanSession[]; suggestedSkillPractice?: SkillPracticeItem[] }>(responseText);
    calculateAllSessionMinutes(result.sessions);
    await saveSessions(result.sessions, result.suggestedSkillPractice);

    return NextResponse.json({ sessions: result.sessions, suggestedSkillPractice: result.suggestedSkillPractice });
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
