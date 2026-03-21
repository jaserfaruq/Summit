import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const CORRECT_TARGET_SCORES = {
  cardio: 75,
  strength: 70,
  climbing_technical: 65,
  flexibility: 55,
};

const CORRECT_GRADUATION_BENCHMARKS = {
  cardio: [
    {
      exerciseId: "b1000000-0000-0000-0000-000000000003",
      exerciseName: "Uphill Hike with Pack",
      graduationTarget: "2500+ ft/hr (elite level)",
      whyThisTarget: "Overshoot target for 7,000 ft objective ensures comfortable sustained uphill power.",
    },
    {
      exerciseId: "b1000000-0000-0000-0000-000000000002",
      exerciseName: "Sustained Zone 2 Run",
      graduationTarget: "15+ miles (strong level)",
      whyThisTarget: "Aerobic base overshoot for 12-mile objective builds deep endurance reserves.",
    },
  ],
  strength: [
    {
      exerciseId: "b2000000-0000-0000-0000-000000000003",
      exerciseName: "Weighted Pull-Ups",
      graduationTarget: "5 reps @ +25lb (strong level)",
      whyThisTarget: "Sustained grip strength needed for 5.5 moves while managing pack weight.",
    },
    {
      exerciseId: "b2000000-0000-0000-0000-000000000004",
      exerciseName: "Loaded Carry",
      graduationTarget: "500m @ 70lb in 10 minutes",
      whyThisTarget: "Pack carrying endurance for technical terrain with climbing gear load.",
    },
    {
      exerciseId: "b2000000-0000-0000-0000-000000000002",
      exerciseName: "Single-Leg Step-Down",
      graduationTarget: "25 reps per leg (strong level)",
      whyThisTarget: "Knee stability and control for exposed descents and awkward positions.",
    },
  ],
  climbing_technical: [
    {
      exerciseId: "b3000000-0000-0000-0000-000000000001",
      exerciseName: "Top-Rope Climbing Assessment",
      graduationTarget: "5.7+ clean sends",
      whyThisTarget: "Two sub-grades above 5.5 objective ensures comfortable movement margin.",
    },
    {
      exerciseId: "b3000000-0000-0000-0000-000000000002",
      exerciseName: "Scramble Confidence Assessment",
      graduationTarget: "4/5 confidence rating",
      whyThisTarget: "High exposure comfort essential for Upper Exum's serious consequences.",
    },
  ],
  flexibility: [
    {
      exerciseId: "b4000000-0000-0000-0000-000000000001",
      exerciseName: "Deep Squat Hold",
      graduationTarget: "90 seconds (strong level)",
      whyThisTarget: "Hip and ankle mobility for high steps and rest positions during long route.",
    },
    {
      exerciseId: "b4000000-0000-0000-0000-000000000003",
      exerciseName: "Ankle Dorsiflexion Test",
      graduationTarget: "5 inches (strong level)",
      whyThisTarget: "Ankle mobility prevents injury on steep granite and technical descents.",
    },
  ],
};

const CORRECT_TAGLINES = {
  cardio: "Long sustained power under load",
  strength: "Heavy pack endurance and grip",
  climbing_technical: "Exposed 5.5 movement with pack",
  flexibility: "Hip and ankle range under fatigue",
};

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fix the validated_objectives record
  const { data: vo, error: voError } = await supabase
    .from("validated_objectives")
    .update({
      target_scores: CORRECT_TARGET_SCORES,
      taglines: CORRECT_TAGLINES,
      graduation_benchmarks: CORRECT_GRADUATION_BENCHMARKS,
    })
    .eq("name", "Grand Teton")
    .eq("route", "Upper Exum Ridge")
    .select("id, name, target_scores, graduation_benchmarks")
    .single();

  if (voError) {
    return NextResponse.json({ error: voError.message, step: "update_vo" }, { status: 500 });
  }

  // Also fix any existing user objectives that matched this validated objective
  const { data: userObjectives, error: objError } = await supabase
    .from("objectives")
    .update({
      target_cardio_score: CORRECT_TARGET_SCORES.cardio,
      target_strength_score: CORRECT_TARGET_SCORES.strength,
      target_climbing_score: CORRECT_TARGET_SCORES.climbing_technical,
      target_flexibility_score: CORRECT_TARGET_SCORES.flexibility,
      taglines: CORRECT_TAGLINES,
      graduation_benchmarks: CORRECT_GRADUATION_BENCHMARKS,
    })
    .eq("matched_validated_id", vo.id)
    .select("id, name");

  return NextResponse.json({
    success: true,
    validatedObjective: {
      id: vo.id,
      name: vo.name,
      updatedTargetScores: CORRECT_TARGET_SCORES,
      cardioBenchmarkCount: CORRECT_GRADUATION_BENCHMARKS.cardio.length,
    },
    updatedUserObjectives: userObjectives || [],
    userObjectiveError: objError?.message || null,
  });
}
