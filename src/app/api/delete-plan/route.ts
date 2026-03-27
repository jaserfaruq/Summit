import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planId } = await request.json();
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  // Verify the plan belongs to the user
  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select("id, user_id, objective_id, assessment_id")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (plan.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Delete partner_notifications referencing this plan (either as user's plan or partner's plan)
  // Uses service role client to bypass RLS — notifications may belong to other users (partner_plan_id)
  const serviceClient = createServiceClient();
  const { error: pn1Error } = await serviceClient
    .from("partner_notifications")
    .delete()
    .eq("plan_id", planId);
  if (pn1Error) console.error("[delete-plan] partner_notifications (plan_id):", pn1Error);

  const { error: pn2Error } = await serviceClient
    .from("partner_notifications")
    .delete()
    .eq("partner_plan_id", planId);
  if (pn2Error) console.error("[delete-plan] partner_notifications (partner_plan_id):", pn2Error);

  // Detach workout_logs from this plan (keep logs, just remove the FK reference)
  const { error: logsError } = await supabase
    .from("workout_logs")
    .update({ plan_id: null })
    .eq("plan_id", planId);
  if (logsError) console.error("[delete-plan] workout_logs detach:", logsError);

  // Delete weekly_targets first (foreign key dependency)
  const { error: weeksError } = await supabase
    .from("weekly_targets")
    .delete()
    .eq("plan_id", planId);

  if (weeksError) {
    console.error("[delete-plan] weekly_targets:", weeksError);
    return NextResponse.json({ error: "Failed to delete weekly targets: " + weeksError.message }, { status: 500 });
  }

  // Delete the plan
  const { error: deleteError } = await supabase
    .from("training_plans")
    .delete()
    .eq("id", planId);

  if (deleteError) {
    console.error("[delete-plan] training_plans:", deleteError);
    return NextResponse.json({ error: "Failed to delete plan: " + deleteError.message }, { status: 500 });
  }

  // Delete the associated assessment
  if (plan.assessment_id) {
    const { error: assessError } = await supabase
      .from("assessments")
      .delete()
      .eq("id", plan.assessment_id);
    if (assessError) console.error("[delete-plan] assessment:", assessError);
  }

  // Delete the associated objective (plan and objective are linked 1:1 in V1)
  if (plan.objective_id) {
    // Delete any remaining assessments linked to this objective
    const { error: objAssessError } = await supabase
      .from("assessments")
      .delete()
      .eq("objective_id", plan.objective_id);
    if (objAssessError) console.error("[delete-plan] objective assessments:", objAssessError);

    // Delete score_history first (foreign key dependency on objective)
    const { error: scoreError } = await supabase
      .from("score_history")
      .delete()
      .eq("objective_id", plan.objective_id);
    if (scoreError) console.error("[delete-plan] score_history:", scoreError);

    // Delete component_feedback for this objective
    const { error: feedbackError } = await supabase
      .from("component_feedback")
      .delete()
      .eq("objective_id", plan.objective_id);
    if (feedbackError) console.error("[delete-plan] component_feedback:", feedbackError);

    const { error: objError } = await supabase
      .from("objectives")
      .delete()
      .eq("id", plan.objective_id);
    if (objError) console.error("[delete-plan] objective:", objError);
  }

  return NextResponse.json({ success: true });
}
