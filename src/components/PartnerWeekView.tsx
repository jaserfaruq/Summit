"use client";

import { useState, useEffect, useCallback } from "react";
import { PartnerWeekResponse, PartnerSession, PlanSession } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { inferSessionEnvironment } from "@/lib/session-matching";
import PartnerSessionCard from "./PartnerSessionCard";
import ScoreArc from "./ScoreArc";
import SyncUpButton from "./SyncUpButton";

const DIMENSION_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  climbing_technical: "Climbing",
  flexibility: "Flexibility",
};

export default function PartnerWeekView({
  partnerWeek,
  onRefresh,
}: {
  partnerWeek: PartnerWeekResponse;
  onRefresh: () => void;
}) {
  const [userSessions, setUserSessions] = useState<PartnerSession[]>([]);
  const [userPlanId, setUserPlanId] = useState<string | null>(null);
  const [userWeekNumber, setUserWeekNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user's own current week sessions for side-by-side
  const fetchUserSessions = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: plan } = await supabase
        .from("training_plans")
        .select("id, current_week_number")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!plan) return;

      setUserPlanId(plan.id);
      setUserWeekNumber(plan.current_week_number);

      const { data: weekTarget } = await supabase
        .from("weekly_targets")
        .select("sessions")
        .eq("plan_id", plan.id)
        .eq("week_number", plan.current_week_number)
        .single();

      if (!weekTarget?.sessions) return;

      const sessions = weekTarget.sessions as PlanSession[];
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("session_name")
        .eq("user_id", user.id)
        .eq("plan_id", plan.id)
        .eq("week_number", plan.current_week_number);

      const completedNames = new Set((logs || []).map((l) => l.session_name));

      setUserSessions(
        sessions.map((s, i) => ({
          name: s.name,
          dimension: s.dimension,
          environment: inferSessionEnvironment(s),
          completed: completedNames.has(s.name),
          sessionIndex: i,
          fullSession: s,
        }))
      );
    } catch (err) {
      console.error("Error fetching user sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserSessions();
  }, [fetchUserSessions]);

  // Build lookup of matched session indices
  const matchedUserIndices = new Map(
    partnerWeek.matches.map((m) => [m.yourSessionIndex, m])
  );
  const matchedPartnerIndices = new Map(
    partnerWeek.matches.map((m) => [m.partnerSessionIndex, m])
  );

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-dark-surface rounded w-48" />
        <div className="h-32 bg-dark-surface rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {partnerWeek.partnerName}&apos;s Week
          </h2>
          <p className="text-sm text-dark-muted">
            {partnerWeek.objectiveName} — Week {partnerWeek.weekNumber} of {partnerWeek.totalWeeks}
          </p>
        </div>
      </div>

      {/* Partner score arcs (if visible) */}
      {partnerWeek.scoresVisible && partnerWeek.scores && partnerWeek.targetScores && (
        <div className="flex gap-4 justify-center pb-2">
          {(Object.keys(partnerWeek.scores) as Array<keyof typeof partnerWeek.scores>).map((dim) => (
            <ScoreArc
              key={dim}
              label={DIMENSION_LABELS[dim] || dim}
              current={partnerWeek.scores![dim]}
              target={partnerWeek.targetScores![dim]}
              size="mini"
            />
          ))}
        </div>
      )}

      {!partnerWeek.scoresVisible && (
        <p className="text-xs text-dark-muted text-center italic">
          Scores hidden — both partners must opt in to share
        </p>
      )}

      {/* Side-by-side layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Your week */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Your Week</h3>
          {userSessions.length > 0 ? (
            <div className="space-y-2">
              {userSessions.map((s, i) => {
                const match = matchedUserIndices.get(i);
                return (
                  <div key={i}>
                    <PartnerSessionCard
                      session={s}
                      isMatched={!!match}
                      matchReason={match?.matchReason}
                    />
                    {match && userPlanId && userWeekNumber !== null && (
                      <SyncUpButton
                        planId={userPlanId}
                        weekNumber={userWeekNumber}
                        sessionIndex={i}
                        onSwapped={onRefresh}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-dark-muted py-4">
              No sessions generated for your current week yet.
            </p>
          )}
        </div>

        {/* Partner's week */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">
            {partnerWeek.partnerName}&apos;s Week
          </h3>
          {partnerWeek.sessions.length > 0 ? (
            <div className="space-y-2">
              {partnerWeek.sessions.map((s, i) => {
                const match = matchedPartnerIndices.get(i);
                return (
                  <PartnerSessionCard
                    key={i}
                    session={s}
                    isMatched={!!match}
                    matchReason={match?.matchReason}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-dark-muted py-4">
              {partnerWeek.partnerName}&apos;s sessions for this week haven&apos;t been generated yet.
            </p>
          )}
        </div>
      </div>

      {/* Match summary */}
      {partnerWeek.matches.length === 0 && userSessions.length > 0 && partnerWeek.sessions.length > 0 && (
        <p className="text-sm text-dark-muted text-center py-2">
          No overlapping sessions this week. Check back next week!
        </p>
      )}
    </div>
  );
}
