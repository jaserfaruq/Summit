import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { ValidatedObjective } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Check validated_objectives table
  const { data: allVOs, error: voError } = await supabase
    .from("validated_objectives")
    .select("id, name, route, match_aliases, graduation_benchmarks, target_scores")
    .eq("status", "active");

  const voCount = allVOs?.length || 0;
  const grandTeton = (allVOs as ValidatedObjective[] | null)?.find(vo =>
    vo.match_aliases?.some((a: string) => a.toLowerCase().includes("grand teton"))
  );

  // 2. Check user's objectives
  const { data: objectives } = await supabase
    .from("objectives")
    .select("id, name, tier, matched_validated_id, graduation_benchmarks, target_cardio_score, target_strength_score")
    .eq("user_id", user.id);

  // 3. Check user's training plans
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, objective_id, graduation_workouts, status")
    .eq("user_id", user.id);

  // 4. Test alias matching
  const testQuery = "grand teton";
  const normalized = testQuery.toLowerCase().trim();
  const aliasMatch = (allVOs as ValidatedObjective[] | null)?.find(vo =>
    vo.match_aliases?.some((alias: string) => {
      const a = alias.toLowerCase().trim();
      return a === normalized || normalized.includes(a) || a.includes(normalized);
    })
  );

  return NextResponse.json({
    debug: {
      validatedObjectivesCount: voCount,
      voError: voError?.message || null,
      grandTetonInVOs: grandTeton ? {
        id: grandTeton.id,
        name: grandTeton.name,
        route: grandTeton.route,
        aliases: grandTeton.match_aliases,
        cardioBenchmarkCount: (grandTeton.graduation_benchmarks as Record<string, unknown[]>)?.cardio?.length,
        cardioBenchmarks: (grandTeton.graduation_benchmarks as Record<string, Array<{exerciseName: string; graduationTarget: string}>>)?.cardio,
        targetScores: grandTeton.target_scores,
      } : "NOT FOUND IN DATABASE",
      aliasMatchTest: aliasMatch ? { id: aliasMatch.id, name: aliasMatch.name } : "NO MATCH",
      userObjectives: objectives?.map(o => ({
        id: o.id,
        name: o.name,
        tier: o.tier,
        matched_validated_id: o.matched_validated_id,
        cardioBenchmarkCount: (o.graduation_benchmarks as Record<string, unknown[]>)?.cardio?.length,
        cardioBenchmarks: (o.graduation_benchmarks as Record<string, Array<{exerciseName: string; graduationTarget: string}>>)?.cardio,
      })),
      userPlans: plans?.map(p => ({
        id: p.id,
        objective_id: p.objective_id,
        status: p.status,
        cardioBenchmarkCount: (p.graduation_workouts as Record<string, unknown[]>)?.cardio?.length,
        cardioBenchmarks: (p.graduation_workouts as Record<string, Array<{exerciseName: string; graduationTarget: string}>>)?.cardio,
      })),
    },
  });
}
