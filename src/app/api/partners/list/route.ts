import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase-service";
import { NextResponse } from "next/server";
import { AcceptedPartner, PendingPartner, PartnerListResponse, PlanSession } from "@/lib/types";
import { inferSessionEnvironment } from "@/lib/session-matching";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all partnerships involving this user
  const { data: partnerships, error } = await supabase
    .from("partnerships")
    .select("*")
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);

  if (error) {
    console.error("Error fetching partnerships:", error);
    return NextResponse.json({ error: "Failed to fetch partnerships" }, { status: 500 });
  }

  const serviceClient = createServiceClient();
  const accepted: AcceptedPartner[] = [];
  const pending: PendingPartner[] = [];

  for (const p of partnerships || []) {
    const isRequester = p.requester_id === user.id;
    const partnerId = isRequester ? p.recipient_id : p.requester_id;

    // Fetch partner's profile
    const { data: partnerProfile } = await serviceClient
      .from("profiles")
      .select("name")
      .eq("id", partnerId)
      .single();

    const partnerName = partnerProfile?.name || "Unknown";

    if (p.status === "pending") {
      pending.push({
        partnershipId: p.id,
        partnerName,
        direction: isRequester ? "sent" : "received",
      });
      continue;
    }

    if (p.status === "declined") continue;

    // Accepted — fetch partner's active plan and current week data
    const { data: partnerPlan } = await serviceClient
      .from("training_plans")
      .select("id, objective_id, current_week_number")
      .eq("user_id", partnerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let objectiveName: string | null = null;
    let weekLabel: string | null = null;
    let currentWeekSessions: AcceptedPartner["currentWeekSessions"] = [];

    if (partnerPlan) {
      // Fetch objective name
      const { data: objective } = await serviceClient
        .from("objectives")
        .select("name")
        .eq("id", partnerPlan.objective_id)
        .single();

      objectiveName = objective?.name || null;

      // Fetch total weeks
      const { count: totalWeeks } = await serviceClient
        .from("weekly_targets")
        .select("*", { count: "exact", head: true })
        .eq("plan_id", partnerPlan.id);

      weekLabel = `Week ${partnerPlan.current_week_number} of ${totalWeeks || "?"}`;

      // Fetch current week's sessions
      const { data: weekTarget } = await serviceClient
        .from("weekly_targets")
        .select("sessions")
        .eq("plan_id", partnerPlan.id)
        .eq("week_number", partnerPlan.current_week_number)
        .single();

      if (weekTarget?.sessions) {
        const sessions = weekTarget.sessions as PlanSession[];

        // Fetch workout logs to determine completion
        const { data: logs } = await serviceClient
          .from("workout_logs")
          .select("session_name")
          .eq("user_id", partnerId)
          .eq("plan_id", partnerPlan.id)
          .eq("week_number", partnerPlan.current_week_number);

        const completedNames = new Set((logs || []).map((l) => l.session_name));

        currentWeekSessions = sessions.map((s, i) => ({
          name: s.name,
          dimension: s.dimension,
          environment: inferSessionEnvironment(s),
          completed: completedNames.has(s.name),
          sessionIndex: i,
        }));
      }
    }

    // Determine score visibility
    const scoresVisible = p.requester_shares_scores && p.recipient_shares_scores;
    let scores = null;

    if (scoresVisible && partnerPlan) {
      const { data: objective } = await serviceClient
        .from("objectives")
        .select("current_cardio_score, current_strength_score, current_climbing_score, current_flexibility_score")
        .eq("id", partnerPlan.objective_id)
        .single();

      if (objective) {
        scores = {
          cardio: objective.current_cardio_score,
          strength: objective.current_strength_score,
          climbing_technical: objective.current_climbing_score,
          flexibility: objective.current_flexibility_score,
        };
      }
    }

    accepted.push({
      partnershipId: p.id,
      partnerId,
      partnerName,
      objectiveName,
      weekLabel,
      scoresVisible,
      scores,
      currentWeekSessions,
    });
  }

  const response: PartnerListResponse = { accepted, pending };
  return NextResponse.json(response);
}
