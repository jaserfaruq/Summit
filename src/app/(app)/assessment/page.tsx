"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Step = 1 | 2 | 3 | 4 | 5;

export default function AssessmentPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-8 text-dark-muted">Loading...</div>}>
      <AssessmentWizard />
    </Suspense>
  );
}

function AssessmentWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingPlanId = searchParams.get("planId");
  const existingObjectiveId = searchParams.get("objectiveId");
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [longestRunDistance, setLongestRunDistance] = useState("");
  const [longestRunDuration, setLongestRunDuration] = useState("");
  const [weeklyCardioHours, setWeeklyCardioHours] = useState("");
  const [pushupReps, setPushupReps] = useState("");
  const [pullupReps, setPullupReps] = useState("");
  const [squatLevel, setSquatLevel] = useState("beginner");
  const [highestGrade, setHighestGrade] = useState("none");
  const [climbingSkills, setClimbingSkills] = useState<string[]>([]);
  const [exposureComfort, setExposureComfort] = useState(3);
  const [toeTouch, setToeTouch] = useState("");
  const [deepSquat, setDeepSquat] = useState("");
  const [shoulderMobility, setShoulderMobility] = useState("");
  const [hasFlexRoutine, setHasFlexRoutine] = useState(false);

  const [scores, setScores] = useState<{
    cardio: number;
    strength: number;
    climbing: number;
    flexibility: number;
  } | null>(null);

  function calculateScores() {
    const dist = parseFloat(longestRunDistance) || 0;
    const hours = parseFloat(weeklyCardioHours) || 0;
    let cardio = 0;
    if (dist <= 1) cardio = 10;
    else if (dist <= 3) cardio = 20;
    else if (dist <= 5) cardio = 30;
    else if (dist <= 8) cardio = 40;
    else if (dist <= 13) cardio = 55;
    else if (dist <= 20) cardio = 70;
    else cardio = 85;
    if (hours >= 5) cardio = Math.min(cardio + 10, 100);
    else if (hours >= 3) cardio = Math.min(cardio + 5, 100);

    const pushups = parseInt(pushupReps) || 0;
    let strength = 0;
    if (pushups <= 5) strength = 15;
    else if (pushups <= 15) strength = 25;
    else if (pushups <= 30) strength = 40;
    else if (pushups <= 50) strength = 55;
    else strength = 70;
    const squatBonus: Record<string, number> = { beginner: 0, intermediate: 10, advanced: 20, expert: 30 };
    const pullups = parseInt(pullupReps) || 0;
    let pullupBonus = 0;
    if (pullups >= 9) pullupBonus = 15;
    else if (pullups >= 4) pullupBonus = 10;
    else if (pullups >= 1) pullupBonus = 5;
    strength = Math.min(strength + (squatBonus[squatLevel] || 0) + pullupBonus, 100);

    const gradeScores: Record<string, number> = {
      none: 5,
      class_3_4: 20,
      "5.0-5.6": 30,
      "5.7-5.8": 40,
      "5.9-5.10a": 50,
      "5.10b-5.10d": 58,
      "5.11+": 65,
      "5.12+": 72,
    };
    const climbing = Math.min((gradeScores[highestGrade] || 5) + (exposureComfort - 1) * 3, 100);

    const toeTouchScore: Record<string, number> = { yes: 20, barely: 12, no: 5 };
    const deepSquatScore: Record<string, number> = { yes: 20, difficulty: 12, no: 5 };
    const shoulderScore: Record<string, number> = { none: 15, some: 8, significant: 3 };
    let flexibility = (toeTouchScore[toeTouch] || 5) + (deepSquatScore[deepSquat] || 5) + (shoulderScore[shoulderMobility] || 3);
    if (hasFlexRoutine) flexibility = Math.min(flexibility + 15, 100);

    setScores({ cardio, strength, climbing, flexibility });
    setStep(5);
  }

  async function saveAssessment() {
    if (!scores) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newAssessment, error: insertError } = await supabase.from("assessments").insert({
      user_id: user.id,
      cardio_score: scores.cardio,
      strength_score: scores.strength,
      climbing_score: scores.climbing,
      flexibility_score: scores.flexibility,
      raw_data: {
        cardio: { longest_zone2_distance_miles: parseFloat(longestRunDistance) || 0, longest_zone2_duration_min: parseFloat(longestRunDuration) || 0, weekly_cardio_hours: parseFloat(weeklyCardioHours) || 0 },
        strength: { pushup_reps: parseInt(pushupReps) || 0, pullup_reps: parseInt(pullupReps) || 0, squat_reps_or_level: squatLevel },
        climbing: { highest_grade: highestGrade, skills: climbingSkills, exposure_comfort: exposureComfort },
        flexibility: { toe_touch: toeTouch, deep_squat: deepSquat, shoulder_mobility: shoulderMobility, regular_routine: hasFlexRoutine },
      },
    }).select().single();

    if (insertError || !newAssessment) {
      setError(insertError?.message || "Failed to save assessment");
      setLoading(false);
      return;
    }

    // If we came from a plan, delete the old plan and regenerate with new scores
    if (existingPlanId && existingObjectiveId) {
      try {
        // Delete existing plan
        const deleteRes = await fetch("/api/delete-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: existingPlanId }),
        });

        if (!deleteRes.ok) {
          const data = await deleteRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to delete old plan");
        }

        // Generate new plan with the new assessment
        const genRes = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectiveId: existingObjectiveId,
            assessmentId: newAssessment.id,
          }),
        });

        if (!genRes.ok) {
          const data = await genRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to generate new plan");
        }
      } catch (err) {
        console.error("Error regenerating plan:", err);
        setError(err instanceof Error ? err.message : "Failed to regenerate plan");
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
  }

  const stepTitles = ["", "Cardio", "Strength", "Climbing / Technical", "Flexibility", "Summary"];

  const inputClass = "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50";

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gold">
            Step {Math.min(step, 4)} of 4: {stepTitles[step]}
          </span>
          <span className="text-sm text-dark-muted">~5 min</span>
        </div>
        <div className="w-full bg-dark-border rounded-full h-2">
          <div
            className="bg-gold rounded-full h-2 transition-all"
            style={{ width: `${(Math.min(step, 4) / 4) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Cardio Assessment</h2>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Longest Zone 2 run/hike distance (miles)</label>
            <p className="text-xs text-dark-muted mb-2">Zone 2 = conversational pace, nose-breathing</p>
            <input type="number" step="0.1" value={longestRunDistance} onChange={(e) => setLongestRunDistance(e.target.value)} className={inputClass} placeholder="e.g., 6.5" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Duration of that effort (minutes)</label>
            <input type="number" value={longestRunDuration} onChange={(e) => setLongestRunDuration(e.target.value)} className={inputClass} placeholder="e.g., 75" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Weekly cardio hours (average)</label>
            <input type="number" step="0.5" value={weeklyCardioHours} onChange={(e) => setWeeklyCardioHours(e.target.value)} className={inputClass} placeholder="e.g., 3.5" />
          </div>
          <button onClick={() => setStep(2)} className="w-full bg-gold text-dark-bg py-2.5 rounded-lg font-medium hover:bg-gold/90 transition-colors">
            Next: Strength →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Strength Assessment</h2>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Max push-ups in one set</label>
            <input type="number" value={pushupReps} onChange={(e) => setPushupReps(e.target.value)} className={inputClass} placeholder="e.g., 25" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Max pull-ups in one set</label>
            <p className="text-xs text-dark-muted mb-2">Strict pull-ups, full hang to chin over bar. Enter 0 if none.</p>
            <input type="number" value={pullupReps} onChange={(e) => setPullupReps(e.target.value)} className={inputClass} placeholder="e.g., 8" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Squat experience level</label>
            <select value={squatLevel} onChange={(e) => setSquatLevel(e.target.value)} className={inputClass}>
              <option value="beginner">Beginner (bodyweight only)</option>
              <option value="intermediate">Intermediate (squat bodyweight)</option>
              <option value="advanced">Advanced (squat 1.5x bodyweight)</option>
              <option value="expert">Expert (squat 2x+ bodyweight)</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-card transition-colors">← Back</button>
            <button onClick={() => setStep(3)} className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium hover:bg-gold/90 transition-colors">Next: Climbing →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Climbing / Technical</h2>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Highest climbing grade</label>
            <select value={highestGrade} onChange={(e) => setHighestGrade(e.target.value)} className={inputClass}>
              <option value="none">None / no climbing experience</option>
              <option value="class_3_4">Class 3–4 scrambling</option>
              <option value="5.0-5.6">5.0–5.6 (easy roped climbing)</option>
              <option value="5.7-5.8">5.7–5.8 (moderate)</option>
              <option value="5.9-5.10a">5.9–5.10a (intermediate)</option>
              <option value="5.10b-5.10d">5.10b–5.10d (upper intermediate)</option>
              <option value="5.11+">5.11+ (advanced)</option>
              <option value="5.12+">5.12+ (expert)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">Skills &amp; experience (check all that apply)</label>
            <p className="text-xs text-dark-muted mb-2">These help tailor your training plan to focus on skills you need to develop.</p>
            <div className="space-y-2">
              {[
                { id: "indoor_gym", label: "Indoor / gym climbing (top-rope or bouldering)" },
                { id: "outdoor_sport", label: "Outdoor sport climbing (including leading)" },
                { id: "trad", label: "Trad climbing (placing own gear)" },
                { id: "multi_pitch", label: "Multi-pitch climbing" },
                { id: "glacier", label: "Glacier travel (crampon & ice axe)" },
                { id: "crevasse_rescue", label: "Crevasse rescue / rope team skills" },
              ].map((skill) => (
                <label key={skill.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={climbingSkills.includes(skill.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setClimbingSkills([...climbingSkills, skill.id]);
                      } else {
                        setClimbingSkills(climbingSkills.filter((s) => s !== skill.id));
                      }
                    }}
                    className="accent-gold w-4 h-4"
                  />
                  <span className="text-sm text-dark-text">{skill.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">Comfort on exposure (1–5)</label>
            <p className="text-xs text-dark-muted mb-2">1 = very uncomfortable, 5 = very confident</p>
            <input type="range" min="1" max="5" value={exposureComfort} onChange={(e) => setExposureComfort(parseInt(e.target.value))} className="w-full accent-gold" />
            <div className="flex justify-between text-xs text-dark-muted"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-card transition-colors">← Back</button>
            <button onClick={() => setStep(4)} className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium hover:bg-gold/90 transition-colors">Next: Flexibility →</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Flexibility &amp; Mobility</h2>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">Can you touch your toes with straight legs?</label>
            <div className="flex gap-2">
              {[
                { value: "yes", label: "Yes, easily" },
                { value: "barely", label: "Barely" },
                { value: "no", label: "No" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setToeTouch(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    toeTouch === opt.value
                      ? "bg-gold/20 border-gold text-gold"
                      : "border-dark-border text-dark-muted hover:border-dark-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">Can you hold a deep squat (heels flat) for 30 seconds?</label>
            <div className="flex gap-2">
              {[
                { value: "yes", label: "Yes, easily" },
                { value: "difficulty", label: "With difficulty" },
                { value: "no", label: "No" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDeepSquat(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    deepSquat === opt.value
                      ? "bg-gold/20 border-gold text-gold"
                      : "border-dark-border text-dark-muted hover:border-dark-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-2">Do you have shoulder mobility limitations?</label>
            <div className="flex gap-2">
              {[
                { value: "none", label: "None" },
                { value: "some", label: "Some" },
                { value: "significant", label: "Significant" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setShoulderMobility(opt.value)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    shoulderMobility === opt.value
                      ? "bg-gold/20 border-gold text-gold"
                      : "border-dark-border text-dark-muted hover:border-dark-text"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="flexRoutine" checked={hasFlexRoutine} onChange={(e) => setHasFlexRoutine(e.target.checked)} className="accent-gold w-4 h-4" />
            <label htmlFor="flexRoutine" className="text-sm text-dark-text">I have a regular stretching/mobility routine</label>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-card transition-colors">← Back</button>
            <button onClick={calculateScores} className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium hover:bg-gold/90 transition-colors">See Results →</button>
          </div>
        </div>
      )}

      {step === 5 && scores && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Assessment Results</h2>
          <div className="bg-test-blue/20 border border-test-blue/30 text-blue-300 px-4 py-3 rounded-lg text-sm">
            These are estimated scores. They&apos;ll be calibrated when you complete your first benchmark test week.
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Cardio", score: scores.cardio },
              { label: "Strength", score: scores.strength },
              { label: "Climbing", score: scores.climbing },
              { label: "Flexibility", score: scores.flexibility },
            ].map((dim) => (
              <div key={dim.label} className="bg-dark-card/80 backdrop-blur-sm rounded-xl p-4 border border-dark-border/50 text-center">
                <div className="text-3xl font-bold text-gold">{dim.score}</div>
                <div className="text-sm text-dark-muted mt-1">{dim.label}</div>
                <div className="w-full bg-dark-border rounded-full h-2 mt-2">
                  <div className="bg-gold rounded-full h-2 transition-all" style={{ width: `${dim.score}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-card transition-colors">← Adjust</button>
            <button onClick={saveAssessment} disabled={loading} className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors">
              {loading ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
