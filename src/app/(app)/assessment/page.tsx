"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

type Step = 1 | 2 | 3 | 4 | 5;

export default function AssessmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cardio fields
  const [longestRunDistance, setLongestRunDistance] = useState("");
  const [longestRunDuration, setLongestRunDuration] = useState("");
  const [weeklyCardioHours, setWeeklyCardioHours] = useState("");

  // Strength fields
  const [pushupReps, setPushupReps] = useState("");
  const [squatLevel, setSquatLevel] = useState("beginner");

  // Climbing fields
  const [highestGrade, setHighestGrade] = useState("");
  const [climbingExperience, setClimbingExperience] = useState("none");
  const [exposureComfort, setExposureComfort] = useState(3);

  // Flexibility fields
  const [hipTightness, setHipTightness] = useState(3);
  const [ankleMobility, setAnkleMobility] = useState(3);
  const [hasFlexRoutine, setHasFlexRoutine] = useState(false);

  // Calculated scores
  const [scores, setScores] = useState<{
    cardio: number;
    strength: number;
    climbing: number;
    flexibility: number;
  } | null>(null);

  function calculateScores() {
    // Cardio: based on longest zone 2 distance and weekly hours
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

    // Strength
    const pushups = parseInt(pushupReps) || 0;
    let strength = 0;
    if (pushups <= 5) strength = 15;
    else if (pushups <= 15) strength = 25;
    else if (pushups <= 30) strength = 40;
    else if (pushups <= 50) strength = 55;
    else strength = 70;
    const squatBonus: Record<string, number> = {
      beginner: 0,
      intermediate: 10,
      advanced: 20,
      expert: 30,
    };
    strength = Math.min(strength + (squatBonus[squatLevel] || 0), 100);

    // Climbing
    let climbing = 0;
    const expMap: Record<string, number> = {
      none: 5,
      beginner: 15,
      sport_only: 30,
      trad_beginner: 40,
      trad_intermediate: 55,
      alpine: 70,
    };
    climbing = expMap[climbingExperience] || 5;
    climbing = Math.min(climbing + (exposureComfort - 1) * 3, 100);

    // Flexibility
    const hipScore = (6 - hipTightness) * 10; // lower tightness = higher score
    const ankleScore = ankleMobility * 10;
    let flexibility = Math.round((hipScore + ankleScore) / 2);
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

    const { error: insertError } = await supabase.from("assessments").insert({
      user_id: user.id,
      cardio_score: scores.cardio,
      strength_score: scores.strength,
      climbing_score: scores.climbing,
      flexibility_score: scores.flexibility,
      raw_data: {
        cardio: {
          longest_zone2_distance_miles: parseFloat(longestRunDistance) || 0,
          longest_zone2_duration_min: parseFloat(longestRunDuration) || 0,
          weekly_cardio_hours: parseFloat(weeklyCardioHours) || 0,
        },
        strength: {
          pushup_reps: parseInt(pushupReps) || 0,
          squat_reps_or_level: squatLevel,
        },
        climbing: {
          highest_grade: highestGrade,
          experience_level: climbingExperience,
          exposure_comfort: exposureComfort,
        },
        flexibility: {
          hip_tightness: hipTightness,
          ankle_mobility: ankleMobility,
          regular_routine: hasFlexRoutine,
        },
      },
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  const stepTitles = ["", "Cardio", "Strength", "Climbing / Technical", "Flexibility", "Summary"];

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-forest">
            Step {Math.min(step, 4)} of 4: {stepTitles[step]}
          </span>
          <span className="text-sm text-sage">~5 min</span>
        </div>
        <div className="w-full bg-sage/20 rounded-full h-2">
          <div
            className="bg-forest rounded-full h-2 transition-all"
            style={{ width: `${(Math.min(step, 4) / 4) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Cardio */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-forest">Cardio Assessment</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longest Zone 2 run/hike distance (miles)
            </label>
            <p className="text-xs text-sage mb-2">Zone 2 = conversational pace, nose-breathing</p>
            <input
              type="number"
              step="0.1"
              value={longestRunDistance}
              onChange={(e) => setLongestRunDistance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., 6.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration of that effort (minutes)
            </label>
            <input
              type="number"
              value={longestRunDuration}
              onChange={(e) => setLongestRunDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., 75"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weekly cardio hours (average)
            </label>
            <input
              type="number"
              step="0.5"
              value={weeklyCardioHours}
              onChange={(e) => setWeeklyCardioHours(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., 3.5"
            />
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-forest text-white py-2.5 rounded-lg font-medium hover:bg-forest/90 transition-colors"
          >
            Next: Strength →
          </button>
        </div>
      )}

      {/* Step 2: Strength */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-forest">Strength Assessment</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max push-ups in one set
            </label>
            <input
              type="number"
              value={pushupReps}
              onChange={(e) => setPushupReps(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., 25"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Squat experience level
            </label>
            <select
              value={squatLevel}
              onChange={(e) => setSquatLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
            >
              <option value="beginner">Beginner (bodyweight only)</option>
              <option value="intermediate">Intermediate (squat bodyweight)</option>
              <option value="advanced">Advanced (squat 1.5x bodyweight)</option>
              <option value="expert">Expert (squat 2x+ bodyweight)</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-forest text-white py-2.5 rounded-lg font-medium hover:bg-forest/90 transition-colors"
            >
              Next: Climbing →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Climbing */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-forest">Climbing / Technical</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Highest climbing grade (optional)
            </label>
            <input
              value={highestGrade}
              onChange={(e) => setHighestGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
              placeholder="e.g., 5.10a, V4, WI3"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Climbing experience level
            </label>
            <select
              value={climbingExperience}
              onChange={(e) => setClimbingExperience(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
            >
              <option value="none">None</option>
              <option value="beginner">Beginner (gym only, &lt;1 year)</option>
              <option value="sport_only">Sport climbing (outdoor experience)</option>
              <option value="trad_beginner">Trad beginner</option>
              <option value="trad_intermediate">Trad intermediate</option>
              <option value="alpine">Alpine climbing experience</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comfort on exposure (1–5)
            </label>
            <p className="text-xs text-sage mb-2">1 = very uncomfortable, 5 = very confident</p>
            <input
              type="range"
              min="1"
              max="5"
              value={exposureComfort}
              onChange={(e) => setExposureComfort(parseInt(e.target.value))}
              className="w-full accent-forest"
            />
            <div className="flex justify-between text-xs text-sage">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="flex-1 bg-forest text-white py-2.5 rounded-lg font-medium hover:bg-forest/90 transition-colors"
            >
              Next: Flexibility →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Flexibility */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-forest">Flexibility</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hip tightness (1–5)
            </label>
            <p className="text-xs text-sage mb-2">1 = very loose, 5 = very tight</p>
            <input
              type="range"
              min="1"
              max="5"
              value={hipTightness}
              onChange={(e) => setHipTightness(parseInt(e.target.value))}
              className="w-full accent-forest"
            />
            <div className="flex justify-between text-xs text-sage">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ankle mobility (1–5)
            </label>
            <p className="text-xs text-sage mb-2">1 = very limited, 5 = full range</p>
            <input
              type="range"
              min="1"
              max="5"
              value={ankleMobility}
              onChange={(e) => setAnkleMobility(parseInt(e.target.value))}
              className="w-full accent-forest"
            />
            <div className="flex justify-between text-xs text-sage">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="flexRoutine"
              checked={hasFlexRoutine}
              onChange={(e) => setHasFlexRoutine(e.target.checked)}
              className="accent-forest"
            />
            <label htmlFor="flexRoutine" className="text-sm text-gray-700">
              I have a regular stretching/mobility routine
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={calculateScores}
              className="flex-1 bg-forest text-white py-2.5 rounded-lg font-medium hover:bg-forest/90 transition-colors"
            >
              See Results →
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Summary */}
      {step === 5 && scores && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-forest">Assessment Results</h2>
          <div className="bg-test-blue/10 border border-test-blue/20 text-test-blue px-4 py-3 rounded-lg text-sm">
            These are estimated scores. They&apos;ll be calibrated when you complete your first benchmark test week.
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Cardio", score: scores.cardio },
              { label: "Strength", score: scores.strength },
              { label: "Climbing", score: scores.climbing },
              { label: "Flexibility", score: scores.flexibility },
            ].map((dim) => (
              <div key={dim.label} className="bg-white rounded-xl p-4 shadow-sm border border-sage/20 text-center">
                <div className="text-3xl font-bold text-forest">{dim.score}</div>
                <div className="text-sm text-sage mt-1">{dim.label}</div>
                <div className="w-full bg-sage/20 rounded-full h-2 mt-2">
                  <div
                    className="bg-forest rounded-full h-2 transition-all"
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Adjust
            </button>
            <button
              onClick={saveAssessment}
              disabled={loading}
              className="flex-1 bg-burnt-orange text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-burnt-orange/90 transition-colors"
            >
              {loading ? "Saving..." : "Save Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
