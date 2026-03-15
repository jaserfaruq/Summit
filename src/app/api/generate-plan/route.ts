import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { callClaude, parseClaudeJSON } from "@/lib/claude";
import { PROMPT_2A_SYSTEM } from "@/lib/prompts";
import { GeneratePlanRequest } from "@/lib/types";

interface LightweightPlanResponse {
  planSummary: {
    philosophy: string;
    weeklyStructure: string;
    equipmentNeeded: string[];
    keyExercises: string[];
  };
  weeks: {
    weekNumber: number;
    weekStartDate: string;
    weekType: string;
    totalHoursTarget: number;
    expectedScores: {
      cardio: number;
      strength: number;
      climbing_technical: number;
      flexibility: number;
    };
  }[];
}

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

  const userMessage = `Athlete profile: Available ${profile?.training_days_per_week || 5}/week. Equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}. Location: ${profile?.location || "not specified"}. Injuries: none.

Objective: ${objective.name}. Type: ${objective.type}. Target date: ${objective.target_date}. Distance: ${objective.distance_miles || "N/A"} miles. Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft. Technical grade: ${objective.technical_grade || "N/A"}.

Current scores: Cardio ${assessment.cardio_score}, Strength ${assessment.strength_score}, Climbing/Technical ${assessment.climbing_score}, Flexibility ${assessment.flexibility_score}.
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}.
Weeks available: ${totalWeeks}.

Graduation benchmarks: ${JSON.stringify(objective.graduation_benchmarks)}

Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}`;

  try {
    const responseText = await callClaude(PROMPT_2A_SYSTEM, userMessage);
    const planData = parseClaudeJSON<LightweightPlanResponse>(responseText);

    // Store the plan (plan_data includes planSummary + week structure without sessions)
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        user_id: user.id,
        objective_id: objectiveId,
        assessment_id: assessmentId,
        plan_data: {
          planSummary: planData.planSummary,
          weeks: planData.weeks.map((w) => ({
            ...w,
            sessions: [], // Sessions will be generated on-demand
          })),
        },
        graduation_workouts: objective.graduation_benchmarks,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    // Store weekly targets with empty sessions
    const weeklyTargets = planData.weeks.map((week) => ({
      plan_id: plan.id,
      week_number: week.weekNumber,
      week_start: week.weekStartDate,
      week_type: week.weekType,
      total_hours: week.totalHoursTarget,
      expected_scores: week.expectedScores,
      sessions: [], // Empty — sessions generated on-demand via /api/generate-week-sessions
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
      weekCount: planData.weeks.length,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: "Failed to generate plan. Please try again." },
      { status: 500 }
    );
  }
}
