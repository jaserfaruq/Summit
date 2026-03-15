"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Objective, ObjectiveType, MatchObjectiveResponse, EstimateScoresResponse, DimensionGraduationBenchmarks, DimensionScores, DimensionTaglines, DimensionRelevanceProfiles } from "@/lib/types";

const OBJECTIVE_TYPES: { value: ObjectiveType; label: string }[] = [
  { value: "hike", label: "Hike" },
  { value: "trail_run", label: "Trail Run" },
  { value: "alpine_climb", label: "Alpine Climb" },
  { value: "rock_climb", label: "Rock Climb" },
  { value: "mountaineering", label: "Mountaineering" },
  { value: "scramble", label: "Scramble" },
  { value: "backpacking", label: "Backpacking" },
];

export default function ObjectiveModal({
  date,
  objective,
  onClose,
  onSaved,
}: {
  date: string | null;
  objective: Objective | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(objective?.name || "");
  const [type, setType] = useState<ObjectiveType>(objective?.type || "hike");
  const [targetDate, setTargetDate] = useState(objective?.target_date || date || "");
  const [distance, setDistance] = useState(objective?.distance_miles?.toString() || "");
  const [elevation, setElevation] = useState(objective?.elevation_gain_ft?.toString() || "");
  const [grade, setGrade] = useState(objective?.technical_grade || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchObjectiveResponse | null>(null);
  const [step, setStep] = useState<"form" | "matching" | "confirm">("form");

  async function handleMatch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/match-objective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, route: name }),
      });
      const data: MatchObjectiveResponse = await res.json();
      setMatchResult(data);
      setStep("confirm");
    } catch {
      setError("Failed to match objective");
    }
    setLoading(false);
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      let targetScores: DimensionScores = { cardio: 50, strength: 50, climbing_technical: 25, flexibility: 30 };
      let taglines: DimensionTaglines = { cardio: "", strength: "", climbing_technical: "", flexibility: "" };
      let relevanceProfiles: DimensionRelevanceProfiles | Record<string, never> = {};
      let graduationBenchmarks: DimensionGraduationBenchmarks = { cardio: [], strength: [], climbing_technical: [], flexibility: [] };
      let matchedId = null;
      const tier = matchResult?.tier || "bronze";

      if (matchResult?.tier === "gold" && matchResult.validatedObjective) {
        const vo = matchResult.validatedObjective;
        targetScores = vo.target_scores;
        taglines = vo.taglines;
        relevanceProfiles = vo.relevance_profiles;
        graduationBenchmarks = vo.graduation_benchmarks;
        matchedId = vo.id;
      } else if (matchResult?.tier === "silver" || matchResult?.tier === "bronze") {
        // Call estimate-scores API
        const { data: benchmarks } = await supabase
          .from("benchmark_exercises")
          .select("*")
          .eq("status", "active");

        const res = await fetch("/api/estimate-scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectiveDetails: {
              name,
              type,
              elevation: elevation ? parseInt(elevation) : undefined,
              totalGain: elevation ? parseInt(elevation) : undefined,
              distance: distance ? parseFloat(distance) : undefined,
              grade,
            },
            benchmarkExercises: benchmarks || [],
            anchors: matchResult?.anchors || [],
          }),
        });
        const estimates: EstimateScoresResponse = await res.json();
        targetScores = {
          cardio: estimates.dimensions.cardio.targetScore,
          strength: estimates.dimensions.strength.targetScore,
          climbing_technical: estimates.dimensions.climbing_technical.targetScore,
          flexibility: estimates.dimensions.flexibility.targetScore,
        };
        taglines = {
          cardio: estimates.dimensions.cardio.tagline,
          strength: estimates.dimensions.strength.tagline,
          climbing_technical: estimates.dimensions.climbing_technical.tagline,
          flexibility: estimates.dimensions.flexibility.tagline,
        };
        relevanceProfiles = estimates.relevanceProfiles;
        graduationBenchmarks = estimates.graduationBenchmarks;
      }

      if (objective) {
        // Update existing
        await supabase
          .from("objectives")
          .update({
            name,
            type,
            target_date: targetDate,
            distance_miles: distance ? parseFloat(distance) : null,
            elevation_gain_ft: elevation ? parseFloat(elevation) : null,
            technical_grade: grade || null,
            target_cardio_score: targetScores.cardio,
            target_strength_score: targetScores.strength,
            target_climbing_score: targetScores.climbing_technical,
            target_flexibility_score: targetScores.flexibility,
            taglines,
            relevance_profiles: relevanceProfiles,
            graduation_benchmarks: graduationBenchmarks,
            matched_validated_id: matchedId,
            tier,
          })
          .eq("id", objective.id);
      } else {
        // Insert new
        await supabase.from("objectives").insert({
          user_id: user.id,
          name,
          type,
          target_date: targetDate,
          distance_miles: distance ? parseFloat(distance) : null,
          elevation_gain_ft: elevation ? parseFloat(elevation) : null,
          technical_grade: grade || null,
          target_cardio_score: targetScores.cardio,
          target_strength_score: targetScores.strength,
          target_climbing_score: targetScores.climbing_technical,
          target_flexibility_score: targetScores.flexibility,
          taglines,
          relevance_profiles: relevanceProfiles,
          graduation_benchmarks: graduationBenchmarks,
          matched_validated_id: matchedId,
          tier,
        });
      }

      onSaved();
    } catch {
      setError("Failed to save objective");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!objective) return;
    const supabase = createClient();
    await supabase.from("objectives").delete().eq("id", objective.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-forest">
              {objective ? "Edit Objective" : "New Objective"}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
              ×
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "form" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objective Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                  placeholder="e.g., Mont Blanc, Half Dome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ObjectiveType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                >
                  {OBJECTIVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Elevation Gain (ft)</label>
                  <input
                    type="number"
                    value={elevation}
                    onChange={(e) => setElevation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technical Grade (optional)</label>
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest focus:border-transparent"
                  placeholder="e.g., 5.7, Class 3, PD"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleMatch}
                  disabled={!name || !targetDate || loading}
                  className="flex-1 bg-forest text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-forest/90 transition-colors"
                >
                  {loading ? "Matching..." : "Find & Save"}
                </button>
                {objective && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "confirm" && matchResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-sm font-bold rounded ${
                  matchResult.tier === "gold"
                    ? "bg-yellow-100 text-yellow-800"
                    : matchResult.tier === "silver"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-orange-100 text-orange-800"
                }`}>
                  {matchResult.tier.toUpperCase()} Tier
                </span>
              </div>

              {matchResult.tier === "gold" && matchResult.validatedObjective && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="font-semibold">{matchResult.validatedObjective.name}</p>
                  <p className="text-sm text-gray-600">{matchResult.validatedObjective.route}</p>
                  <p className="text-sm text-gray-500 mt-1">{matchResult.validatedObjective.description}</p>
                </div>
              )}

              {matchResult.tier === "silver" && matchResult.anchors.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Similar objectives found. Scores will be AI-estimated using these as calibration anchors:
                  </p>
                  <ul className="text-sm space-y-1">
                    {matchResult.anchors.map((a) => (
                      <li key={a.id}>• {a.name} ({a.route})</li>
                    ))}
                  </ul>
                </div>
              )}

              {matchResult.tier === "bronze" && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    No similar objectives found. Target scores will be fully AI-estimated.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-burnt-orange text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-burnt-orange/90 transition-colors"
                >
                  {loading ? "Saving..." : "Confirm & Save"}
                </button>
                <button
                  onClick={() => setStep("form")}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
