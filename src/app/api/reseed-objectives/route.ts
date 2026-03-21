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

  const results: { name: string; status: string; error?: string; details?: string }[] = [];

  // Check if user is a validator (can update validated_objectives)
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_validator")
    .eq("id", user.id)
    .single();

  const isValidator = profile?.is_validator === true;

  for (const obj of VALIDATED_OBJECTIVE_SEED_DATA) {
    // Find the validated objective ID (read is allowed for all authenticated users)
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

    // Only validators can update validated_objectives (RLS enforced)
    if (isValidator) {
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
    }

    // Update user's own objectives that reference this validated objective
    // (users have write access to their own objectives via RLS)
    const { data: userObjs } = await supabase
      .from("objectives")
      .select("id")
      .eq("user_id", user.id)
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
        .eq("user_id", user.id)
        .eq("matched_validated_id", voId);

      if (objError) {
        results.push({
          name: obj.name,
          status: "error",
          error: `user objective update failed: ${objError.message}`,
        });
        continue;
      }

      // Also update active training plans' graduation_workouts snapshot
      for (const uo of userObjs) {
        await supabase
          .from("training_plans")
          .update({ graduation_workouts: obj.graduation_benchmarks })
          .eq("user_id", user.id)
          .eq("objective_id", uo.id)
          .eq("status", "active");
      }

      results.push({
        name: obj.name,
        status: "updated",
        details: `updated ${userObjs.length} user objective(s) + training plans${isValidator ? " + validated_objectives" : ""}`,
      });
    } else {
      results.push({
        name: obj.name,
        status: isValidator ? "updated" : "skipped",
        details: isValidator
          ? "validated_objectives updated (no user objectives reference this)"
          : "no user objectives reference this (and not a validator to update validated_objectives)",
      });
    }
  }

  // Also handle user objectives that match by name but don't have matched_validated_id set
  const { data: unmatchedObjs } = await supabase
    .from("objectives")
    .select("id, name")
    .eq("user_id", user.id)
    .is("matched_validated_id", null);

  const unmatchedUpdates: string[] = [];
  if (unmatchedObjs) {
    for (const uo of unmatchedObjs) {
      const seedMatch = VALIDATED_OBJECTIVE_SEED_DATA.find(
        (s) => s.name.toLowerCase() === uo.name.toLowerCase()
      );
      if (seedMatch) {
        // Find the validated objective ID to link it
        const { data: voMatch } = await supabase
          .from("validated_objectives")
          .select("id")
          .eq("name", seedMatch.name)
          .eq("route", seedMatch.route);

        const updateData: Record<string, unknown> = {
          target_cardio_score: seedMatch.target_scores.cardio,
          target_strength_score: seedMatch.target_scores.strength,
          target_climbing_score: seedMatch.target_scores.climbing_technical,
          target_flexibility_score: seedMatch.target_scores.flexibility,
          taglines: seedMatch.taglines,
          graduation_benchmarks: seedMatch.graduation_benchmarks,
        };

        if (voMatch && voMatch.length > 0) {
          updateData.matched_validated_id = voMatch[0].id;
          updateData.tier = "gold";
        }

        await supabase
          .from("objectives")
          .update(updateData)
          .eq("id", uo.id)
          .eq("user_id", user.id);

        // Also update active training plans for this objective
        await supabase
          .from("training_plans")
          .update({ graduation_workouts: seedMatch.graduation_benchmarks })
          .eq("user_id", user.id)
          .eq("objective_id", uo.id)
          .eq("status", "active");

        unmatchedUpdates.push(uo.name);
      }
    }
  }

  return NextResponse.json({
    success: true,
    isValidator,
    validatedObjectives: results,
    unmatchedObjectivesFixed: unmatchedUpdates,
  });
}
