import { createClient } from "@/lib/supabase-server";
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
    .select("id, user_id, objective_id")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (plan.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Detach workout_logs from this plan (keep logs, just remove the FK reference)
  await supabase
    .from("workout_logs")
    .update({ plan_id: null })
    .eq("plan_id", planId);

  // Delete weekly_targets first (foreign key dependency)
  const { error: weeksError } = await supabase
    .from("weekly_targets")
    .delete()
    .eq("plan_id", planId);

  if (weeksError) {
    return NextResponse.json({ error: "Failed to delete weekly targets" }, { status: 500 });
  }

  // Delete the plan
  const { error: deleteError } = await supabase
    .from("training_plans")
    .delete()
    .eq("id", planId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }

  // Delete the associated objective (plan and objective are linked 1:1 in V1)
  if (plan.objective_id) {
    // Delete score_history first (foreign key dependency on objective)
    await supabase
      .from("score_history")
      .delete()
      .eq("objective_id", plan.objective_id);

    await supabase
      .from("objectives")
      .delete()
      .eq("id", plan.objective_id);
  }

  return NextResponse.json({ success: true });
}
