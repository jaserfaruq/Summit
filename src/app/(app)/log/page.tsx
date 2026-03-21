"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Dimension, PlanSession, WeeklyTarget, WorkoutRating } from "@/lib/types";

const RATING_OPTIONS: { value: WorkoutRating; label: string; description: string }[] = [
  { value: 1, label: "1", description: "Way too hard — couldn't complete" },
  { value: 2, label: "2", description: "Struggled — barely finished" },
  { value: 3, label: "3", description: "Just right — good challenge" },
  { value: 4, label: "4", description: "Slightly easy — could do more" },
  { value: 5, label: "5", description: "Way too easy — need harder work" },
];

function LogForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionName = searchParams.get("session");
  const planId = searchParams.get("planId");
  const weekNumber = searchParams.get("week");

  const [dimension, setDimension] = useState<Dimension>("cardio");
  const [notes, setNotes] = useState("");
  const [ratingComment, setRatingComment] = useState("");
  const [rating, setRating] = useState<WorkoutRating>(3);
  const [loading, setLoading] = useState(false);
  const [prescribedSession, setPrescribedSession] = useState<PlanSession | null>(null);

  const requiresComment = rating !== 3;

  useEffect(() => {
    if (planId && weekNumber && sessionName) {
      fetchSessionDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, weekNumber, sessionName]);

  async function fetchSessionDetails() {
    const supabase = createClient();
    const { data: weekTarget } = await supabase
      .from("weekly_targets")
      .select("*")
      .eq("plan_id", planId)
      .eq("week_number", parseInt(weekNumber!))
      .single();

    if (weekTarget) {
      const session = (weekTarget as WeeklyTarget).sessions.find(
        (s: PlanSession) => s.name === sessionName
      );
      if (session) {
        setPrescribedSession(session);
        setDimension(session.dimension as Dimension);
      }
    }
  }

  async function handleSubmit(overrideRating?: WorkoutRating) {
    const finalRating = overrideRating ?? rating;

    // Validate comment is present for non-3 ratings
    if (finalRating !== 3 && !ratingComment.trim()) {
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("workout_logs").insert({
      user_id: user.id,
      logged_date: new Date().toISOString().split("T")[0],
      dimension,
      completed_as_prescribed: finalRating === 3,
      session_name: sessionName || null,
      notes: notes || null,
      rating_comment: finalRating !== 3 ? ratingComment : null,
      week_number: weekNumber ? parseInt(weekNumber) : null,
      plan_id: planId || null,
      rating: finalRating,
    });

    if (error) {
      console.error("Failed to save workout:", error);
      alert(`Failed to save workout: ${error.message}`);
      setLoading(false);
      return;
    }

    router.refresh();
    router.push(planId ? `/plan?logged=${Date.now()}` : "/dashboard");
    setLoading(false);
  }

  function handleMarkComplete() {
    handleSubmit(3);
  }

  const canSubmit = !requiresComment || ratingComment.trim().length > 0;

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-white">
        {sessionName ? `Log: ${sessionName}` : "Log Workout"}
      </h2>

      {prescribedSession && (
        <div className="bg-dark-card/80 backdrop-blur-sm border border-dark-border/50 rounded-lg p-4">
          <p className="text-sm text-dark-muted italic mb-3">{prescribedSession.objective}</p>
          <button
            onClick={handleMarkComplete}
            disabled={loading}
            className="w-full bg-gold text-dark-bg py-2.5 rounded-lg font-medium hover:bg-gold/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : "Mark Complete as Prescribed"}
          </button>
          <p className="text-xs text-dark-muted text-center mt-2">Or rate your performance and log below</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Rating selector */}
        <div>
          <label className="block text-sm font-medium text-dark-muted mb-2">How did it go?</label>
          <div className="grid grid-cols-5 gap-2">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRating(opt.value)}
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  rating === opt.value
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-dark-border bg-dark-surface text-dark-muted hover:border-dark-muted"
                }`}
              >
                <span className="text-lg font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-dark-muted mt-1.5 text-center">
            {RATING_OPTIONS.find(o => o.value === rating)?.description}
          </p>
        </div>

        {/* Required comment for non-3 ratings */}
        {requiresComment && (
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">
              Tell us what happened <span className="text-burnt-orange">*</span>
            </label>
            <p className="text-xs text-dark-muted mb-1">
              This helps the AI evaluate how relevant your training was to your objective.
            </p>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
              placeholder={
                rating < 3
                  ? "What made it difficult? Did you modify the workout?"
                  : "What extra work did you do? What felt too easy?"
              }
            />
            {!ratingComment.trim() && (
              <p className="text-xs text-burnt-orange mt-1">Required for non-3 ratings</p>
            )}
          </div>
        )}

        {/* Optional notes */}
        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1">Additional notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50" placeholder="Any other details?" />
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={loading || !canSubmit}
          className="w-full bg-gold text-dark-bg py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors"
        >
          {loading ? "Saving..." : "Save Workout Log"}
        </button>
      </div>
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-6"><div className="animate-pulse h-8 bg-dark-border rounded w-1/3" /></div>}>
      <LogForm />
    </Suspense>
  );
}
