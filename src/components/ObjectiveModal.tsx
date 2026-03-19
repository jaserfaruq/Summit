"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
        onSaved();
      } else {
        const { data: newObj } = await supabase.from("objectives").insert({
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
        }).select("id").single();

        if (!newObj) throw new Error("Failed to create objective");

        // Fetch latest assessment to auto-generate a plan
        const { data: assessments } = await supabase
          .from("assessments")
          .select("id")
          .eq("user_id", user.id)
          .order("assessed_at", { ascending: false })
          .limit(1);

        const latestAssessment = assessments?.[0];
        if (latestAssessment) {
          router.push(`/plan?generate=true&objectiveId=${newObj.id}&assessmentId=${latestAssessment.id}`);
        } else {
          onSaved();
        }
      }
    } catch {
      setError("Failed to save objective");
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!objective) return;
    const supabase = createClient();

    // Delete associated plan and weekly targets first (V1: objective and plan are linked 1:1)
    const { data: plans } = await supabase
      .from("training_plans")
      .select("id")
      .eq("objective_id", objective.id);

    if (plans) {
      for (const plan of plans) {
        await supabase.from("weekly_targets").delete().eq("plan_id", plan.id);
        await supabase.from("training_plans").delete().eq("id", plan.id);
      }
    }

    await supabase.from("score_history").delete().eq("objective_id", objective.id);
    await supabase.from("objectives").delete().eq("id", objective.id);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-card rounded-xl shadow-xl border border-dark-border max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              {objective ? "Edit Objective" : "New Objective"}
            </h3>
            <button onClick={onClose} className="text-dark-muted hover:text-white text-xl">
              ×
            </button>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "form" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Objective Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                  placeholder="e.g., Mont Blanc, Half Dome"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ObjectiveType)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                >
                  {OBJECTIVE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">Distance (miles)</label>
                  <input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-muted mb-1">Elevation Gain (ft)</label>
                  <input
                    type="number"
                    value={elevation}
                    onChange={(e) => setElevation(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Technical Grade (optional)</label>
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                  placeholder="e.g., 5.7, Class 3, PD"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleMatch}
                  disabled={!name || !targetDate || loading}
                  className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors"
                >
                  {loading ? "Matching..." : "Find & Save"}
                </button>
                {objective && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2.5 text-red-400 border border-red-800 rounded-lg hover:bg-red-900/30 transition-colors"
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
                    ? "bg-gold/20 text-gold"
                    : matchResult.tier === "silver"
                    ? "bg-white/10 text-white/70"
                    : "bg-burnt-orange/20 text-burnt-orange"
                }`}>
                  {matchResult.tier.toUpperCase()} Tier
                </span>
              </div>

              {matchResult.tier === "gold" && matchResult.validatedObjective && (
                <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
                  <p className="font-semibold text-white">{matchResult.validatedObjective.name}</p>
                  <p className="text-sm text-dark-muted">{matchResult.validatedObjective.route}</p>
                  <p className="text-sm text-dark-muted mt-1">{matchResult.validatedObjective.description}</p>
                </div>
              )}

              {matchResult.tier === "silver" && matchResult.anchors.length > 0 && (
                <div className="bg-dark-surface border border-dark-border rounded-lg p-4">
                  <p className="text-sm text-dark-muted mb-2">
                    Similar objectives found. Scores will be AI-estimated using these as calibration anchors:
                  </p>
                  <ul className="text-sm text-dark-text space-y-1">
                    {matchResult.anchors.map((a) => (
                      <li key={a.id}>• {a.name} ({a.route})</li>
                    ))}
                  </ul>
                </div>
              )}

              {matchResult.tier === "bronze" && (
                <div className="bg-burnt-orange/10 border border-burnt-orange/30 rounded-lg p-4">
                  <p className="text-sm text-dark-muted">
                    No similar objectives found. Target scores will be fully AI-estimated.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 bg-gold text-dark-bg py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors"
                >
                  {loading ? "Saving..." : "Confirm & Save"}
                </button>
                <button
                  onClick={() => setStep("form")}
                  className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-surface transition-colors"
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
