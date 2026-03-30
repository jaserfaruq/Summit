"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrainingPlan, WeeklyTarget, Objective, PlanSession, WorkoutLog, ValidatedObjective, Dimension, WeekCompletionFeedback, DifficultyLevel, DIFFICULTY_LABELS, DIFFICULTY_SCALE_FACTORS, DifficultyAdjustment, PlanData, WeeklyReport, DimensionScores, SkillPracticeItem, GapAnalysis } from "@/lib/types";
import { usePlanData } from "@/lib/use-plan-data";
import { calculateAllScoresFromRatings, shouldHighlightRebalance, generateCompletionSummary } from "@/lib/scoring";
import DeletePlanButton from "@/components/DeletePlanButton";
import GapInfoBubble from "@/components/GapInfoBubble";
import ScoreArc from "@/components/ScoreArc";
import AlternativesPanel from "@/components/AlternativesPanel";
import AILoadingIndicator from "@/components/AILoadingIndicator";
import Link from "next/link";

/** Inline SVG mountain silhouette used when no hero image URL is stored */
const MOUNTAIN_SVG_FALLBACK = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1a1a2e"/><stop offset="40%" stop-color="#16213e"/><stop offset="70%" stop-color="#1b4d3e"/><stop offset="100%" stop-color="#0f3d3e"/></linearGradient><linearGradient id="g" x1=".5" y1="0" x2=".5" y2="1"><stop offset="0%" stop-color="#d4782f" stop-opacity=".4"/><stop offset="100%" stop-color="#d4782f" stop-opacity="0"/></linearGradient><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2a3a30"/><stop offset="100%" stop-color="#1a2a20"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1f2f25"/><stop offset="100%" stop-color="#0f1f15"/></linearGradient></defs><rect width="1200" height="400" fill="url(#s)"/><ellipse cx="600" cy="120" rx="300" ry="60" fill="url(#g)"/><polygon points="0,400 150,180 300,280 500,120 650,220 800,160 950,240 1050,140 1200,250 1200,400" fill="url(#a)" opacity=".7"/><polygon points="500,120 520,130 540,125" fill="#e8e8e8" opacity=".5"/><polygon points="800,160 825,172 845,168" fill="#e8e8e8" opacity=".5"/><polygon points="1050,140 1075,155 1090,150" fill="#e8e8e8" opacity=".5"/><polygon points="0,400 100,250 250,320 400,200 550,300 700,230 850,290 1000,210 1100,280 1200,220 1200,400" fill="url(#b)"/></svg>`)}`;

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8"><div className="animate-pulse h-8 bg-dark-border rounded w-1/3" /></div>}>
      <PlanContent />
    </Suspense>
  );
}

function PlanContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // SWR-cached plan data — returns stale data instantly on revisit, revalidates in background
  const { data: planData, isLoading: swrLoading, mutate } = usePlanData();

  // Local state derived from SWR (allows real-time mutation feedback)
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [weeks, setWeeks] = useState<WeeklyTarget[]>([]);
  const [objective, setObjective] = useState<Objective | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [skillPracticeExpanded, setSkillPracticeExpanded] = useState<Record<number, boolean>>({});

  const [loadingSessions, setLoadingSessions] = useState<Record<number, boolean>>({});
  const [streamingSessionCount, setStreamingSessionCount] = useState<Record<number, number>>({});
  const [sessionErrors, setSessionErrors] = useState<Record<number, string>>({});
  const [weekSessions, setWeekSessions] = useState<Record<number, PlanSession[]>>({});
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [validatedObj, setValidatedObj] = useState<ValidatedObjective | null>(null);
  const [philosophyExpanded, setPhilosophyExpanded] = useState(false);
  const [graduationExpanded, setGraduationExpanded] = useState(false);
  const [completingWeek, setCompletingWeek] = useState<number | null>(null);
  const [weekCompleteResult, setWeekCompleteResult] = useState<Record<number, WeekCompletionFeedback>>({});
  const [rebalancing, setRebalancing] = useState(false);
  const [adjustingDifficulty, setAdjustingDifficulty] = useState<DifficultyLevel | null>(null);
  const [deletingLog, setDeletingLog] = useState<string | null>(null);
  const [scoredWeekNumbers, setScoredWeekNumbers] = useState<Set<number>>(new Set());
  const [alternativesPanel, setAlternativesPanel] = useState<{
    weekNumber: number;
    sessionIndex: number;
    session: PlanSession;
  } | null>(null);
  const [reportModal, setReportModal] = useState<{ weekNumber: number; report: WeeklyReport } | null>(null);
  const [pollingReportWeeks, setPollingReportWeeks] = useState<Set<number>>(new Set());
  const [reportErrors, setReportErrors] = useState<Set<number>>(new Set());
  const [retryingReport, setRetryingReport] = useState<number | null>(null);
  const pollAttemptsRef = useRef<Map<number, number>>(new Map());
  // Track in-flight session generation to prevent duplicate API calls
  const inFlightWeeksRef = useRef<Set<number>>(new Set());

  const shouldGenerate = searchParams.get("generate") === "true";
  const objectiveId = searchParams.get("objectiveId");
  const assessmentId = searchParams.get("assessmentId");
  const loggedParam = searchParams.get("logged");

  const loading = swrLoading && !plan;

  // Sync SWR data into local state whenever it updates
  useEffect(() => {
    if (!planData.plan) return;
    setPlan(planData.plan);
    setWeeks(planData.weeks);
    setObjective(planData.objective);
    setValidatedObj(planData.validatedObj);
    setWorkoutLogs(planData.workoutLogs);
    setWeekSessions((prev) => {
      // Merge: keep locally-generated sessions, update from SWR for the rest
      const merged = { ...prev };
      for (const [k, v] of Object.entries(planData.weekSessions)) {
        if (!merged[Number(k)] || merged[Number(k)].length === 0) {
          merged[Number(k)] = v;
        }
      }
      return merged;
    });
    setScoredWeekNumbers(planData.scoredWeekNumbers);
    if (planData.activeWeek && expandedWeek === null) {
      setExpandedWeek(planData.activeWeek);
    }
  }, [planData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load current week + next 2 weeks sequentially on page open
  const autoLoadTriggeredRef = useRef(false);
  useEffect(() => {
    // Skip auto-load when navigating here to generate a new plan —
    // generatePlan() will call mutate() which re-triggers this effect with the new plan
    if (!plan || weeks.length === 0 || autoLoadTriggeredRef.current || shouldGenerate) return;
    autoLoadTriggeredRef.current = true;

    const currentWeek = plan.current_week_number || 1;
    const weeksToLoad = [currentWeek, currentWeek + 1, currentWeek + 2].filter(
      (wn) => weeks.some((w) => w.week_number === wn)
    );

    // Load sequentially: week 1 finishes, then week 2 starts, then week 3
    (async () => {
      for (const wn of weeksToLoad) {
        if (weekSessions[wn]?.length > 0) continue; // already loaded from DB
        await loadWeekSessions(wn);
      }
    })();
  }, [plan, weeks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand philosophy & graduation workouts on first visit to this plan
  useEffect(() => {
    if (!plan) return;
    const key = `plan-visited-${plan.id}`;
    const visited = localStorage.getItem(key);
    if (!visited) {
      setPhilosophyExpanded(true);
      setGraduationExpanded(true);
      localStorage.setItem(key, 'true');
    }
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch on loggedParam change (after logging a workout)
  useEffect(() => {
    if (loggedParam) mutate();
  }, [loggedParam, mutate]);

  useEffect(() => {
    if (shouldGenerate && objectiveId && assessmentId) {
      generatePlan(objectiveId, assessmentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generatePlan(objId: string, assId: string) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "",
          objectiveId: objId,
          assessmentId: assId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate plan");
      }

      const planResult = await res.json();

      // Reset auto-load so it triggers with the new plan data
      autoLoadTriggeredRef.current = false;
      router.replace("/plan");
      await mutate();
      // Sessions are generated on-demand when weeks are expanded (auto-load handles first 3)
    } catch (error) {
      console.error("Plan generation error:", error);
      setGenerateError(
        error instanceof Error ? error.message : "Failed to generate plan. Please try again."
      );
    }
    setGenerating(false);
  }

  async function loadWeekSessions(weekNumber: number, retryCount = 0) {
    if (!plan) return;
    if (weekSessions[weekNumber] && weekSessions[weekNumber].length > 0) return;
    // Prevent duplicate in-flight requests for the same week (skip check on retries)
    if (retryCount === 0 && inFlightWeeksRef.current.has(weekNumber)) return;
    inFlightWeeksRef.current.add(weekNumber);

    setLoadingSessions((prev) => ({ ...prev, [weekNumber]: true }));
    setSessionErrors((prev) => {
      const next = { ...prev };
      delete next[weekNumber];
      return next;
    });

    try {
      let res: Response;
      try {
        res = await fetch("/api/generate-week-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, weekNumber, stream: true }),
        });
      } catch (networkError) {
        // Network error (Failed to fetch) — retry with backoff
        if (retryCount < 2) {
          setLoadingSessions((prev) => ({ ...prev, [weekNumber]: false }));
          await new Promise((r) => setTimeout(r, 2000 * (retryCount + 1)));
          return loadWeekSessions(weekNumber, retryCount + 1);
        }
        throw networkError;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Retry on 404/401 — handles race condition where plan was just created
        // or auth session hasn't propagated to cookies yet
        if ((res.status === 404 || res.status === 401) && retryCount < 2) {
          setLoadingSessions((prev) => ({ ...prev, [weekNumber]: false }));
          await new Promise((r) => setTimeout(r, 1500 * (retryCount + 1)));
          return loadWeekSessions(weekNumber, retryCount + 1);
        }
        throw new Error(data.error || "Failed to load sessions");
      }

      // Check if response is streaming (text/plain) or JSON (cached sessions)
      const contentType = res.headers.get("content-type") || "";
      let sessions: PlanSession[];
      let suggestedSkillPractice: SkillPracticeItem[] | null = null;

      if (contentType.includes("text/plain") && res.body) {
        // Streaming response — read chunks, track progress, extract final JSON
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          // Count how many sessions have appeared so far (rough heuristic)
          const sessionMatches = accumulated.match(/"sessionName"/g);
          if (sessionMatches) {
            setStreamingSessionCount((prev) => ({ ...prev, [weekNumber]: sessionMatches.length }));
          }
        }
        setStreamingSessionCount((prev) => { const next = { ...prev }; delete next[weekNumber]; return next; });

        // Extract the final parsed sessions from the delimiter
        const jsonDelimiter = "\n__SESSIONS_JSON__\n";
        const errorDelimiter = "\n__SESSIONS_ERROR__\n";
        if (accumulated.includes(errorDelimiter)) {
          const errMsg = accumulated.split(errorDelimiter)[1];
          throw new Error(errMsg || "Failed to parse sessions");
        }
        if (accumulated.includes(jsonDelimiter)) {
          const jsonStr = accumulated.split(jsonDelimiter)[1];
          const parsed = JSON.parse(jsonStr);
          sessions = parsed.sessions;
          suggestedSkillPractice = parsed.suggestedSkillPractice || null;
        } else {
          throw new Error("Stream completed without session data");
        }
      } else {
        // Non-streaming JSON response (sessions were already cached)
        const data = await res.json();
        sessions = data.sessions;
        suggestedSkillPractice = data.suggestedSkillPractice || null;
      }

      setWeekSessions((prev) => ({ ...prev, [weekNumber]: sessions }));

      // Update the week's total_hours and suggested_skill_practice from response
      const totalMinutes = (sessions as PlanSession[]).reduce(
        (sum: number, s: PlanSession) => sum + (s.estimatedMinutes || 0),
        0
      );
      const computedHours = Math.round((totalMinutes / 60) * 10) / 10;
      setWeeks((prev) =>
        prev.map((w) =>
          w.week_number === weekNumber
            ? { ...w, total_hours: computedHours, ...(suggestedSkillPractice ? { suggested_skill_practice: suggestedSkillPractice } : {}) }
            : w
        )
      );

      // Pre-generate next week in the background (non-blocking)
      preGenerateNextWeek(weekNumber);
    } catch (error) {
      console.error(`Error loading sessions for week ${weekNumber}:`, error);
      setSessionErrors((prev) => ({
        ...prev,
        [weekNumber]: error instanceof Error ? error.message : "Failed to load sessions",
      }));
    }

    inFlightWeeksRef.current.delete(weekNumber);
    setLoadingSessions((prev) => ({ ...prev, [weekNumber]: false }));
  }

  function preGenerateNextWeek(currentWeekNumber: number) {
    if (!plan) return;
    // Pre-generate next 2 weeks sequentially so 3 weeks are always ready
    const nextWeeks = [currentWeekNumber + 1, currentWeekNumber + 2].filter(
      (wn) => weeks.some((w) => w.week_number === wn)
        && !(weekSessions[wn]?.length > 0)
        && !inFlightWeeksRef.current.has(wn)
    );
    if (nextWeeks.length === 0) return;

    (async () => {
      for (const nextWeek of nextWeeks) {
        if (inFlightWeeksRef.current.has(nextWeek)) continue;
        inFlightWeeksRef.current.add(nextWeek);
        try {
          const res = await fetch("/api/generate-week-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: plan.id, weekNumber: nextWeek }),
          });
          if (!res.ok) { inFlightWeeksRef.current.delete(nextWeek); continue; }
          const data = await res.json();
          if (data?.sessions) {
            setWeekSessions((prev) => {
              if (prev[nextWeek]?.length > 0) return prev;
              return { ...prev, [nextWeek]: data.sessions };
            });
          }
        } catch { /* Silent — pre-generation is best-effort */ }
        inFlightWeeksRef.current.delete(nextWeek);
      }
    })();
  }

  function handleWeekToggle(weekNumber: number) {
    const isExpanded = expandedWeek === weekNumber;
    const newExpanded = isExpanded ? null : weekNumber;
    setExpandedWeek(newExpanded);
    if (newExpanded !== null) loadWeekSessions(newExpanded);
  }

  async function handleCompleteWeek(week: WeeklyTarget) {
    if (!plan || !objective) return;
    setCompletingWeek(week.week_number);

    // Get logs for this week — extract ratings per session
    const weekLogs = workoutLogs.filter(
      (log) => log.week_number === week.week_number && log.plan_id === plan.id
    );

    const ratings = weekLogs
      .filter((log) => log.rating != null)
      .map((log) => ({
        sessionName: log.session_name || "",
        dimension: log.dimension as Dimension,
        rating: (log.rating || 3) as 1 | 2 | 3 | 4 | 5,
        comment: log.rating_comment || log.notes || "",
      }));

    const currentScores: DimensionScores = {
      cardio: objective.current_cardio_score,
      strength: objective.current_strength_score,
      climbing_technical: objective.current_climbing_score,
      flexibility: objective.current_flexibility_score,
    };
    const targetScores: DimensionScores = {
      cardio: objective.target_cardio_score,
      strength: objective.target_strength_score,
      climbing_technical: objective.target_climbing_score,
      flexibility: objective.target_flexibility_score,
    };
    const expectedScores = week.expected_scores as DimensionScores;

    // Optimistic update: compute scores client-side with base multipliers (no AI adjustment)
    const ratingData = ratings.map((r) => ({ dimension: r.dimension, rating: r.rating }));
    const hasNonThreeRatings = ratings.some((r) => r.rating !== 3);
    const optimisticScores = calculateAllScoresFromRatings(ratingData, currentScores, expectedScores);

    const dims: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];
    const optimisticGaps: Record<Dimension, number> = {} as Record<Dimension, number>;
    for (const dim of dims) { optimisticGaps[dim] = optimisticScores[dim] - expectedScores[dim]; }

    const optimisticResult: WeekCompletionFeedback = {
      updatedScores: optimisticScores,
      expectedScores,
      gaps: optimisticGaps,
      summary: generateCompletionSummary(optimisticScores, expectedScores, targetScores),
      rebalanceRecommended: shouldHighlightRebalance(optimisticScores, expectedScores).recommended,
      aiExplanations: hasNonThreeRatings ? { _pending: "Refining scores with AI evaluation..." } as unknown as Record<string, string> : {},
    };

    // Apply optimistic update immediately
    setWeekCompleteResult((prev) => ({ ...prev, [week.week_number]: optimisticResult }));
    setScoredWeekNumbers((prev) => { const next = new Set(Array.from(prev)); next.add(week.week_number); return next; });
    if (plan.current_week_number === week.week_number) {
      setPlan((prev) => prev ? { ...prev, current_week_number: week.week_number + 1 } : null);
    }
    setCompletingWeek(null); // UI unblocks immediately

    // Fire API call in background to persist and get AI-refined scores
    try {
      const res = await fetch("/api/complete-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          weekNumber: week.week_number,
          ratings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to complete week");
      }

      const result: WeekCompletionFeedback = await res.json();
      // Replace optimistic result with final AI-refined result
      setWeekCompleteResult((prev) => ({ ...prev, [week.week_number]: result }));

      // Refresh objective with persisted scores
      const supabase = createClient();
      const { data: updatedObj } = await supabase
        .from("objectives")
        .select("*")
        .eq("id", objective.id)
        .single();
      if (updatedObj) setObjective(updatedObj as Objective);

      // Trigger report generation
      setPollingReportWeeks((prev) => new Set(Array.from(prev)).add(week.week_number));
      triggeredReportsRef.current.add(week.week_number);
      fetch("/api/generate-weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, weekNumber: week.week_number }),
      }).then(async (res) => {
        if (!res.ok) {
          console.error("[Report] Generation API returned", res.status);
          setReportErrors((prev) => new Set(Array.from(prev)).add(week.week_number));
          setPollingReportWeeks((prev) => {
            const next = new Set(Array.from(prev));
            next.delete(week.week_number);
            return next;
          });
        }
      }).catch((err) => {
        console.error("[Report] Generation fetch failed:", err);
        setReportErrors((prev) => new Set(Array.from(prev)).add(week.week_number));
        setPollingReportWeeks((prev) => {
          const next = new Set(Array.from(prev));
          next.delete(week.week_number);
          return next;
        });
      });
    } catch (error) {
      console.error("Error completing week:", error);
      // Optimistic update stays in place — scores are approximate but visible.
      // The user can retry via rebalance or re-completing if needed.
    }
  }

  async function handleRebalance() {
    if (!plan) return;
    if (!confirm("Rebalance plan? This will redistribute training volume across dimensions based on your current progress and regenerate all remaining sessions.")) {
      return;
    }
    setRebalancing(true);
    try {
      const res = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          currentWeek: plan.current_week_number,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rebalance plan");
      }

      // Clear local session cache so weeks regenerate on-demand
      setWeekSessions({});
      inFlightWeeksRef.current.clear();
      autoLoadTriggeredRef.current = false;
      // Refresh plan data — auto-load will regenerate current + next 2 weeks
      await mutate();
    } catch (error) {
      console.error("Error rebalancing:", error);
      alert(error instanceof Error ? error.message : "Failed to rebalance plan");
    }
    setRebalancing(false);
  }

  async function handleAdjustDifficulty(level: DifficultyLevel) {
    if (!plan) return;
    const label = DIFFICULTY_LABELS[level];
    if (!confirm(`Adjust plan to "${label}"? This will update your target scores and graduation benchmarks, and regenerate remaining sessions.`)) {
      return;
    }
    setAdjustingDifficulty(level);
    try {
      const res = await fetch("/api/adjust-difficulty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, level }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to adjust difficulty");
      }

      // Refresh plan data to pick up new targets and cleared sessions
      await mutate();
    } catch (error) {
      console.error("Error adjusting difficulty:", error);
      alert(error instanceof Error ? error.message : "Failed to adjust difficulty");
    }
    setAdjustingDifficulty(null);
  }

  function getLogsForWeek(week: WeeklyTarget): WorkoutLog[] {
    return workoutLogs.filter(
      (log) => log.week_number === week.week_number && log.plan_id === plan?.id
    );
  }

  function isSessionLogged(sessionName: string, week: WeeklyTarget): boolean {
    const weekLogs = getLogsForWeek(week);
    return weekLogs.some((log) => log.session_name === sessionName);
  }

  function getLogForSession(sessionName: string, week: WeeklyTarget): WorkoutLog | undefined {
    const weekLogs = getLogsForWeek(week);
    return weekLogs.find((log) => log.session_name === sessionName);
  }

  async function handleDeleteLog(logId: string) {
    if (!confirm("Delete this workout log? If the week was already completed, scores will be reverted.")) return;
    setDeletingLog(logId);
    try {
      const res = await fetch("/api/delete-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete workout");
      }
      const result = await res.json();
      if (result.weekReverted) {
        alert("Week un-completed and scores reverted to previous values.");
      }
      await mutate();
    } catch (error) {
      console.error("Error deleting workout:", error);
      alert(error instanceof Error ? error.message : "Failed to delete workout");
    }
    setDeletingLog(null);
  }

  // Poll for weekly report on completed weeks that don't have one yet
  // Max 36 attempts (3 minutes at 5-second intervals)
  useEffect(() => {
    if (pollingReportWeeks.size === 0) return;
    const MAX_POLL_ATTEMPTS = 36;
    const interval = setInterval(async () => {
      const supabase = createClient();
      for (const wn of Array.from(pollingReportWeeks)) {
        const week = weeks.find((w) => w.week_number === wn);
        if (!week) continue;

        // Track attempts
        const attempts = (pollAttemptsRef.current.get(wn) || 0) + 1;
        pollAttemptsRef.current.set(wn, attempts);

        if (attempts > MAX_POLL_ATTEMPTS) {
          // Timed out — stop polling and show error
          console.error(`[Report] Polling timed out for week ${wn} after ${MAX_POLL_ATTEMPTS} attempts`);
          setPollingReportWeeks((prev) => {
            const next = new Set(Array.from(prev));
            next.delete(wn);
            return next;
          });
          setReportErrors((prev) => new Set(Array.from(prev)).add(wn));
          pollAttemptsRef.current.delete(wn);
          continue;
        }

        const { data } = await supabase
          .from("weekly_targets")
          .select("weekly_report")
          .eq("id", week.id)
          .single();

        if (data?.weekly_report) {
          const report = data.weekly_report as WeeklyReport;

          // Check for error sentinel
          if (report.error) {
            console.error(`[Report] Error sentinel found for week ${wn}:`, report);
            setPollingReportWeeks((prev) => {
              const next = new Set(Array.from(prev));
              next.delete(wn);
              return next;
            });
            setReportErrors((prev) => new Set(Array.from(prev)).add(wn));
            pollAttemptsRef.current.delete(wn);
            continue;
          }

          setWeeks((prev) =>
            prev.map((w) =>
              w.week_number === wn ? { ...w, weekly_report: report } : w
            )
          );
          setPollingReportWeeks((prev) => {
            const next = new Set(Array.from(prev));
            next.delete(wn);
            return next;
          });
          pollAttemptsRef.current.delete(wn);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingReportWeeks, weeks]);

  // Fallback: on page load/reload, detect scored weeks missing reports.
  // Triggers report generation and polling for weeks that were scored but
  // never got a report (e.g., background generation failed on a previous visit).
  // Primary trigger is in handleCompleteWeek — this is only for recovery.
  const triggeredReportsRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (weeks.length === 0 || !plan) return;
    const needsPolling = new Set<number>();
    const errors = new Set<number>();
    for (const week of weeks) {
      // Only check scoredWeekNumbers (from DB), not weekCompleteResult (from session).
      // handleCompleteWeek handles the current-session trigger directly.
      const isScored = scoredWeekNumbers.has(week.week_number);
      if (isScored && !week.weekly_report) {
        needsPolling.add(week.week_number);
        // Trigger report generation if we haven't already this session
        if (!triggeredReportsRef.current.has(week.week_number)) {
          triggeredReportsRef.current.add(week.week_number);
          console.log(`[Report] Fallback trigger: generating report for week ${week.week_number}`);
          fetch("/api/generate-weekly-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planId: plan.id, weekNumber: week.week_number }),
          }).then(async (res) => {
            if (!res.ok) {
              console.error(`[Report] Fallback generation API returned ${res.status}`);
              setReportErrors((prev) => new Set(Array.from(prev)).add(week.week_number));
              setPollingReportWeeks((prev) => {
                const next = new Set(Array.from(prev));
                next.delete(week.week_number);
                return next;
              });
            }
          }).catch((err) => {
            console.error("[Report] Fallback generation failed:", err);
            setReportErrors((prev) => new Set(Array.from(prev)).add(week.week_number));
            setPollingReportWeeks((prev) => {
              const next = new Set(Array.from(prev));
              next.delete(week.week_number);
              return next;
            });
          });
        }
      } else if (isScored && week.weekly_report?.error) {
        errors.add(week.week_number);
      }
    }
    if (needsPolling.size > 0) {
      setPollingReportWeeks(needsPolling);
    }
    if (errors.size > 0) {
      setReportErrors((prev) => {
        const next = new Set(Array.from(prev));
        errors.forEach((wn) => next.add(wn));
        return next;
      });
    }
  }, [weeks, scoredWeekNumbers, plan]);

  if (generating) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-10 shadow-xl">
        {generateError ? (
          <div>
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Plan Generation Failed</h2>
            <p className="text-red-400 mb-6">{generateError}</p>
            <button
              onClick={() => {
                if (objectiveId && assessmentId) {
                  generatePlan(objectiveId, assessmentId);
                }
              }}
              className="bg-gold text-dark-bg px-6 py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-4">⛰️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Generating Your Training Plan</h2>
            <AILoadingIndicator
              size="lg"
              message="Our AI coach is designing a periodized plan tailored to your objective and current fitness..."
              rotatingMessages={[
                "Calculating weekly volume progression...",
                "Building session structure across dimensions...",
                "Mapping graduation benchmarks to weekly targets...",
                "Calibrating difficulty to your assessment results...",
                "Setting up score trajectory...",
              ]}
            />
          </div>
        )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-dark-border rounded w-1/3" />
          <div className="h-4 bg-dark-border rounded w-1/2" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-dark-border rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">No Active Plan</h2>
        <p className="text-white/70 mb-8 drop-shadow-md">Add an objective and complete your assessment to generate a training plan.</p>
        <Link
          href="/dashboard"
          className="inline-block bg-gold text-dark-bg px-6 py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const planSummary = plan.plan_data?.planSummary;
  const heroImageUrl = plan.plan_data?.heroImageUrl;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
      {/* Hero header with blurred background image */}
      <div className="relative rounded-xl overflow-hidden -mx-4 sm:mx-0">
        {/* Background image layer */}
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl || MOUNTAIN_SVG_FALLBACK}
            alt=""
            className="w-full h-full object-cover blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/20" />
        </div>

        {/* Content over image */}
        <div className="relative px-6 pt-8 pb-6 sm:pt-10 sm:pb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white drop-shadow-lg leading-tight">{objective?.name}</h2>
              <p className="text-white/60 text-sm mt-2 drop-shadow tracking-wide">
                {weeks.length} weeks · Target: {objective?.target_date ? new Date(objective.target_date).toLocaleDateString() : ""}
              </p>
              {objective && (
                <div className="flex gap-4 sm:gap-5 mt-4">
                  <ScoreArc label="Cardio" current={objective.current_cardio_score} target={objective.target_cardio_score} size="mini" />
                  <ScoreArc label="Strength" current={objective.current_strength_score} target={objective.target_strength_score} size="mini" />
                  <ScoreArc label="Climbing" current={objective.current_climbing_score} target={objective.target_climbing_score} size="mini" />
                  <ScoreArc label="Flexibility" current={objective.current_flexibility_score} target={objective.target_flexibility_score} size="mini" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              <DeletePlanButton planId={plan.id} onDeleted={() => {
              setPlan(null);
              setWeeks([]);
              setObjective(null);
              setWeekSessions({});
              setWorkoutLogs([]);
            }} />
            </div>
          </div>
        </div>
      </div>

      {/* Objective details */}
      {objective && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50 px-5 py-4">
          {validatedObj?.description ? (
            <p className="text-sm text-dark-muted mb-4 leading-relaxed">{validatedObj.description}</p>
          ) : objective.relevance_profiles && typeof objective.relevance_profiles === "object" && "cardio" in objective.relevance_profiles && (
            <p className="text-sm text-dark-muted mb-4 leading-relaxed">
              {(objective.relevance_profiles as { cardio: { summary: string } }).cardio.summary}
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-dark-muted text-xs uppercase tracking-wider">Type </span>
              <span className="text-dark-text capitalize">{objective.type.replace("_", " ")}</span>
            </div>
            {validatedObj?.route && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Route </span>
                <span className="text-dark-text">{validatedObj.route}</span>
              </div>
            )}
            {(objective.distance_miles || validatedObj?.distance_miles) && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Distance </span>
                <span className="text-dark-text">{objective.distance_miles || validatedObj?.distance_miles} mi</span>
              </div>
            )}
            {(objective.elevation_gain_ft || validatedObj?.total_gain_ft) && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Gain </span>
                <span className="text-dark-text">{(objective.elevation_gain_ft || validatedObj?.total_gain_ft)?.toLocaleString()} ft</span>
              </div>
            )}
            {validatedObj?.summit_elevation_ft && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Summit </span>
                <span className="text-dark-text">{validatedObj.summit_elevation_ft.toLocaleString()} ft</span>
              </div>
            )}
            {(objective.technical_grade || validatedObj?.technical_grade) && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Grade </span>
                <span className="text-dark-text">{objective.technical_grade || validatedObj?.technical_grade}</span>
              </div>
            )}
            {validatedObj?.difficulty && (
              <div>
                <span className="text-dark-muted text-xs uppercase tracking-wider">Difficulty </span>
                <span className="text-dark-text capitalize">{validatedObj.difficulty}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan summary — collapsible */}
      {planSummary && (
        <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50">
          <button
            onClick={() => setPhilosophyExpanded(!philosophyExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <h3 className="text-sm font-semibold text-dark-text uppercase tracking-wider">Plan Philosophy</h3>
            <svg
              className={`w-4 h-4 text-dark-muted transition-transform flex-shrink-0 ${philosophyExpanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {philosophyExpanded && (
            <div className="px-5 pb-5 pt-1 space-y-3 border-t border-dark-border/40">
              {planSummary.philosophy.split(/\n\n+/).map((paragraph: string, i: number) => (
                <p key={i} className="text-sm text-dark-muted leading-relaxed">{paragraph.trim()}</p>
              ))}
              <p className="text-sm text-dark-muted leading-relaxed">{planSummary.weeklyStructure}</p>

              {/* Initial Assessment link */}
              {objective && (
                <Link
                  href={`/assessment/${objective.id}?view=results`}
                  className="inline-block text-sm text-gold hover:text-gold/80 transition-colors mt-1"
                >
                  View initial assessment →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Graduation workouts — collapsible, prefer objective benchmarks (synced from seed), then validated, then plan snapshot */}
      {(objective?.graduation_benchmarks || plan.graduation_workouts || validatedObj?.graduation_benchmarks) && (
        <div className="rounded-xl border border-gold/30 overflow-hidden bg-dark-card">
          <button
            onClick={() => setGraduationExpanded(!graduationExpanded)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-gold uppercase tracking-wider">Graduation Workouts</h3>
                <p className="text-xs text-dark-muted mt-0.5">If you can hit these, you&apos;re more than ready</p>
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-gold/50 transition-transform flex-shrink-0 ${graduationExpanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {graduationExpanded && (
            <div className="px-5 pb-5 border-t border-gold/15">
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
                  const source = objective?.graduation_benchmarks || validatedObj?.graduation_benchmarks || plan.graduation_workouts;
                  const benchmarks = (source as unknown as Record<string, Array<{ exerciseName: string; graduationTarget: string }>>)?.[dim];
                  if (!benchmarks || benchmarks.length === 0) return null;
                  const gapAnalysis = (plan.plan_data as PlanData)?.gapAnalysis;
                  const dimGap = dim !== "flexibility" && gapAnalysis ? gapAnalysis[dim as keyof GapAnalysis] : null;
                  return (
                    <div key={dim} className="space-y-1.5">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-xs font-semibold text-gold/70 uppercase tracking-wider">{dim.replace("_", " / ")}</h4>
                        {dimGap?.classification === "very_challenging" && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            Aggressive timeline
                            <GapInfoBubble />
                          </span>
                        )}
                      </div>
                      {benchmarks.map((b, i) => (
                        <div key={i} className="space-y-0.5">
                          <span className="text-sm text-dark-muted leading-snug block">{b.exerciseName}</span>
                          <strong className="text-sm text-dark-text font-semibold leading-snug block">{b.graduationTarget}</strong>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Adjust Difficulty & Rebalance */}
      {objective && plan && (
        <DifficultyAdjuster
          plan={plan}
          adjustingDifficulty={adjustingDifficulty}
          onAdjust={handleAdjustDifficulty}
          rebalancing={rebalancing}
          onRebalance={handleRebalance}
          rebalanceHighlighted={(() => {
            const current = {
              cardio: objective.current_cardio_score,
              strength: objective.current_strength_score,
              climbing_technical: objective.current_climbing_score,
              flexibility: objective.current_flexibility_score,
            };
            const currentWeekData = weeks.find(w => w.week_number === plan.current_week_number);
            if (!currentWeekData?.expected_scores) return false;
            const expected = currentWeekData.expected_scores as unknown as Record<string, number>;
            return Object.keys(current).some(
              dim => Math.abs((expected[dim] || 0) - current[dim as keyof typeof current]) >= 5
            );
          })()}
        />
      )}

      {/* Week list */}
      <div className="space-y-2.5">
        {weeks.map((week) => {
          const isExpanded = expandedWeek === week.week_number;
          const isCurrent = plan.current_week_number === week.week_number;

          const sessions = weekSessions[week.week_number] || [];
          const isLoadingSessions = loadingSessions[week.week_number];
          const sessionError = sessionErrors[week.week_number];
          const weekLogs = getLogsForWeek(week);
          const hasLogs = weekLogs.length > 0;
          const completeResult = weekCompleteResult[week.week_number];
          const isCompleting = completingWeek === week.week_number;
          const alreadyScored = scoredWeekNumbers.has(week.week_number);
          const isPastOrCurrent = week.week_number <= plan.current_week_number;
          const canComplete = isPastOrCurrent && hasLogs && !completeResult && !alreadyScored;

          return (
            <div
              key={week.id}
              className={`bg-dark-card/80 backdrop-blur-sm rounded-xl border overflow-hidden ${
                isCurrent ? "border-gold/40 ring-1 ring-gold/20" : "border-dark-border/50"
              }`}
            >
              {/* Week header */}
              <button
                onClick={() => handleWeekToggle(week.week_number)}
                className="w-full px-5 py-3.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-sm font-semibold text-white tabular-nums">Week {week.week_number}</span>
                  {isCurrent && (
                    <span className="text-[10px] bg-gold text-dark-bg px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0">Now</span>
                  )}
                  {(alreadyScored || completeResult) && (
                    <span className="text-[10px] text-green-400 font-medium flex-shrink-0">✓ Done</span>
                  )}
                  {hasLogs && !alreadyScored && !completeResult && (
                    <span className="text-[10px] text-dark-muted flex-shrink-0">{weekLogs.length} logged</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-dark-muted">
                      {new Date(week.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {sessions.length > 0 ? ` · ${Math.round((week.total_hours || 0) * 2) / 2}h` : ""}
                    </div>
                    {week.expected_scores && (
                      <div className="flex gap-2 text-[10px] text-dark-muted/60 justify-end mt-0.5">
                        <span>C{(week.expected_scores as unknown as Record<string, number>).cardio}</span>
                        <span>S{(week.expected_scores as unknown as Record<string, number>).strength}</span>
                        <span>CT{(week.expected_scores as unknown as Record<string, number>).climbing_technical}</span>
                        <span>F{(week.expected_scores as unknown as Record<string, number>).flexibility}</span>
                      </div>
                    )}
                  </div>
                  <svg className={`w-4 h-4 text-dark-muted/60 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Sessions */}
              {isExpanded && (
                <div className="border-t border-dark-border/40 px-4 pb-4 pt-3 space-y-2">
                  {isLoadingSessions && (
                    <AILoadingIndicator
                      size="sm"
                      message={streamingSessionCount[week.week_number]
                        ? `Building session ${streamingSessionCount[week.week_number]}…`
                        : `Generating sessions for Week ${week.week_number}…`}
                      rotatingMessages={[
                        "Designing exercises matched to your progress...",
                        "Balancing volume across training dimensions...",
                        "Adapting intensity to your current level...",
                      ]}
                    />
                  )}

                  {sessionError && !isLoadingSessions && (
                    <div className="py-4 text-center bg-red-900/20 rounded-lg border border-red-800/40">
                      <p className="text-sm text-red-400 mb-3">{sessionError}</p>
                      <button
                        onClick={() => loadWeekSessions(week.week_number)}
                        className="text-sm bg-gold text-dark-bg px-4 py-2 rounded-lg hover:bg-gold/90 transition-colors font-medium"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {!isLoadingSessions && !sessionError && sessions.length === 0 && (
                    <div className="py-5 text-center text-dark-muted/60 text-sm">
                      Sessions should appear shortly.
                    </div>
                  )}

                  {sessions.map((session: PlanSession, i: number) => {
                    const sessionKey = `${week.week_number}-${i}`;
                    const isSessionExpanded = expandedSession === sessionKey;
                    const logged = isSessionLogged(session.name, week);

                    return (
                      <div
                        key={i}
                        className={`rounded-lg border ${
                          logged
                            ? "border-green-800/30 bg-green-900/10"
                            : "border-dark-border/60 bg-dark-surface/60"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSession(isSessionExpanded ? null : sessionKey);
                          }}
                          className="w-full px-4 py-3 flex items-start justify-between text-left gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {logged && <span className="text-green-400 text-xs">✓</span>}
                              <span className={`font-medium text-sm leading-snug ${logged ? "line-through opacity-50 text-dark-muted" : "text-dark-text"}`}>
                                {session.name}
                              </span>
                              {session.isAlternative && (
                                <span className="text-[10px] bg-burnt-orange/20 text-burnt-orange px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide flex-shrink-0">Alt</span>
                              )}
                            </div>
                            <div className="text-[11px] text-dark-muted/70 mt-0.5">{Math.round((session.estimatedMinutes || 0) / 5) * 5} min</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                            {logged && (() => {
                              const log = getLogForSession(session.name, week);
                              return log ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteLog(log.id); }}
                                  disabled={deletingLog === log.id}
                                  className="text-xs text-red-400/70 hover:text-red-300 px-1.5 py-1 rounded hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                  title="Delete this workout log"
                                >
                                  {deletingLog === log.id ? "…" : "✕"}
                                </button>
                              ) : null;
                            })()}
                            {!logged && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAlternativesPanel({ weekNumber: week.week_number, sessionIndex: i, session });
                                  }}
                                  className="text-[11px] text-dark-muted/70 hover:text-dark-text px-2 py-1 rounded hover:bg-dark-border/40 transition-colors underline underline-offset-2"
                                >
                                  Alternatives
                                </button>
                                <Link
                                  href={`/log?session=${encodeURIComponent(session.name)}&planId=${plan.id}&week=${week.week_number}`}
                                  className="text-xs bg-gold text-dark-bg px-3 py-1.5 rounded-md hover:bg-gold/90 transition-colors font-semibold"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Log
                                </Link>
                              </>
                            )}
                            <svg className={`w-3.5 h-3.5 text-dark-muted/50 transition-transform flex-shrink-0 ${isSessionExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {isSessionExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-dark-border/30 space-y-4">
                            <p className="text-sm text-dark-muted/80 italic leading-relaxed pt-1">{session.objective}</p>

                            {session.warmUp && (
                              <div>
                                <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-2">
                                  Warm-Up · {session.warmUp.rounds} round{session.warmUp.rounds > 1 ? "s" : ""}
                                </h5>
                                <ul className="text-sm text-dark-muted space-y-1">
                                  {session.warmUp.exercises.map((ex, j) => (
                                    <li key={j} className="flex gap-2">
                                      <span className="text-dark-muted/40 select-none">—</span>
                                      <span>{ex.name} <span className="text-dark-muted/60">{ex.reps}</span></span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {session.training && (
                              <div>
                                <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-2">Training</h5>
                                <ol className="text-sm text-dark-muted space-y-3">
                                  {session.training.map((ex) => (
                                    <li key={ex.exerciseNumber}>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-dark-muted/40 text-[11px] tabular-nums select-none">{ex.exerciseNumber}.</span>
                                        <span className="font-medium text-dark-text leading-snug">
                                          {ex.description}
                                          {ex.durationMinutes ? (
                                            <span className="text-dark-muted/60 font-normal text-[11px] ml-2">{ex.durationMinutes} min</span>
                                          ) : null}
                                        </span>
                                      </div>
                                      {ex.details && (
                                        <p className="text-dark-muted/80 ml-4 mt-0.5 leading-snug">{ex.details}</p>
                                      )}
                                      {ex.intensityNote && (
                                        <p className="text-dark-muted/60 text-xs ml-4 mt-0.5 italic">{ex.intensityNote}</p>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {session.cooldown && (
                              <div>
                                <h5 className="text-[10px] font-semibold text-gold/70 uppercase tracking-widest mb-2">Cooldown</h5>
                                <p className="text-sm text-dark-muted leading-relaxed">{session.cooldown}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Suggested Skill Practice */}
                  {week.suggested_skill_practice && week.suggested_skill_practice.length > 0 && (
                    <div className="mt-4 rounded-lg border border-sage/30 bg-sage/5 px-4 py-3">
                      <button
                        onClick={() => setSkillPracticeExpanded((prev) => ({ ...prev, [week.week_number]: !prev[week.week_number] }))}
                        className="w-full text-left flex items-center justify-between"
                      >
                        <div>
                          <h5 className="text-[10px] font-semibold text-sage uppercase tracking-widest mb-1">
                            Suggested Skill Practice
                          </h5>
                          <p className="text-[11px] text-dark-muted">
                            Practice these when you have time and access to appropriate terrain.
                          </p>
                        </div>
                        <svg className={`w-4 h-4 text-sage transition-transform ${skillPracticeExpanded[week.week_number] ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {skillPracticeExpanded[week.week_number] && (
                        <ul className="space-y-2 mt-3">
                          {(week.suggested_skill_practice as SkillPracticeItem[]).map((item, i) => (
                            <li key={i} className="text-sm text-dark-text">
                              <span className="font-medium">{item.skill}</span>
                              <span className="text-dark-muted"> — {item.terrain}</span>
                              <p className="text-[13px] text-dark-muted mt-0.5">{item.description}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Complete Week button */}
                  {canComplete && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleCompleteWeek(week)}
                        disabled={isCompleting}
                        className="w-full py-3 rounded-lg font-semibold text-sm transition-colors bg-gold text-dark-bg hover:bg-gold/90 disabled:opacity-50"
                      >
                        {isCompleting
                          ? "Updating Scores…"
                          : `Complete Week ${week.week_number} & Update Scores`
                        }
                      </button>
                      {isCompleting && (
                        <AILoadingIndicator
                          size="sm"
                          message="Evaluating your training against the plan..."
                          rotatingMessages={[
                            "Reviewing your ratings and comments...",
                            "Assessing relevance to your objective...",
                            "Calculating score adjustments...",
                          ]}
                        />
                      )}
                    </div>
                  )}

                  {/* Score update result with trajectory feedback */}
                  {completeResult && (
                    <div className={`mt-1 rounded-lg p-4 border ${
                      completeResult.rebalanceRecommended
                        ? "bg-burnt-orange/10 border-burnt-orange/30"
                        : "bg-green-900/20 border-green-800/40"
                    }`}>
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-3">Scores Updated</h4>
                      <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                        <div className="text-center">
                          <div className="text-dark-muted mb-0.5">Cardio</div>
                          <div className="text-dark-text font-semibold">{completeResult.updatedScores.cardio}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-dark-muted mb-0.5">Strength</div>
                          <div className="text-dark-text font-semibold">{completeResult.updatedScores.strength}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-dark-muted mb-0.5">Climbing</div>
                          <div className="text-dark-text font-semibold">{completeResult.updatedScores.climbing_technical}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-dark-muted mb-0.5">Flex</div>
                          <div className="text-dark-text font-semibold">{completeResult.updatedScores.flexibility}</div>
                        </div>
                      </div>
                      {completeResult.summary && (
                        <p className="text-xs text-dark-muted leading-relaxed">{completeResult.summary}</p>
                      )}
                      {completeResult.rebalanceRecommended && (
                        <p className="text-xs text-burnt-orange mt-2">
                          Consider rebalancing — some dimensions are significantly off track.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Weekly Report button */}
                  {(alreadyScored || completeResult) && (
                    <div className="pt-1">
                      {week.weekly_report && !week.weekly_report.error ? (
                        <button
                          onClick={() => setReportModal({ weekNumber: week.week_number, report: week.weekly_report! })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-burnt-orange/15 text-burnt-orange border border-burnt-orange/30 hover:bg-burnt-orange/25"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Report
                        </button>
                      ) : reportErrors.has(week.week_number) || week.weekly_report?.error ? (
                        <button
                          onClick={async () => {
                            if (!plan) return;
                            setRetryingReport(week.week_number);
                            // Clear error sentinel from DB so fresh generation can write
                            const supabase = createClient();
                            await supabase
                              .from("weekly_targets")
                              .update({ weekly_report: null })
                              .eq("id", week.id);
                            // Clear error state and re-enter polling
                            setReportErrors((prev) => {
                              const next = new Set(Array.from(prev));
                              next.delete(week.week_number);
                              return next;
                            });
                            setWeeks((prev) =>
                              prev.map((w) =>
                                w.week_number === week.week_number ? { ...w, weekly_report: null } : w
                              )
                            );
                            pollAttemptsRef.current.delete(week.week_number);
                            try {
                              await fetch("/api/generate-weekly-report", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ planId: plan.id, weekNumber: week.week_number }),
                              });
                            } catch {
                              // Endpoint will store result/error; polling will pick it up
                            }
                            setPollingReportWeeks((prev) => new Set(Array.from(prev)).add(week.week_number));
                            setRetryingReport(null);
                          }}
                          disabled={retryingReport === week.week_number}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors bg-red-900/20 text-red-400 border border-red-800/30 hover:bg-red-900/30 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {retryingReport === week.week_number ? "Retrying…" : "Report failed — Retry"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-dark-muted/70">
                          <div className="w-3 h-3 border-[1.5px] border-dark-muted border-t-transparent rounded-full animate-spin" />
                          Report generating…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alternatives Panel */}
      {alternativesPanel && plan && (
        <AlternativesPanel
          isOpen={!!alternativesPanel}
          onClose={() => setAlternativesPanel(null)}
          planId={plan.id}
          weekNumber={alternativesPanel.weekNumber}
          sessionIndex={alternativesPanel.sessionIndex}
          session={alternativesPanel.session}
          onSessionReplaced={(newSessions) => {
            setWeekSessions(prev => ({
              ...prev,
              [alternativesPanel.weekNumber]: newSessions,
            }));
            setAlternativesPanel(null);
          }}
        />
      )}

      {/* Weekly Report Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm" onClick={() => setReportModal(null)}>
          <div
            className="bg-dark-card border border-dark-border rounded-t-2xl sm:rounded-xl max-w-2xl w-full max-h-[92vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border/60 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <p className="text-[10px] text-dark-muted uppercase tracking-widest">Weekly Report</p>
                <h3 className="text-base font-semibold text-white mt-0.5">Week {reportModal.weekNumber}</h3>
              </div>
              <button
                onClick={() => setReportModal(null)}
                className="text-dark-muted hover:text-white transition-colors p-1.5 rounded-lg hover:bg-dark-border/40"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-6">
              <ReportSection title="Week Summary" content={reportModal.report.summary} />
              <ReportSection title="Score Changes & Why" content={reportModal.report.scoreChanges} />
              <ReportSection title="Where You Stand" content={reportModal.report.whereYouStand} />
              <ReportSection title="Next Week Focus" content={reportModal.report.nextWeekFocus} />
              {reportModal.report.considerAdjusting && (
                <ReportSection title="Consider Adjusting?" content={reportModal.report.considerAdjusting} accent />
              )}
              <p className="text-[11px] text-dark-muted/50 text-right pb-1">
                Generated {new Date(reportModal.report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportSection({ title, content, accent }: { title: string; content: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-lg border border-burnt-orange/20 bg-burnt-orange/5 px-4 py-3" : ""}>
      <h4 className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${accent ? "text-burnt-orange" : "text-gold/70"}`}>
        {title}
      </h4>
      <div className="text-sm text-dark-text leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

const DIFFICULTY_INFO: Record<DifficultyLevel, { description: string; prevalence: string }> = {
  much_easier: {
    description: "Scales target scores to 60% of the remaining gap. Best for recovery from injury, returning after a long break, or when the objective feels overwhelming.",
    prevalence: "Used by ~10% of athletes — typically those adapting after setbacks.",
  },
  slightly_easier: {
    description: "Scales target scores to 80% of the remaining gap. Good when sessions consistently feel too hard (rating 1–2) or life stress is limiting recovery.",
    prevalence: "Used by ~25% of athletes — the most common downward adjustment.",
  },
  slightly_harder: {
    description: "Scales target scores to 120% of the remaining gap. For when sessions consistently feel too easy (rating 4–5) and you want to push toward a stronger finish.",
    prevalence: "Used by ~20% of athletes — common mid-plan when fitness is building fast.",
  },
  much_harder: {
    description: "Scales target scores to 150% of the remaining gap. For experienced athletes who want an aggressive build. Significantly increases weekly volume and intensity.",
    prevalence: "Used by ~5% of athletes — only recommended with a strong training base.",
  },
};

function DifficultyAdjuster({
  plan,
  adjustingDifficulty,
  onAdjust,
  rebalancing,
  onRebalance,
  rebalanceHighlighted,
}: {
  plan: TrainingPlan;
  adjustingDifficulty: DifficultyLevel | null;
  onAdjust: (level: DifficultyLevel) => void;
  rebalancing: boolean;
  onRebalance: () => void;
  rebalanceHighlighted: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeInfo, setActiveInfo] = useState<DifficultyLevel | "rebalance" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close info popover on outside click
  useEffect(() => {
    if (!activeInfo) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveInfo(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activeInfo]);

  const netLabel = (() => {
    const adjustments = (plan.plan_data as PlanData)?.difficultyAdjustments;
    if (!adjustments || adjustments.length === 0) return "Original";
    const net = adjustments.reduce(
      (sum: number, a: DifficultyAdjustment) => sum + (a.level.includes("harder") ? 1 : -1),
      0
    );
    if (net === 0) return "Original";
    return net > 0 ? `+${net} harder` : `${net} easier`;
  })();

  return (
    <div className="bg-dark-card/80 backdrop-blur-sm rounded-xl border border-dark-border/50" ref={containerRef}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <h3 className="text-sm font-semibold text-white">Adjust Plan</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-muted">{netLabel}</span>
          <svg
            className={`w-4 h-4 text-dark-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Difficulty buttons */}
          <div className="space-y-2">
            <p className="text-xs text-dark-muted font-medium uppercase tracking-wide">Difficulty</p>
            <div className="grid grid-cols-2 gap-2">
              {(["much_easier", "slightly_easier", "slightly_harder", "much_harder"] as DifficultyLevel[]).map((level) => (
                <div key={level} className="relative">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAdjust(level)}
                      disabled={!!adjustingDifficulty}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${
                        level.includes("easier")
                          ? "bg-blue-900/20 border-blue-800/40 text-blue-300 hover:bg-blue-900/30"
                          : "bg-burnt-orange/10 border-burnt-orange/30 text-burnt-orange hover:bg-burnt-orange/20"
                      } disabled:opacity-50`}
                    >
                      {adjustingDifficulty === level ? "Adjusting..." : `${DIFFICULTY_LABELS[level]} (${DIFFICULTY_SCALE_FACTORS[level]}x)`}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveInfo(activeInfo === level ? null : level);
                      }}
                      className="flex-shrink-0 w-7 h-7 rounded-full border border-dark-border/60 text-dark-muted hover:text-white hover:border-white/40 flex items-center justify-center text-xs font-semibold transition-colors"
                      aria-label={`Info about ${DIFFICULTY_LABELS[level]}`}
                    >
                      i
                    </button>
                  </div>

                  {activeInfo === level && (
                    <div className="absolute z-20 bottom-full mb-2 left-0 right-0 bg-dark-bg border border-dark-border rounded-lg p-3 shadow-xl">
                      <p className="text-xs text-dark-text leading-relaxed">{DIFFICULTY_INFO[level].description}</p>
                      <p className="text-xs text-dark-muted mt-2 italic">{DIFFICULTY_INFO[level].prevalence}</p>
                      <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-dark-bg border-r border-b border-dark-border rotate-45" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rebalance button */}
          <div className="pt-1 relative">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onRebalance}
                disabled={rebalancing}
                className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${
                  rebalanceHighlighted
                    ? "bg-burnt-orange/20 border-burnt-orange/40 text-burnt-orange hover:bg-burnt-orange/30"
                    : "bg-dark-border/20 border-dark-border/50 text-dark-muted hover:bg-dark-border/30 hover:text-white"
                } disabled:opacity-50`}
              >
                {rebalancing ? "Rebalancing..." : "Rebalance Plan"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveInfo(activeInfo === "rebalance" ? null : "rebalance");
                }}
                className="flex-shrink-0 w-7 h-7 rounded-full border border-dark-border/60 text-dark-muted hover:text-white hover:border-white/40 flex items-center justify-center text-xs font-semibold transition-colors"
                aria-label="Info about Rebalance Plan"
              >
                i
              </button>
            </div>
            {activeInfo === "rebalance" && (
              <div className="absolute z-20 bottom-full mb-2 left-0 right-0 bg-dark-bg border border-dark-border rounded-lg p-3 shadow-xl">
                <p className="text-xs text-dark-text leading-relaxed">Redistributes training volume across dimensions based on your actual progress. Dimensions ahead of schedule drop to maintenance (min 60% volume), freeing time for dimensions that are behind.</p>
                <p className="text-xs text-dark-muted mt-2 italic">Highlighted when any dimension is 5+ points off the expected trajectory.</p>
                <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-dark-bg border-r border-b border-dark-border rotate-45" />
              </div>
            )}
            {rebalanceHighlighted && (
              <p className="text-[10px] text-burnt-orange/70 mt-1 text-center">One or more dimensions are 5+ points off trajectory</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
