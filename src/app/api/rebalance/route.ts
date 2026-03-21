import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { RebalanceRequest, DimensionScores } from "@/lib/types";
import { expectedScoresAtWeek } from "@/lib/scoring";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: RebalanceRequest = await request.json();
  const { planId, currentWeek } = body;

  // Fetch plan for context
  const { data: plan } = await supabase
    .from("training_plans")
    .select("*, objectives(*)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const objective = (plan as Record<string, unknown>).objectives as Record<string, unknown>;

  const currentScores: DimensionScores = {
    cardio: objective.current_cardio_score as number,
    strength: objective.current_strength_score as number,
    climbing_technical: objective.current_climbing_score as number,
    flexibility: objective.current_flexibility_score as number,
  };

  const targetScores: DimensionScores = {
    cardio: objective.target_cardio_score as number,
    strength: objective.target_strength_score as number,
    climbing_technical: objective.target_climbing_score as number,
    flexibility: objective.target_flexibility_score as number,
  };

  // Fetch remaining weekly targets
  const { data: remainingWeeks, error } = await supabase
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", planId)
    .gte("week_number", currentWeek)
    .order("week_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const weeksToRebalance = remainingWeeks || [];

  if (weeksToRebalance.length === 0) {
    return NextResponse.json({ updatedWeeks: [] });
  }

  // Total weeks in plan
  const { count: totalWeekCount } = await supabase
    .from("weekly_targets")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", planId);

  const totalWeeks = totalWeekCount || Math.max(...weeksToRebalance.map((w: Record<string, number>) => w.week_number));

  // Fetch profile for hours calculation
  const { data: profile } = await supabase
    .from("profiles")
    .select("training_days_per_week")
    .eq("id", user.id)
    .single();

  const daysPerWeek = profile?.training_days_per_week || 5;
  const baseHours = Math.min(daysPerWeek * 1.2, 20);

  try {
    // Recalculate expected scores and hours for each remaining week,
    // then clear sessions so they regenerate on-demand with updated context
    const updatedWeeks = await Promise.all(
      weeksToRebalance.map(async (week) => {
        const weekNumber = week.week_number;

        // Recalculate expected scores using linear interpolation from CURRENT scores
        // (not original assessment scores) — this is the key rebalance logic
        const newExpectedScores = expectedScoresAtWeek(
          currentScores,
          targetScores,
          weekNumber - currentWeek + 1, // relative week from now
          totalWeeks - currentWeek + 1   // remaining weeks
        );

        // Recalculate hours with taper for final 2 weeks
        const isTaper = weekNumber > totalWeeks - 2;
        const volumeMultiplier = isTaper ? 0.6 : 1.0;
        const progressionFactor = Math.min(1.0, 0.7 + (weekNumber / totalWeeks) * 0.3);
        const totalHours = Math.round(baseHours * volumeMultiplier * progressionFactor * 10) / 10;

        // Update the week: new expected scores, recalculated hours, and clear sessions
        // so they get regenerated on-demand via /api/generate-week-sessions with new context
        const { error: updateError } = await supabase
          .from("weekly_targets")
          .update({
            expected_scores: newExpectedScores,
            total_hours: totalHours,
            sessions: [], // Clear — will regenerate on-demand
          })
          .eq("id", week.id);

        if (updateError) {
          console.error(`Error updating week ${weekNumber}:`, updateError);
        }

        return {
          weekNumber,
          expectedScores: newExpectedScores,
          totalHoursTarget: totalHours,
          sessions: [],
        };
      })
    );

    return NextResponse.json({ updatedWeeks });
  } catch (error) {
    console.error("Error rebalancing:", error);
    return NextResponse.json(
      { error: "Failed to rebalance plan" },
      { status: 500 }
    );
  }
}
