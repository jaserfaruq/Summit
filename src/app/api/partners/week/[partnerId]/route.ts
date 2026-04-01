import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextRequest, NextResponse } from "next/server";
import { PlanSession, PartnerWeekResponse, DimensionScores } from "@/lib/types";
import { inferSessionEnvironment, findPartnerMatches } from "@/lib/session-matching";

export async function GET(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { partnerId } = params;
  const partnerPlanId = request.nextUrl.searchParams.get("partnerPlanId");
  const userPlanId = request.nextUrl.searchParams.get("userPlanId");

  // Verify an accepted partnership exists between the user and this partner
  const { data: partnership, error: partnershipError } = await supabase
    .from("partnerships")
    .select("*")
    .or(
      `and(requester_id.eq.${user.id},recipient_id.eq.${partnerId}),and(requester_id.eq.${partnerId},recipient_id.eq.${user.id})`
    )
    .eq("status", "accepted")
    .single();

  if (partnershipError || !partnership) {
    return NextResponse.json({ error: "No accepted partnership found" }, { status: 404 });
  }

  const serviceClient = createServiceClient();

  // Fetch partner's profile
  const { data: partnerProfile } = await serviceClient
    .from("profiles")
    .select("name")
    .eq("id", partnerId)
    .single();

  // Fetch partner's active plan — use specific plan if provided, otherwise latest
  let partnerPlanQuery = serviceClient
    .from("training_plans")
    .select("id, objective_id, current_week_number")
    .eq("user_id", partnerId)
    .eq("status", "active");

  if (partnerPlanId) {
    partnerPlanQuery = partnerPlanQuery.eq("id", partnerPlanId);
  } else {
    partnerPlanQuery = partnerPlanQuery.order("created_at", { ascending: false }).limit(1);
  }

  const { data: partnerPlan } = await partnerPlanQuery.single();

  if (!partnerPlan) {
    return NextResponse.json({
      partnerId,
      partnerName: partnerProfile?.name || "Unknown",
      objectiveName: "",
      weekNumber: 0,
      totalWeeks: 0,
      weekType: "regular",
      sessions: [],
      scoresVisible: false,
      scores: null,
      targetScores: null,
      matches: [],
    } as PartnerWeekResponse);
  }

  // Fetch objective
  const { data: objective } = await serviceClient
    .from("objectives")
    .select("name, current_cardio_score, current_strength_score, current_climbing_score, current_flexibility_score, target_cardio_score, target_strength_score, target_climbing_score, target_flexibility_score")
    .eq("id", partnerPlan.objective_id)
    .single();

  // Fetch total weeks
  const { count: totalWeeks } = await serviceClient
    .from("weekly_targets")
    .select("*", { count: "exact", head: true })
    .eq("plan_id", partnerPlan.id);

  // Fetch partner's current week
  const { data: partnerWeekTarget } = await serviceClient
    .from("weekly_targets")
    .select("*")
    .eq("plan_id", partnerPlan.id)
    .eq("week_number", partnerPlan.current_week_number)
    .single();

  const partnerSessions = (partnerWeekTarget?.sessions as PlanSession[]) || [];

  // Fetch partner's workout logs for completion status
  const { data: partnerLogs } = await serviceClient
    .from("workout_logs")
    .select("session_name")
    .eq("user_id", partnerId)
    .eq("plan_id", partnerPlan.id)
    .eq("week_number", partnerPlan.current_week_number);

  const completedNames = new Set((partnerLogs || []).map((l) => l.session_name));

  const sessions = partnerSessions.map((s, i) => ({
    name: s.name,
    dimension: s.dimension,
    environment: inferSessionEnvironment(s),
    completed: completedNames.has(s.name),
    sessionIndex: i,
    fullSession: s,
  }));

  // Determine score visibility
  const scoresVisible = partnership.requester_shares_scores && partnership.recipient_shares_scores;
  let scores: DimensionScores | null = null;
  let targetScores: DimensionScores | null = null;

  if (scoresVisible && objective) {
    scores = {
      cardio: objective.current_cardio_score,
      strength: objective.current_strength_score,
      climbing_technical: objective.current_climbing_score,
      flexibility: objective.current_flexibility_score,
    };
    targetScores = {
      cardio: objective.target_cardio_score,
      strength: objective.target_strength_score,
      climbing_technical: objective.target_climbing_score,
      flexibility: objective.target_flexibility_score,
    };
  }

  // Run matching against user's current week
  let matches: PartnerWeekResponse["matches"] = [];

  // Fetch user's active plan and current week — use specific plan if provided
  let userPlanQuery = supabase
    .from("training_plans")
    .select("id, current_week_number")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (userPlanId) {
    userPlanQuery = userPlanQuery.eq("id", userPlanId);
  } else {
    userPlanQuery = userPlanQuery.order("created_at", { ascending: false }).limit(1);
  }

  const { data: userPlan } = await userPlanQuery.single();

  if (userPlan) {
    const { data: userWeekTarget } = await supabase
      .from("weekly_targets")
      .select("sessions")
      .eq("plan_id", userPlan.id)
      .eq("week_number", userPlan.current_week_number)
      .single();

    const userSessions = (userWeekTarget?.sessions as PlanSession[]) || [];
    if (userSessions.length > 0 && partnerSessions.length > 0) {
      matches = findPartnerMatches(userSessions, partnerSessions);
    }
  }

  const response: PartnerWeekResponse = {
    partnerId,
    partnerName: partnerProfile?.name || "Unknown",
    objectiveName: objective?.name || "",
    weekNumber: partnerPlan.current_week_number,
    totalWeeks: totalWeeks || 0,
    weekType: partnerWeekTarget?.week_type || "regular",
    sessions,
    scoresVisible,
    scores,
    targetScores,
    matches,
  };

  return NextResponse.json(response);
}
