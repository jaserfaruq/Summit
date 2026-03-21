import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();

  // Check validated_objectives
  const { data: validated, error: vErr } = await supabase
    .from("validated_objectives")
    .select("id, name, route, target_scores, taglines, graduation_benchmarks")
    .limit(3);

  // Check user objectives
  const { data: { user } } = await supabase.auth.getUser();
  let userObjectives = null;
  if (user) {
    const { data } = await supabase
      .from("objectives")
      .select("id, name, target_cardio_score, target_strength_score, target_climbing_score, target_flexibility_score, taglines, graduation_benchmarks, matched_validated_id, tier")
      .eq("user_id", user.id);
    userObjectives = data;
  }

  return NextResponse.json({
    validatedObjectivesError: vErr?.message,
    validatedSample: validated?.map(v => ({
      name: v.name,
      route: v.route,
      hasTargetScores: !!v.target_scores,
      targetScores: v.target_scores,
      hasTaglines: !!v.taglines,
      hasGradBenchmarks: !!v.graduation_benchmarks,
    })),
    userObjectives: userObjectives?.map(o => ({
      name: o.name,
      matchedValidatedId: o.matched_validated_id,
      tier: o.tier,
      targetScores: {
        cardio: o.target_cardio_score,
        strength: o.target_strength_score,
        climbing: o.target_climbing_score,
        flexibility: o.target_flexibility_score,
      },
      hasTaglines: !!o.taglines,
      taglinesPreview: o.taglines ? Object.keys(o.taglines) : null,
      hasGradBenchmarks: !!o.graduation_benchmarks,
      gradBenchmarksPreview: o.graduation_benchmarks ? Object.keys(o.graduation_benchmarks) : null,
    })),
  });
}
