import { SupabaseClient } from "@supabase/supabase-js";
import { PlanSession } from "./types";
import { findPartnerMatches, generateMatchSummary, strongestMatchType } from "./session-matching";

/**
 * Checks all accepted partnerships for a user and creates notifications
 * when their current week's sessions overlap with a partner's sessions.
 *
 * Called after session generation (fire-and-forget).
 */
export async function checkAndCreateNotifications(
  userId: string,
  planId: string,
  weekNumber: number,
  sessions: PlanSession[],
  serviceClient: SupabaseClient
): Promise<void> {
  if (!sessions || sessions.length === 0) return;

  // Fetch all accepted partnerships for this user
  const { data: partnerships } = await serviceClient
    .from("partnerships")
    .select("*")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
    .eq("status", "accepted");

  if (!partnerships || partnerships.length === 0) return;

  for (const partnership of partnerships) {
    const partnerId = partnership.requester_id === userId
      ? partnership.recipient_id
      : partnership.requester_id;

    try {
      // Fetch partner's active plan
      const { data: partnerPlan } = await serviceClient
        .from("training_plans")
        .select("id, current_week_number")
        .eq("user_id", partnerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!partnerPlan) continue;

      // Fetch partner's same week (by week number)
      const { data: partnerWeekTarget } = await serviceClient
        .from("weekly_targets")
        .select("sessions")
        .eq("plan_id", partnerPlan.id)
        .eq("week_number", partnerPlan.current_week_number)
        .single();

      const partnerSessions = (partnerWeekTarget?.sessions as PlanSession[]) || [];
      if (partnerSessions.length === 0) continue;

      // Run matching
      const matches = findPartnerMatches(sessions, partnerSessions);
      if (matches.length === 0) continue;

      // Get partner's name
      const { data: partnerProfile } = await serviceClient
        .from("profiles")
        .select("name")
        .eq("id", partnerId)
        .single();

      const partnerName = partnerProfile?.name || "Your partner";
      const summary = generateMatchSummary(partnerName, matches);
      const matchType = strongestMatchType(matches);

      // Create notification for the user
      await serviceClient
        .from("partner_notifications")
        .upsert(
          {
            user_id: userId,
            partner_id: partnerId,
            partner_name: partnerName,
            partnership_id: partnership.id,
            week_number: weekNumber,
            plan_id: planId,
            partner_plan_id: partnerPlan.id,
            match_type: matchType,
            match_summary: summary,
            matched_sessions: matches,
            is_read: false,
            is_dismissed: false,
          },
          { onConflict: "user_id,partner_id,plan_id,week_number" }
        );

      // Also create notification for the partner (reverse direction)
      const reverseMatches = matches.map((m) => ({
        yourSessionIndex: m.partnerSessionIndex,
        yourSessionName: m.partnerSessionName,
        partnerSessionIndex: m.yourSessionIndex,
        partnerSessionName: m.yourSessionName,
        matchType: m.matchType,
        matchReason: m.matchReason,
      }));

      // Get user's name for the partner's notification
      const { data: userProfile } = await serviceClient
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .single();

      const userName = userProfile?.name || "Your partner";
      const reverseSummary = generateMatchSummary(userName, reverseMatches);

      await serviceClient
        .from("partner_notifications")
        .upsert(
          {
            user_id: partnerId,
            partner_id: userId,
            partner_name: userName,
            partnership_id: partnership.id,
            week_number: partnerPlan.current_week_number,
            plan_id: partnerPlan.id,
            partner_plan_id: planId,
            match_type: matchType,
            match_summary: reverseSummary,
            matched_sessions: reverseMatches,
            is_read: false,
            is_dismissed: false,
          },
          { onConflict: "user_id,partner_id,plan_id,week_number" }
        );
    } catch (err) {
      console.error(`Error creating notification for partner ${partnerId}:`, err);
      // Continue with other partners even if one fails
    }
  }
}
