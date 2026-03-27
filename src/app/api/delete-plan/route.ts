import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
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

    // Try to get a service client for cross-user cleanup, fall back to regular client
    let deleteClient = supabase;
    try {
      const { createServiceClient } = await import("@/lib/supabase-service");
      deleteClient = createServiceClient();
    } catch (e) {
      console.warn("[delete-plan] Service client unavailable, using regular client:", e);
    }

    // 1. Delete partner_notifications referencing this plan
    // These have FK refs to training_plans — must be deleted first
    await deleteClient.from("partner_notifications").delete().eq("plan_id", planId);
    await deleteClient.from("partner_notifications").delete().eq("partner_plan_id", planId);

    // 2. Detach workout_logs from this plan (keep logs, remove FK reference)
    await supabase.from("workout_logs").update({ plan_id: null }).eq("plan_id", planId);

    // 3. Delete weekly_targets
    const { error: weeksError } = await supabase
      .from("weekly_targets")
      .delete()
      .eq("plan_id", planId);
    if (weeksError) {
      console.error("[delete-plan] weekly_targets:", weeksError);
      return NextResponse.json({ error: "weekly_targets: " + weeksError.message }, { status: 500 });
    }

    // 4. Delete the plan itself
    const { error: deleteError } = await supabase
      .from("training_plans")
      .delete()
      .eq("id", planId);
    if (deleteError) {
      console.error("[delete-plan] training_plans:", deleteError);
      return NextResponse.json({ error: "training_plans: " + deleteError.message }, { status: 500 });
    }

    // 5. Clean up objective and related data
    if (plan.objective_id) {
      // Delete assessments (migration 002 FK lacks CASCADE)
      await supabase.from("assessments").delete().eq("objective_id", plan.objective_id);

      // These have ON DELETE CASCADE from migration 001, but explicit for safety
      await supabase.from("score_history").delete().eq("objective_id", plan.objective_id);
      await supabase.from("component_feedback").delete().eq("objective_id", plan.objective_id);

      // Delete the objective
      const { error: objError } = await supabase
        .from("objectives")
        .delete()
        .eq("id", plan.objective_id);
      if (objError) {
        console.error("[delete-plan] objective:", objError);
        // Plan is already deleted — don't fail the whole request
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[delete-plan] unexpected error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
