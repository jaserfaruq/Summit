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

  // Use service client for the entire cascade — needed because partner_notifications
  // may reference this plan via partner_plan_id (belonging to other users, invisible to RLS)
  const serviceClient = createServiceClient();

  // 1. Delete partner_notifications referencing this plan (as plan_id or partner_plan_id)
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

  // 2. Detach workout_logs from this plan (keep logs, just remove the FK reference)
  const { error: logsError } = await serviceClient
    .from("workout_logs")
    .update({ plan_id: null })
    .eq("plan_id", planId)
    .eq("user_id", user.id);
  if (logsError) console.error("[delete-plan] workout_logs detach:", logsError);

  // 3. Delete weekly_targets (also cascades via ON DELETE CASCADE, but explicit for safety)
  const { error: weeksError } = await serviceClient
    .from("weekly_targets")
    .delete()
    .eq("plan_id", planId);

  if (weeksError) {
    console.error("[delete-plan] weekly_targets:", weeksError);
    return NextResponse.json({ error: "Failed to delete weekly targets: " + weeksError.message }, { status: 500 });
  }

  // 4. Delete the plan
  const { error: deleteError } = await serviceClient
    .from("training_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("[delete-plan] training_plans:", deleteError);
    return NextResponse.json({ error: "Failed to delete plan: " + deleteError.message }, { status: 500 });
  }

  // 5. Clean up objective and related data
  if (plan.objective_id) {
    // Delete assessments linked to this objective
    const { error: assessError } = await serviceClient
      .from("assessments")
      .delete()
      .eq("objective_id", plan.objective_id)
      .eq("user_id", user.id);
    if (assessError) console.error("[delete-plan] assessments:", assessError);

    // Delete score_history (also cascades, but explicit)
    const { error: scoreError } = await serviceClient
      .from("score_history")
      .delete()
      .eq("objective_id", plan.objective_id)
      .eq("user_id", user.id);
    if (scoreError) console.error("[delete-plan] score_history:", scoreError);

    // Delete component_feedback for this objective
    const { error: feedbackError } = await serviceClient
      .from("component_feedback")
      .delete()
      .eq("objective_id", plan.objective_id)
      .eq("user_id", user.id);
    if (feedbackError) console.error("[delete-plan] component_feedback:", feedbackError);

    // Delete the objective itself
    const { error: objError } = await serviceClient
      .from("objectives")
      .delete()
      .eq("id", plan.objective_id)
      .eq("user_id", user.id);
    if (objError) console.error("[delete-plan] objective:", objError);
  }

  return NextResponse.json({ success: true });
}
