import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { VALIDATED_OBJECTIVE_SEED_DATA } from "@/lib/seed-data";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { name: string; status: string; error?: string }[] = [];
  const updatedUserObjectiveIds: string[] = [];

  for (const obj of VALIDATED_OBJECTIVE_SEED_DATA) {
    // Update the validated objective
    const { data: vo, error } = await supabase
      .from("validated_objectives")
      .update({
        target_scores: obj.target_scores,
        taglines: obj.taglines,
        graduation_benchmarks: obj.graduation_benchmarks,
      })
      .eq("name", obj.name)
      .eq("route", obj.route)
      .select("id, name")
      .single();

    if (error || !vo) {
      results.push({ name: obj.name, status: "error", error: error?.message || "not found" });
      continue;
    }

    results.push({ name: obj.name, status: "updated" });

    // Also update any user objectives that reference this validated objective
    const { data: userObjs } = await supabase
      .from("objectives")
      .update({
        target_cardio_score: obj.target_scores.cardio,
        target_strength_score: obj.target_scores.strength,
        target_climbing_score: obj.target_scores.climbing_technical,
        target_flexibility_score: obj.target_scores.flexibility,
        taglines: obj.taglines,
        graduation_benchmarks: obj.graduation_benchmarks,
      })
      .eq("matched_validated_id", vo.id)
      .select("id");

    if (userObjs) {
      updatedUserObjectiveIds.push(...userObjs.map((o) => o.id));
    }
  }

  return NextResponse.json({
    success: true,
    validatedObjectives: results,
    updatedUserObjectiveCount: updatedUserObjectiveIds.length,
    updatedUserObjectiveIds,
  });
}
