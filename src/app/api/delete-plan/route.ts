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
    .select("id, user_id")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (plan.user_id !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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

  return NextResponse.json({ success: true });
}
