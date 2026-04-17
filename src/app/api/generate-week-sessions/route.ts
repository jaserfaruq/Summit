import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";
import { callClaudeWithCache, parseClaudeJSON, streamClaudeWithCache } from "@/lib/claude";
import { PROMPT_2B_SYSTEM } from "@/lib/prompts";
import { PlanSession, SkillPracticeItem } from "@/lib/types";
import { calculateAllSessionMinutes, calculateWeekTotalHours } from "@/lib/scoring";
import { checkAndCreateNotifications } from "@/lib/partner-notifications";
import { buildSessionUserMessage } from "@/lib/build-session-message";

export const maxDuration = 120;

interface GenerateWeekSessionsRequest {
  planId: string;
  weekNumber: number;
  stream?: boolean;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GenerateWeekSessionsRequest = await request.json();
  const { planId, weekNumber, stream: useStreaming } = body;

  // Fetch the plan — RLS ensures user can only see their own plans
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("*")
    .eq("id", planId)
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
    return NextResponse.json({ sessions: weekTarget.sessions, suggestedSkillPractice: weekTarget.suggested_skill_practice || null });
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

  const daysPerWeek = profile?.training_days_per_week || 5;
  const userMessage = buildSessionUserMessage(
    profile,
    objective,
    { week_number: weekNumber, week_type: weekTarget.week_type, week_start: weekTarget.week_start, total_hours: weekTarget.total_hours, expected_scores: weekTarget.expected_scores as Record<string, number> },
    totalWeeks || weekNumber,
    programmingHints,
    climbingRole,
    daysPerWeek
  );

  // Helper to save sessions to DB and trigger partner notifications
  // Uses service client to bypass RLS — the user client's auth context may expire
  // during streaming flush, causing silent save failures.
  async function saveSessions(sessions: PlanSession[], suggestedSkillPractice?: SkillPracticeItem[]) {
    const serviceClient = createServiceClient();
    const totalHours = calculateWeekTotalHours(sessions);
    const updateData: Record<string, unknown> = { sessions, total_hours: totalHours };
    if (suggestedSkillPractice && suggestedSkillPractice.length > 0) {
      updateData.suggested_skill_practice = suggestedSkillPractice;
    }
    const { error: updateError } = await serviceClient
      .from("weekly_targets")
      .update(updateData)
      .eq("id", weekTarget.id);
    if (updateError) {
      console.error("Error saving week sessions:", JSON.stringify(updateError));
      // Retry with just sessions and total_hours (in case suggested_skill_practice column doesn't exist)
      const { error: retryError } = await serviceClient
        .from("weekly_targets")
        .update({ sessions, total_hours: totalHours })
        .eq("id", weekTarget.id);
      if (retryError) {
        console.error("Error saving week sessions (retry):", JSON.stringify(retryError));
      } else {
        console.log("Retry save succeeded for week", weekTarget.week_number);
      }
    } else {
      console.log("Sessions saved successfully for week", weekTarget.week_number, "- session count:", sessions.length);
    }
    checkAndCreateNotifications(user!.id, planId, weekNumber, sessions, serviceClient)
      .catch((err) => console.error("Error creating partner notifications:", err));
  }

  if (useStreaming) {
    // Streaming mode: send text chunks as they arrive, then save to DB
    try {
      const claudeStream = streamClaudeWithCache(PROMPT_2B_SYSTEM, userMessage, 8192, "opus4_7");
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let accumulated = "";

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          accumulated += text;
          // Send raw text chunk to client for progressive display
          controller.enqueue(chunk);
        },
        async flush(controller) {
          // Stream complete — parse, save, and send final JSON as last event
          try {
            const result = parseClaudeJSON<{ sessions: PlanSession[]; suggestedSkillPractice?: SkillPracticeItem[] }>(accumulated);
            calculateAllSessionMinutes(result.sessions);
            await saveSessions(result.sessions, result.suggestedSkillPractice);
            // Send a delimiter + final parsed JSON so client can extract it
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

  // Non-streaming mode (used by generate-all-sessions background, pre-generation)
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

