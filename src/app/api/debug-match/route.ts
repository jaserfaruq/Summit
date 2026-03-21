import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: allVOs, error: voError } = await supabase
    .from("validated_objectives")
    .select("id, name, route, match_aliases, graduation_benchmarks, target_scores")
    .eq("status", "active");

  const voCount = allVOs?.length || 0;
  const grandTeton = allVOs?.find((vo: AnyRecord) =>
    (vo.match_aliases as string[])?.some((a: string) => a.toLowerCase().includes("grand teton"))
  );

  const { data: objectives } = await supabase
    .from("objectives")
    .select("id, name, tier, matched_validated_id, graduation_benchmarks, target_cardio_score, target_strength_score")
    .eq("user_id", user.id);

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, objective_id, graduation_workouts, status")
    .eq("user_id", user.id);

  // Test alias matching
  const normalized = "grand teton";
  const aliasMatch = allVOs?.find((vo: AnyRecord) =>
    (vo.match_aliases as string[])?.some((alias: string) => {
      const a = alias.toLowerCase().trim();
      return a === normalized || normalized.includes(a) || a.includes(normalized);
    })
  );

  return NextResponse.json({
    validatedObjectivesCount: voCount,
    voError: voError?.message || null,
    grandTetonInDB: grandTeton ? {
      id: grandTeton.id,
      name: grandTeton.name,
      route: grandTeton.route,
      aliases: grandTeton.match_aliases,
      cardioBenchmarks: (grandTeton.graduation_benchmarks as AnyRecord)?.cardio,
      targetScores: grandTeton.target_scores,
    } : "NOT FOUND",
    aliasMatchResult: aliasMatch ? { id: aliasMatch.id, name: aliasMatch.name } : "NO MATCH",
    userObjectives: objectives?.map((o: AnyRecord) => ({
      id: o.id,
      name: o.name,
      tier: o.tier,
      matched_validated_id: o.matched_validated_id,
      cardioBenchmarks: (o.graduation_benchmarks as AnyRecord)?.cardio,
    })),
    userPlans: plans?.map((p: AnyRecord) => ({
      id: p.id,
      objective_id: p.objective_id,
      status: p.status,
      cardioBenchmarks: (p.graduation_workouts as AnyRecord)?.cardio,
    })),
  });
}
