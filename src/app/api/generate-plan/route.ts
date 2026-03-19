import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { GeneratePlanRequest } from "@/lib/types";
import { generateWeekSchedule, expectedScoresAtWeek } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GeneratePlanRequest = await request.json();
  const { objectiveId, assessmentId } = body;

  // Fetch objective
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", objectiveId)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
  }

  // Fetch assessment
  const { data: assessment, error: assError } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (assError || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Calculate weeks available
  const now = new Date();
  const targetDate = new Date(objective.target_date);
  const totalWeeks = Math.max(
    4,
    Math.floor((targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
  );

  // Build week schedule algorithmically — no Claude call needed
  const weekTypes = generateWeekSchedule(totalWeeks);
  const daysPerWeek = profile?.training_days_per_week || 5;

  const currentScores = {
    cardio: assessment.cardio_score,
    strength: assessment.strength_score,
    climbing_technical: assessment.climbing_score,
    flexibility: assessment.flexibility_score,
  };

  const targetScores = {
    cardio: objective.target_cardio_score,
    strength: objective.target_strength_score,
    climbing_technical: objective.target_climbing_score,
    flexibility: objective.target_flexibility_score,
  };

  // Base hours: scale by training days, cap at 10 for recreational athletes
  const baseHours = Math.min(daysPerWeek * 1.2, 10);

  const weeks = weekTypes.map((weekType, i) => {
    const weekNumber = i + 1;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Volume scaling by week type
    let volumeMultiplier = 1.0;
    if (weekType === "test") volumeMultiplier = 0.8;
    else if (weekType === "taper") volumeMultiplier = 0.6;

    // Progressive volume: ramp up ~5% per week, capped by week type
    const progressionFactor = Math.min(1.0, 0.7 + (weekNumber / totalWeeks) * 0.3);
    const totalHours = Math.round(baseHours * volumeMultiplier * progressionFactor * 10) / 10;

    return {
      weekNumber,
      weekStartDate: weekStartStr,
      weekType,
      totalHoursTarget: totalHours,
      expectedScores: expectedScoresAtWeek(currentScores, targetScores, weekNumber, totalWeeks),
    };
  });

  const planSummary = {
    philosophy: `Progressive ${totalWeeks}-week plan building from current fitness to ${objective.name} readiness. Test weeks every ~4 weeks for calibration, recovery weeks to consolidate gains, and a 2-week taper to peak on target date.`,
    weeklyStructure: `${daysPerWeek} sessions per week across cardio, strength, climbing/technical, and flexibility. Sessions are generated on-demand when you expand each week.`,
    equipmentNeeded: profile?.equipment_access || ["basic gym equipment"],
    keyExercises: extractKeyExercises(objective.graduation_benchmarks),
  };

  try {
    // Store the plan
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        user_id: user.id,
        objective_id: objectiveId,
        assessment_id: assessmentId,
        plan_data: {
          planSummary,
          weeks: weeks.map((w) => ({ ...w, sessions: [] })),
        },
        graduation_workouts: objective.graduation_benchmarks,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to save plan:", planError);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    // Store weekly targets with empty sessions
    const weeklyTargets = weeks.map((week) => ({
      plan_id: plan.id,
      week_number: week.weekNumber,
      week_start: week.weekStartDate,
      week_type: week.weekType,
      total_hours: week.totalHoursTarget,
      expected_scores: week.expectedScores,
      sessions: [], // Generated on-demand via /api/generate-week-sessions
    }));

    const { error: weekError } = await supabase
      .from("weekly_targets")
      .insert(weeklyTargets);

    if (weekError) {
      console.error("Error saving weekly targets:", weekError);
    }

    // Update current scores on objective from assessment
    await supabase
      .from("objectives")
      .update({
        current_cardio_score: assessment.cardio_score,
        current_strength_score: assessment.strength_score,
        current_climbing_score: assessment.climbing_score,
        current_flexibility_score: assessment.flexibility_score,
      })
      .eq("id", objectiveId);

    return NextResponse.json({
      planId: plan.id,
      weekCount: weeks.length,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: "Failed to generate plan. Please try again." },
      { status: 500 }
    );
  }
}

// Extract exercise names from graduation benchmarks for the plan summary
function extractKeyExercises(graduationBenchmarks: unknown): string[] {
  const exercises: string[] = [];
  if (!graduationBenchmarks || typeof graduationBenchmarks !== "object") return exercises;
  const benchmarks = graduationBenchmarks as Record<string, Array<{ exerciseName?: string }>>;
  for (const dim of Object.keys(benchmarks)) {
    const dimBenchmarks = benchmarks[dim];
    if (Array.isArray(dimBenchmarks)) {
      for (const b of dimBenchmarks) {
        if (b.exerciseName) exercises.push(b.exerciseName);
      }
    }
  }
  return exercises;
}
