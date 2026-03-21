import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { VALIDATED_OBJECTIVE_SEED_DATA } from "@/lib/seed-data";

// Support GET so it can be triggered by visiting the URL in a browser
export async function GET() {
  return reseed();
}

export async function POST() {
  return reseed();
}

async function reseed() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { name: string; status: string; error?: string }[] = [];
  const updatedUserObjectiveIds: string[] = [];

  for (const obj of VALIDATED_OBJECTIVE_SEED_DATA) {
    // First find the validated objective ID
    const { data: found } = await supabase
      .from("validated_objectives")
      .select("id")
      .eq("name", obj.name)
      .eq("route", obj.route);

    if (!found || found.length === 0) {
      results.push({ name: obj.name, status: "error", error: "not found in database" });
      continue;
    }

    const voId = found[0].id;

    // Update by ID (guaranteed unique)
    const { error } = await supabase
      .from("validated_objectives")
      .update({
        target_scores: obj.target_scores,
        taglines: obj.taglines,
        graduation_benchmarks: obj.graduation_benchmarks,
      })
      .eq("id", voId);

    if (error) {
      results.push({ name: obj.name, status: "error", error: error.message });
      continue;
    }

    results.push({ name: obj.name, status: "updated" });

    // Also update any user objectives that reference this validated objective
    const { data: userObjs } = await supabase
      .from("objectives")
      .select("id")
      .eq("matched_validated_id", voId);

    if (userObjs && userObjs.length > 0) {
      const { error: objError } = await supabase
        .from("objectives")
        .update({
          target_cardio_score: obj.target_scores.cardio,
          target_strength_score: obj.target_scores.strength,
          target_climbing_score: obj.target_scores.climbing_technical,
          target_flexibility_score: obj.target_scores.flexibility,
          taglines: obj.taglines,
          graduation_benchmarks: obj.graduation_benchmarks,
        })
        .eq("matched_validated_id", voId);

      if (!objError) {
        updatedUserObjectiveIds.push(...userObjs.map((o) => o.id));
      }
    }
  }

  return NextResponse.json({
    success: true,
    validatedObjectives: results,
    updatedUserObjectiveCount: updatedUserObjectiveIds.length,
    updatedUserObjectiveIds,
  });
}
