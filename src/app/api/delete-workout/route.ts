import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { logId } = await request.json();
  if (!logId) {
    return NextResponse.json({ error: "logId is required" }, { status: 400 });
  }

  // Fetch the log
  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("id", logId)
    .single();

  if (logError || !log) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }

  if (log.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { plan_id: planId, week_number: weekNumber } = log;
  let weekReverted = false;

  // Check if this week has been completed (plan has advanced past it)
  if (planId && weekNumber != null) {
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id, objective_id, current_week_number")
      .eq("id", planId)
      .single();

    if (plan && plan.current_week_number > weekNumber) {
      // Week was completed — need to revert scores and un-complete the week
      const objectiveId = plan.objective_id;

      // Find the week_start for this week (used as week_ending in score_history)
      const { data: weekTarget } = await supabase
        .from("weekly_targets")
        .select("week_start")
        .eq("plan_id", planId)
        .eq("week_number", weekNumber)
        .single();

      // Delete score_history entry for this week
      if (weekTarget) {
        await supabase
          .from("score_history")
          .delete()
          .eq("objective_id", objectiveId)
          .eq("week_ending", weekTarget.week_start);
      }

      // Find previous scores to revert to
      const { data: previousScores } = await supabase
        .from("score_history")
        .select("cardio_score, strength_score, climbing_score, flexibility_score")
        .eq("objective_id", objectiveId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (previousScores && previousScores.length > 0) {
        // Revert to previous week's scores
        const prev = previousScores[0];
        await supabase
          .from("objectives")
          .update({
            current_cardio_score: prev.cardio_score,
            current_strength_score: prev.strength_score,
            current_climbing_score: prev.climbing_score,
            current_flexibility_score: prev.flexibility_score,
          })
          .eq("id", objectiveId);
      } else {
        // No prior scores — revert to assessment scores
        const { data: assessment } = await supabase
          .from("assessments")
          .select("cardio_score, strength_score, climbing_score, flexibility_score")
          .eq("user_id", user.id)
          .order("assessed_at", { ascending: false })
          .limit(1)
          .single();

        if (assessment) {
          await supabase
            .from("objectives")
            .update({
              current_cardio_score: assessment.cardio_score,
              current_strength_score: assessment.strength_score,
              current_climbing_score: assessment.climbing_score,
              current_flexibility_score: assessment.flexibility_score,
            })
            .eq("id", objectiveId);
        }
      }

      // Revert current_week_number back to this week
      await supabase
        .from("training_plans")
        .update({ current_week_number: weekNumber })
        .eq("id", planId);

      weekReverted = true;
    }
  }

  // Delete the workout log
  const { error: deleteError } = await supabase
    .from("workout_logs")
    .delete()
    .eq("id", logId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete workout log" }, { status: 500 });
  }

  return NextResponse.json({ success: true, weekReverted });
}
