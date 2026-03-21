import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assessmentId } = await request.json();
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId is required" }, { status: 400 });
  }

  // Verify the assessment belongs to the user
  const { data: assessment, error: assessError } = await supabase
    .from("assessments")
    .select("id, user_id, objective_id")
    .eq("id", assessmentId)
    .eq("user_id", user.id)
    .single();

  if (assessError || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Delete the assessment
  const { error: deleteError } = await supabase
    .from("assessments")
    .delete()
    .eq("id", assessmentId);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete assessment" }, { status: 500 });
  }

  // Reset current scores on the objective back to 0
  if (assessment.objective_id) {
    await supabase
      .from("objectives")
      .update({
        current_cardio_score: 0,
        current_strength_score: 0,
        current_climbing_score: 0,
        current_flexibility_score: 0,
      })
      .eq("id", assessment.objective_id);
  }

  return NextResponse.json({ success: true });
}
