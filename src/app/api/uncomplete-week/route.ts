import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId, weekNumber } = await request.json();
  if (!planId || weekNumber == null) {
    return NextResponse.json({ error: "planId and weekNumber are required" }, { status: 400 });
  }

  // Fetch plan and verify ownership
  const { data: plan } = await supabase
    .from("training_plans")
    .select("id, objective_id, current_week_number, user_id")
    .eq("id", planId)
    .single();

  if (!plan || plan.user_id !== user.id) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Only allow uncompleting weeks that have actually been completed
  if (plan.current_week_number <= weekNumber) {
    return NextResponse.json({ error: "This week has not been completed yet" }, { status: 400 });
  }

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

  // Delete the weekly report so it doesn't show stale data
  const { data: weekTargetFull } = await supabase
    .from("weekly_targets")
    .select("id")
    .eq("plan_id", planId)
    .eq("week_number", weekNumber)
    .single();

  if (weekTargetFull) {
    await supabase
      .from("weekly_targets")
      .update({ weekly_report: null })
      .eq("id", weekTargetFull.id);
  }

  // Find previous scores to revert to
  const { data: previousScores } = await supabase
    .from("score_history")
    .select("cardio_score, strength_score, climbing_score, flexibility_score")
    .eq("objective_id", objectiveId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (previousScores && previousScores.length > 0) {
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
      .eq("objective_id", objectiveId)
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

  return NextResponse.json({ success: true });
}
