"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Dimension, PlanSession, WeeklyTarget, WorkoutRating } from "@/lib/types";

const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "cardio", label: "Cardio" },
  { value: "strength", label: "Strength" },
  { value: "climbing_technical", label: "Climbing / Technical" },
  { value: "flexibility", label: "Flexibility" },
];

const RATING_OPTIONS: { value: WorkoutRating; label: string; description: string }[] = [
  { value: 1, label: "1", description: "Way too hard — couldn't complete" },
  { value: 2, label: "2", description: "Struggled — barely finished" },
  { value: 3, label: "3", description: "Just right — good challenge" },
  { value: 4, label: "4", description: "Slightly easy — could do more" },
  { value: 5, label: "5", description: "Way too easy — need harder work" },
];

const inputClass = "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50";

function LogForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionName = searchParams.get("session");
  const planId = searchParams.get("planId");
  const weekNumber = searchParams.get("week");

  const [dimension, setDimension] = useState<Dimension>("cardio");
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<WorkoutRating>(3);
  const [loading, setLoading] = useState(false);
  const [prescribedSession, setPrescribedSession] = useState<PlanSession | null>(null);

  const [activityType, setActivityType] = useState("run");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");
  const [exercises, setExercises] = useState<{ name: string; sets: string; reps: string; weight: string }[]>([
    { name: "", sets: "", reps: "", weight: "" },
  ]);
  const [climbType, setClimbType] = useState("sport");
  const [climbGrade, setClimbGrade] = useState("");
  const [pitches, setPitches] = useState("");
  const [routineName, setRoutineName] = useState("");
  const [bodyAreas, setBodyAreas] = useState("");

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
        setDurationMin(session.estimatedMinutes.toString());
      }
    }
  }

  function addExercise() {
    setExercises([...exercises, { name: "", sets: "", reps: "", weight: "" }]);
  }

  function updateExercise(index: number, field: string, value: string) {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  }

  async function handleSubmit(overrideRating?: WorkoutRating) {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const details: Record<string, unknown> = {};
    if (dimension === "cardio") {
      details.activity = activityType;
      details.distance = cardioDistance;
      details.elevation = cardioElevation;
    } else if (dimension === "strength") {
      details.exercises = exercises.filter((e) => e.name);
    } else if (dimension === "climbing_technical") {
      details.type = climbType;
      details.grade = climbGrade;
      details.pitches = pitches;
    } else if (dimension === "flexibility") {
      details.routine = routineName;
      details.bodyAreas = bodyAreas;
    }

    const finalRating = overrideRating ?? rating;

    await supabase.from("workout_logs").insert({
      user_id: user.id,
      logged_date: new Date().toISOString().split("T")[0],
      dimension,
      duration_min: parseInt(durationMin) || null,
      details,
      completed_as_prescribed: finalRating === 3,
      session_name: sessionName || null,
      notes: notes || null,
      week_number: weekNumber ? parseInt(weekNumber) : null,
      plan_id: planId || null,
      rating: finalRating,
    });

    router.push(planId ? "/plan" : "/dashboard");
    setLoading(false);
  }

  function handleMarkComplete() {
    // Mark complete = rated 3 (as prescribed, right challenge)
    handleSubmit(3);
  }

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

        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1">Dimension</label>
          <select value={dimension} onChange={(e) => setDimension(e.target.value as Dimension)} className={inputClass}>
            {DIMENSIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1">Duration (minutes)</label>
          <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} className={inputClass} />
        </div>

        {dimension === "cardio" && (
          <div className="space-y-3">
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className={inputClass}>
              <option value="run">Run</option>
              <option value="hike">Hike</option>
              <option value="bike">Bike</option>
              <option value="swim">Swim</option>
              <option value="other">Other</option>
            </select>
            <input type="number" step="0.1" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} className={inputClass} placeholder="Distance (miles)" />
            <input type="number" value={cardioElevation} onChange={(e) => setCardioElevation(e.target.value)} className={inputClass} placeholder="Elevation gain (ft)" />
          </div>
        )}

        {dimension === "strength" && (
          <div className="space-y-3">
            {exercises.map((ex, i) => (
              <div key={i} className="grid grid-cols-4 gap-2">
                <input value={ex.name} onChange={(e) => updateExercise(i, "name", e.target.value)} className={`col-span-2 px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:ring-2 focus:ring-gold/50`} placeholder="Exercise" />
                <input value={ex.sets} onChange={(e) => updateExercise(i, "sets", e.target.value)} className={`px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:ring-2 focus:ring-gold/50`} placeholder="Sets" />
                <input value={ex.reps} onChange={(e) => updateExercise(i, "reps", e.target.value)} className={`px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:ring-2 focus:ring-gold/50`} placeholder="Reps" />
              </div>
            ))}
            <button onClick={addExercise} className="text-sm text-gold font-medium hover:underline">+ Add Exercise</button>
          </div>
        )}

        {dimension === "climbing_technical" && (
          <div className="space-y-3">
            <select value={climbType} onChange={(e) => setClimbType(e.target.value)} className={inputClass}>
              <option value="sport">Sport</option>
              <option value="trad">Trad</option>
              <option value="boulder">Bouldering</option>
              <option value="alpine">Alpine</option>
              <option value="gym">Gym</option>
            </select>
            <input value={climbGrade} onChange={(e) => setClimbGrade(e.target.value)} className={inputClass} placeholder="Grade (e.g., 5.10a)" />
            <input type="number" value={pitches} onChange={(e) => setPitches(e.target.value)} className={inputClass} placeholder="Pitches" />
          </div>
        )}

        {dimension === "flexibility" && (
          <div className="space-y-3">
            <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} className={inputClass} placeholder="Routine name" />
            <input value={bodyAreas} onChange={(e) => setBodyAreas(e.target.value)} className={inputClass} placeholder="Body areas worked (e.g., hips, shoulders)" />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-dark-muted mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="How did it feel? Any modifications?" />
        </div>

        <button
          onClick={() => handleSubmit()}
          disabled={loading}
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
