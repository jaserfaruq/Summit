import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_REPORT_SYSTEM } from "@/lib/prompts";
import { WeeklyReport, Dimension, DimensionScores } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

const DIMENSIONS: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];

export async function generateWeeklyReport(
  supabase: SupabaseClient,
  userId: string,
  planId: string,
  weekNumber: number
): Promise<void> {
  console.log(`[Report] Starting generation for plan=${planId}, week=${weekNumber}, user=${userId}`);

  try {
    // Fetch the weekly target
    const { data: weekTarget, error: weekError } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", planId)
      .eq("week_number", weekNumber)
      .single();

    if (weekError || !weekTarget) {
      console.error(`[Report] Week target not found:`, weekError);
      throw new Error(`Week target not found: ${weekError?.message || "no data"}`);
    }

    console.log(`[Report] Found week target id=${weekTarget.id}, type=${weekTarget.week_type}`);

    // Fetch the plan + objective
    const { data: plan } = await supabase
      .from("training_plans")
      .select("*, objectives(*)")
      .eq("id", planId)
      .single();

    if (!plan) {
      throw new Error("Plan not found");
    }

    const objective = (plan as Record<string, unknown>).objectives as Record<string, unknown>;

    // Fetch all weekly_targets to know totalWeeks
    const { data: allWeeks } = await supabase
      .from("weekly_targets")
      .select("week_number")
      .eq("plan_id", planId);

    const totalWeeks = allWeeks?.length || 0;

    // Fetch workout logs for this week
    const { data: weekLogs } = await supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .eq("week_number", weekNumber);

    const logs = weekLogs || [];

    // Fetch score_history for this week and previous week
    const { data: scoreHistory } = await supabase
      .from("score_history")
      .select("*")
      .eq("user_id", userId)
      .eq("objective_id", objective.id as string)
      .order("created_at", { ascending: false });

    // Find this week's score entry and the previous one
    const allEntries = scoreHistory || [];
    const thisWeekEntry = allEntries.find(
      (e: Record<string, unknown>) => e.week_ending === weekTarget.week_start && e.change_reason === "weekly_rating"
    );
    const previousWeekEntry = (() => {
      const prevWeekNum = weekNumber - 1;
      if (prevWeekNum < 1) return null;
      return allEntries.find(
        (e: Record<string, unknown>) => e.change_reason === "weekly_rating" && e !== thisWeekEntry
      );
    })();

    // Build score change data per dimension
    const targetScores: DimensionScores = {
      cardio: objective.target_cardio_score as number,
      strength: objective.target_strength_score as number,
      climbing_technical: objective.target_climbing_score as number,
      flexibility: objective.target_flexibility_score as number,
    };

    const currentScores: DimensionScores = {
      cardio: objective.current_cardio_score as number,
      strength: objective.current_strength_score as number,
      climbing_technical: objective.current_climbing_score as number,
      flexibility: objective.current_flexibility_score as number,
    };

    const expectedScores = weekTarget.expected_scores as DimensionScores;

    const previousScores: DimensionScores = previousWeekEntry
      ? {
          cardio: (previousWeekEntry as Record<string, unknown>).cardio_score as number,
          strength: (previousWeekEntry as Record<string, unknown>).strength_score as number,
          climbing_technical: (previousWeekEntry as Record<string, unknown>).climbing_score as number,
          flexibility: (previousWeekEntry as Record<string, unknown>).flexibility_score as number,
        }
      : {
          cardio: (objective.current_cardio_score as number) - 3,
          strength: (objective.current_strength_score as number) - 3,
          climbing_technical: (objective.current_climbing_score as number) - 3,
          flexibility: (objective.current_flexibility_score as number) - 3,
        };

    // Build ratings and comments per dimension from logs
    const ratingsPerDimension: Record<string, { rating: number; comment: string }[]> = {};
    for (const dim of DIMENSIONS) {
      const dimLogs = logs.filter((l: Record<string, unknown>) => l.dimension === dim);
      ratingsPerDimension[dim] = dimLogs.map((l: Record<string, unknown>) => ({
        rating: (l.rating as number) || 3,
        comment: (l.rating_comment as string) || "",
      }));
    }

    // Build sessions list
    const sessions = weekTarget.sessions || [];
    const completedCount = logs.length;
    const totalCount = Array.isArray(sessions) ? sessions.length : 0;

    // Build score changes description
    const scoreChanges: Record<string, { before: number; after: number; change: number }> = {};
    for (const dim of DIMENSIONS) {
      const before = previousScores[dim];
      const after = currentScores[dim];
      scoreChanges[dim] = { before, after, change: after - before };
    }

    // Get relevance profiles and taglines
    const relevanceProfiles = objective.relevance_profiles || {};
    const taglines = objective.taglines || {};

    // Check if any dimension has been behind for 2+ weeks
    const recentHistory = allEntries
      .filter((e: Record<string, unknown>) => e.change_reason === "weekly_rating")
      .slice(0, 3);

    // Build the prompt message
    const userMessage = `Objective: ${objective.name as string}${objective.route ? ` via ${objective.route}` : ""}
Week: ${weekNumber} of ${totalWeeks}
Week type: ${weekTarget.week_type}

Sessions prescribed: ${totalCount} sessions
${Array.isArray(sessions) ? sessions.map((s: Record<string, unknown>) => `- ${s.name} (${s.dimension})`).join("\n") : "None"}

Sessions completed: ${completedCount} of ${totalCount}

Ratings given per dimension:
${DIMENSIONS.map((dim) => {
  const dimRatings = ratingsPerDimension[dim];
  if (!dimRatings || dimRatings.length === 0) return `${dim}: No sessions logged`;
  return `${dim}: ${dimRatings.map((r) => `Rating ${r.rating}${r.comment ? ` — "${r.comment}"` : ""}`).join("; ")}`;
}).join("\n")}

Score changes this week:
${DIMENSIONS.map((dim) => {
  const sc = scoreChanges[dim];
  return `${dim}: ${sc.before} → ${sc.after} (${sc.change >= 0 ? "+" : ""}${sc.change})`;
}).join("\n")}

Expected scores at this point (from linear trajectory):
${DIMENSIONS.map((dim) => `${dim}: ${expectedScores[dim]}`).join(", ")}

Target scores:
${DIMENSIONS.map((dim) => `${dim}: ${targetScores[dim]}`).join(", ")}

Relevance profiles:
${DIMENSIONS.map((dim) => {
  const profile = (relevanceProfiles as Record<string, { keyComponents?: string[]; irrelevantComponents?: string[] }>)[dim];
  if (!profile) return `${dim}: No profile`;
  return `${dim} key components: ${(profile.keyComponents || []).join(", ")}`;
}).join("\n")}

Taglines:
${DIMENSIONS.map((dim) => `${dim}: ${(taglines as Record<string, string>)[dim] || "N/A"}`).join(", ")}

${recentHistory.length >= 2 ? `Recent score history (last ${recentHistory.length} weeks available for trend analysis).` : ""}

Write the report with these 5 sections:

## Week Summary
One paragraph. How many sessions completed, ratings breakdown, overall effort level. Acknowledge what they did well first.

## Score Changes & Why
For EACH dimension that had a score change, explain: the score before → after, what caused it. If the athlete rated non-3 and provided a comment, explain in plain language why the training was or wasn't relevant to their objective's key components. For dimensions rated 3 (just right), keep it brief. For missed sessions, explain the -1 regression.

## Where You Stand
For each dimension, one line: actual score vs expected trajectory at this point. Flag anything 3+ points ahead or behind.

## Next Week Focus
2-3 sentences of specific, actionable guidance. Name the session(s) to prioritize. If a dimension has buffer, name it as the one to skip if life gets busy. Be concrete.

## Consider Adjusting?
ONLY include this section (non-null) if any dimension is 4+ points behind trajectory for 2+ consecutive weeks. Otherwise return null for this field.`;

    console.log(`[Report] Calling Claude API for report generation...`);
    const responseText = await callClaude(PROMPT_REPORT_SYSTEM, userMessage, 4096, "sonnet");
    console.log(`[Report] Claude API returned ${responseText.length} chars`);
    const report = parseClaudeJSON<WeeklyReport>(responseText);
    console.log(`[Report] Parsed report successfully, sections: ${Object.keys(report).join(", ")}`);

    if (!report.generatedAt) {
      report.generatedAt = new Date().toISOString();
    }

    // Store report in weekly_targets
    const { error: updateError } = await supabase
      .from("weekly_targets")
      .update({ weekly_report: report })
      .eq("id", weekTarget.id);

    if (updateError) {
      console.error(`[Report] Failed to store report in DB:`, updateError);
      throw new Error(`Failed to store report: ${updateError.message}`);
    }

    console.log(`[Report] Successfully stored report for week ${weekNumber}`);
  } catch (error) {
    console.error("[Report] Error generating weekly report:", error);

    // Write error sentinel so the UI can detect failure instead of polling forever
    try {
      const { data: weekTarget } = await supabase
        .from("weekly_targets")
        .select("id")
        .eq("plan_id", planId)
        .eq("week_number", weekNumber)
        .single();

      if (weekTarget) {
        await supabase
          .from("weekly_targets")
          .update({
            weekly_report: {
              error: true,
              message: error instanceof Error ? error.message : "Failed to generate report",
              generatedAt: new Date().toISOString(),
            },
          })
          .eq("id", weekTarget.id);
      }
    } catch (sentinelError) {
      console.error("Failed to write error sentinel:", sentinelError);
    }
  }
}
