import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { DraftPlanState } from "@/lib/draft-plan-context";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { draft } = (await request.json()) as { draft: DraftPlanState };

  if (!draft?.objective || !draft?.assessment || !draft?.plan) {
    return NextResponse.json(
      { error: "draft must include objective, assessment, and plan" },
      { status: 400 }
    );
  }

  const { objective, assessment, plan } = draft;

  // 1. Insert objective
  const { data: insertedObjective, error: objError } = await supabase
    .from("objectives")
    .insert({
      user_id: user.id,
      name: objective.name,
      type: objective.type,
      target_date: objective.target_date,
      distance_miles: objective.distance_miles,
      elevation_gain_ft: objective.elevation_gain_ft,
      technical_grade: objective.technical_grade,
      target_cardio_score: objective.target_cardio_score,
      target_strength_score: objective.target_strength_score,
      target_climbing_score: objective.target_climbing_score,
      target_flexibility_score: objective.target_flexibility_score,
      current_cardio_score: objective.current_cardio_score,
      current_strength_score: objective.current_strength_score,
      current_climbing_score: objective.current_climbing_score,
      current_flexibility_score: objective.current_flexibility_score,
      taglines: objective.taglines,
      relevance_profiles: objective.relevance_profiles,
      graduation_benchmarks: objective.graduation_benchmarks,
      climbing_role: objective.climbing_role,
      matched_validated_id: objective.matched_validated_id,
      tier: objective.tier,
    })
    .select("id")
    .single();

  if (objError || !insertedObjective) {
    console.error("persist-guest-plan: failed to insert objective:", objError);
    return NextResponse.json(
      { error: "Failed to save objective: " + (objError?.message || "unknown") },
      { status: 500 }
    );
  }
  const objectiveId = insertedObjective.id;

  // 2. Insert assessment
  const { data: insertedAssessment, error: assError } = await supabase
    .from("assessments")
    .insert({
      user_id: user.id,
      objective_id: objectiveId,
      cardio_score: assessment.cardio_score,
      strength_score: assessment.strength_score,
      climbing_score: assessment.climbing_score,
      flexibility_score: assessment.flexibility_score,
      standard_answers: assessment.standard_answers,
      ai_questions: assessment.ai_questions,
      ai_answers: assessment.ai_answers,
      freeform_text: assessment.freeform_text,
      ai_reasoning: assessment.ai_reasoning,
      raw_data: { programmingHints: assessment.programming_hints },
    })
    .select("id")
    .single();

  if (assError || !insertedAssessment) {
    console.error("persist-guest-plan: failed to insert assessment:", assError);
    await supabase.from("objectives").delete().eq("id", objectiveId);
    return NextResponse.json(
      { error: "Failed to save assessment: " + (assError?.message || "unknown") },
      { status: 500 }
    );
  }
  const assessmentId = insertedAssessment.id;

  // 3. Update profile training_days_per_week from standardAnswers
  if (assessment.standard_answers?.training_days_per_week) {
    await supabase
      .from("profiles")
      .update({ training_days_per_week: assessment.standard_answers.training_days_per_week })
      .eq("id", user.id);
  }

  // 4. Insert score history (assessment baseline)
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("score_history").insert({
    user_id: user.id,
    objective_id: objectiveId,
    week_ending: today,
    cardio_score: assessment.cardio_score,
    strength_score: assessment.strength_score,
    climbing_score: assessment.climbing_score,
    flexibility_score: assessment.flexibility_score,
    change_reason: "assessment",
    is_test_week: false,
    confidence: "low",
  });

  // 5. Insert training plan
  const { data: insertedPlan, error: planError } = await supabase
    .from("training_plans")
    .insert({
      user_id: user.id,
      objective_id: objectiveId,
      assessment_id: assessmentId,
      plan_data: {
        planSummary: plan.planSummary,
        heroImageUrl: plan.heroImageUrl,
        programmingHints: plan.programmingHints,
        gapAnalysis: plan.gapAnalysis,
        weeks: plan.weeks.map((w) => ({
          weekNumber: w.weekNumber,
          weekStartDate: w.weekStartDate,
          weekType: w.weekType,
          totalHoursTarget: w.totalHoursTarget,
          expectedScores: w.expectedScores,
          sessions: w.sessions,
        })),
      },
      graduation_workouts: plan.graduationWorkouts,
      status: "active",
    })
    .select("id")
    .single();

  if (planError || !insertedPlan) {
    console.error("persist-guest-plan: failed to insert plan:", planError);
    await supabase.from("score_history").delete().eq("objective_id", objectiveId);
    await supabase.from("assessments").delete().eq("id", assessmentId);
    await supabase.from("objectives").delete().eq("id", objectiveId);
    return NextResponse.json(
      { error: "Failed to save plan: " + (planError?.message || "unknown") },
      { status: 500 }
    );
  }
  const planId = insertedPlan.id;

  // 6. Insert weekly_targets — sessions for week 1 (and any other weeks the guest has) flow through
  const weeklyTargets = plan.weeks.map((w) => ({
    plan_id: planId,
    user_id: user.id,
    week_number: w.weekNumber,
    week_start: w.weekStartDate,
    week_type: w.weekType,
    total_hours: w.totalHoursTarget,
    expected_scores: w.expectedScores,
    sessions: w.sessions || [],
  }));

  const { error: weekError } = await supabase
    .from("weekly_targets")
    .insert(weeklyTargets);

  if (weekError) {
    console.error("persist-guest-plan: failed to insert weekly targets:", weekError);
    await supabase.from("training_plans").delete().eq("id", planId);
    await supabase.from("score_history").delete().eq("objective_id", objectiveId);
    await supabase.from("assessments").delete().eq("id", assessmentId);
    await supabase.from("objectives").delete().eq("id", objectiveId);
    return NextResponse.json(
      { error: "Failed to save weekly targets: " + weekError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ planId, objectiveId, assessmentId });
}
