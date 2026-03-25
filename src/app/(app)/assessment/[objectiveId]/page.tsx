"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { AIQuestion, DimensionScores, AIReasoning, ProgrammingHints } from "@/lib/types";
import InfoBubble from "@/components/InfoBubble";

type Phase = "layer1" | "layer2" | "scoring" | "results";

interface StandardAnswers {
  training_days_per_week: number;
  longest_cardio_distance_miles: number;
  longest_cardio_duration_min: number;
  longest_cardio_elevation_gain_ft: number;
  strength_training_frequency: string;
  strength_training_type: string;
  climbing_experience_level: string;
  climbing_highest_grade: string;
  climbing_skills: string[];
  flexibility_hip_tightness: number;
  flexibility_ankle_mobility: number;
  flexibility_regular_routine: boolean;
}

interface ScoreResults {
  assessmentId: string;
  scores: DimensionScores;
  reasoning: AIReasoning;
  programmingHints: ProgrammingHints;
  adjustedTargets?: DimensionScores;
  climbingRole?: string;
}

export default function AssessmentObjectivePage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-8"><div className="animate-pulse h-8 bg-dark-border rounded w-1/3" /></div>}>
      <AssessmentContent />
    </Suspense>
  );
}

function AssessmentContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const objectiveId = params.objectiveId as string;
  const viewResults = searchParams.get("view") === "results";

  const [phase, setPhase] = useState<Phase>(viewResults ? "results" : "layer1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectiveName, setObjectiveName] = useState("");

  // Layer 1: Standard answers
  const [trainingDays, setTrainingDays] = useState(5);
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");
  const [strengthFrequency, setStrengthFrequency] = useState("1-2x/week");
  const [strengthType, setStrengthType] = useState("general");
  const [climbingLevel, setClimbingLevel] = useState("none");
  const [climbingGrade, setClimbingGrade] = useState("none");
  const [climbingSkills, setClimbingSkills] = useState<string[]>([]);
  const [hipTightness, setHipTightness] = useState(3);
  const [ankleMobility, setAnkleMobility] = useState(3);
  const [hasFlexRoutine, setHasFlexRoutine] = useState(false);

  // Layer 2: AI questions and answers
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [aiAnswers, setAiAnswers] = useState<Record<string, string | number>>({});
  const [freeformText, setFreeformText] = useState("");
  const [moreQuestionsLoading, setMoreQuestionsLoading] = useState(false);

  // Results
  const [results, setResults] = useState<ScoreResults | null>(null);

  // Fetch objective name on mount, and load existing assessment if deep-linking to results
  useEffect(() => {
    async function fetchObjective() {
      try {
        const { createClient } = await import("@/lib/supabase");
        const supabase = createClient();
        const { data: objData } = await supabase
          .from("objectives")
          .select("name, target_cardio_score, target_strength_score, target_climbing_score, target_flexibility_score")
          .eq("id", objectiveId)
          .single();
        if (objData) setObjectiveName(objData.name);

        // If deep-linking to results, load the most recent assessment
        if (viewResults && objData) {
          const { data: assessmentData } = await supabase
            .from("assessments")
            .select("*")
            .eq("objective_id", objectiveId)
            .order("assessed_at", { ascending: false })
            .limit(1)
            .single();

          if (assessmentData) {
            setResults({
              assessmentId: assessmentData.id,
              scores: {
                cardio: assessmentData.cardio_score,
                strength: assessmentData.strength_score,
                climbing_technical: assessmentData.climbing_score,
                flexibility: assessmentData.flexibility_score,
              },
              reasoning: assessmentData.ai_reasoning || {
                cardio: { explanation: "", keyFactor: "" },
                strength: { explanation: "", keyFactor: "" },
                climbing_technical: { explanation: "", keyFactor: "" },
                flexibility: { explanation: "", keyFactor: "" },
              },
              programmingHints: assessmentData.raw_data?.programmingHints || {
                cardio: { startingIntensity: "", sessionsPerWeek: 0, keyAdaptation: "" },
                strength: { startingIntensity: "", sessionsPerWeek: 0, keyAdaptation: "" },
                climbing_technical: { startingIntensity: "", sessionsPerWeek: 0, keyAdaptation: "" },
                flexibility: { startingIntensity: "", sessionsPerWeek: 0, keyAdaptation: "" },
              },
              adjustedTargets: {
                cardio: objData.target_cardio_score,
                strength: objData.target_strength_score,
                climbing_technical: objData.target_climbing_score,
                flexibility: objData.target_flexibility_score,
              },
            });
            setPhase("results");
          }
        }
      } catch {
        // ignore
      }
    }
    fetchObjective();
  }, [objectiveId, viewResults]);

  function buildStandardAnswers(): StandardAnswers {
    return {
      training_days_per_week: trainingDays,
      longest_cardio_distance_miles: parseFloat(cardioDistance) || 0,
      longest_cardio_duration_min: parseFloat(cardioDuration) || 0,
      longest_cardio_elevation_gain_ft: parseFloat(cardioElevation) || 0,
      strength_training_frequency: strengthFrequency,
      strength_training_type: strengthType,
      climbing_experience_level: climbingLevel,
      climbing_highest_grade: climbingGrade,
      climbing_skills: climbingSkills,
      flexibility_hip_tightness: hipTightness,
      flexibility_ankle_mobility: ankleMobility,
      flexibility_regular_routine: hasFlexRoutine,
    };
  }

  async function submitLayer1() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-assessment-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveId,
          standardAnswers: buildStandardAnswers(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate questions");
      }
      const data = await res.json();
      setAiQuestions(data.questions);
      setPhase("layer2");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function requestMoreQuestions() {
    setMoreQuestionsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-more-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveId,
          standardAnswers: buildStandardAnswers(),
          previousQuestions: aiQuestions,
          previousAnswers: aiAnswers,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate more questions");
      }
      const data = await res.json();
      setAiQuestions((prev) => [...prev, ...data.questions]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setMoreQuestionsLoading(false);
    }
  }

  async function submitAssessment() {
    setLoading(true);
    setError(null);
    setPhase("scoring");
    try {
      const res = await fetch("/api/score-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectiveId,
          standardAnswers: buildStandardAnswers(),
          aiQuestions,
          aiAnswers,
          freeformText: freeformText || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to score assessment");
      }
      const data = await res.json();
      setResults(data);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("layer2");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white focus:ring-2 focus:ring-gold/50 focus:border-gold/50";

  const skillOptions = [
    { id: "indoor_gym", label: "Indoor / gym climbing (top-rope or bouldering)" },
    { id: "outdoor_sport", label: "Outdoor sport climbing (including leading)" },
    { id: "trad", label: "Trad climbing (placing own gear)" },
    { id: "multi_pitch", label: "Multi-pitch climbing" },
    { id: "glacier", label: "Glacier travel (crampon & ice axe)" },
    { id: "crevasse_rescue", label: "Crevasse rescue / rope team skills" },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          {objectiveName ? `Assess for ${objectiveName}` : "Fitness Assessment"}
        </h1>
        <p className="text-sm text-dark-muted mt-1">
          {phase === "layer1" && "Answer these baseline questions (~2 minutes)"}
          {phase === "layer2" && "Answer these objective-specific questions"}
          {phase === "scoring" && "Analyzing your responses..."}
          {phase === "results" && "Your assessment results"}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="w-full bg-dark-border rounded-full h-2">
          <div
            className="bg-gold rounded-full h-2 transition-all duration-500"
            style={{
              width:
                phase === "layer1" ? "25%" :
                phase === "layer2" ? "50%" :
                phase === "scoring" ? "75%" : "100%",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-dark-muted mt-1">
          <span className={phase === "layer1" ? "text-gold" : ""}>Baseline</span>
          <span className={phase === "layer2" ? "text-gold" : ""}>Objective-Specific</span>
          <span className={phase === "scoring" ? "text-gold" : ""}>Scoring</span>
          <span className={phase === "results" ? "text-gold" : ""}>Results</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Layer 1: Standard Questions */}
      {phase === "layer1" && (
        <div className="space-y-6">
          {/* Training days */}
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">How many days per week can you train?</label>
            <p className="text-xs text-dark-muted mb-2">We recommend 5–6 days for most major objectives.</p>
            <select value={trainingDays} onChange={(e) => setTrainingDays(parseInt(e.target.value))} className={inputClass}>
              {[2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} days</option>
              ))}
            </select>
          </div>

          {/* Cardio section */}
          <div className="border-t border-dark-border pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Cardio</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Longest cardio effort in last 3 months (miles)</label>
                <p className="text-xs text-dark-muted mb-1">Run, hike, or ruck — any sustained cardio effort</p>
                <input type="number" step="0.1" value={cardioDistance} onChange={(e) => setCardioDistance(e.target.value)} className={inputClass} placeholder="e.g., 8.5" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Duration of that effort (minutes)</label>
                <input type="number" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} className={inputClass} placeholder="e.g., 120" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Elevation gain during that effort (ft)</label>
                <input type="number" value={cardioElevation} onChange={(e) => setCardioElevation(e.target.value)} className={inputClass} placeholder="e.g., 2000" />
              </div>
            </div>
          </div>

          {/* Strength section */}
          <div className="border-t border-dark-border pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Strength</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Strength training frequency</label>
                <select value={strengthFrequency} onChange={(e) => setStrengthFrequency(e.target.value)} className={inputClass}>
                  <option value="never">Never</option>
                  <option value="1-2x/week">1-2x per week</option>
                  <option value="3-4x/week">3-4x per week</option>
                  <option value="5+x/week">5+ per week</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Type of strength training</label>
                <select value={strengthType} onChange={(e) => setStrengthType(e.target.value)} className={inputClass}>
                  <option value="none">None</option>
                  <option value="general">General fitness / bodyweight</option>
                  <option value="powerlifting">Powerlifting / heavy barbell</option>
                  <option value="functional">Functional / mountain-specific</option>
                  <option value="crossfit">CrossFit / HIIT</option>
                  <option value="bodybuilding">Bodybuilding / hypertrophy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Climbing section */}
          <div className="border-t border-dark-border pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Climbing / Technical</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Climbing experience level</label>
                <select value={climbingLevel} onChange={(e) => setClimbingLevel(e.target.value)} className={inputClass}>
                  <option value="none">No climbing experience</option>
                  <option value="beginner">Beginner (indoor gym only)</option>
                  <option value="intermediate">Intermediate (some outdoor climbing)</option>
                  <option value="advanced">Advanced (regular outdoor climbing)</option>
                  <option value="expert">Expert (multi-pitch, alpine, or trad lead)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-1">Highest climbing grade</label>
                <select value={climbingGrade} onChange={(e) => setClimbingGrade(e.target.value)} className={inputClass}>
                  <option value="none">None / no climbing</option>
                  <option value="class_3_4">Class 3-4 scrambling</option>
                  <option value="5.0-5.6">5.0-5.6 (easy roped)</option>
                  <option value="5.7-5.8">5.7-5.8 (moderate)</option>
                  <option value="5.9-5.10a">5.9-5.10a (intermediate)</option>
                  <option value="5.10b-5.10d">5.10b-5.10d (upper intermediate)</option>
                  <option value="5.11+">5.11+ (advanced)</option>
                  <option value="5.12+">5.12+ (expert)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-muted mb-2">Skills (check all that apply)</label>
                <div className="space-y-2">
                  {skillOptions.map((skill) => (
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
            </div>
          </div>

          {/* Flexibility section */}
          <div className="border-t border-dark-border pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">Flexibility</h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center text-sm font-medium text-dark-muted mb-1">
                  Hip mobility (1 = very tight, 5 = very flexible)
                  <InfoBubble title="How to assess your hip mobility">
                    <p>Here&apos;s how to think about this. Try sitting cross-legged on the floor — can you sit comfortably with a straight back, or do your knees stay high and your back rounds? Now try a deep lunge with your back knee close to the ground — can you hold it for 30 seconds without pain?</p>
                    <p><span className="font-bold text-[#D4782F]">1</span> <span className="font-semibold">(Very tight):</span> You can&apos;t sit cross-legged comfortably. Deep lunges feel restricted or painful. Getting in and out of a low car seat is awkward. You spend most of your day sitting and rarely stretch or do lower-body mobility work.</p>
                    <p><span className="font-bold text-[#D4782F]">2</span> <span className="font-semibold">(Tight):</span> You can sit cross-legged but not for long. Lunges feel tight in the front of your back hip. You occasionally stretch or do yoga but your hips are noticeably stiff, especially after sitting for hours.</p>
                    <p><span className="font-bold text-[#D4782F]">3</span> <span className="font-semibold">(Average):</span> You can do a deep lunge and hold it. Sitting cross-legged is fine. You don&apos;t have a dedicated flexibility routine, but you move regularly and your hips don&apos;t limit your activities. Most active people are here.</p>
                    <p><span className="font-bold text-[#D4782F]">4</span> <span className="font-semibold">(Pretty flexible):</span> You can easily hold a deep lunge with your back knee an inch from the ground. Pigeon pose and similar hip stretches feel comfortable. You probably do yoga or dedicated mobility work at least once a week.</p>
                    <p><span className="font-bold text-[#D4782F]">5</span> <span className="font-semibold">(Very flexible):</span> Full splits or near-splits. You can drop into a deep squat with feet flat and sit there comfortably. Hip mobility has never limited any physical activity. Dancers, martial artists, and dedicated yoga practitioners are typically here.</p>
                  </InfoBubble>
                </label>
                <input type="range" min="1" max="5" value={hipTightness} onChange={(e) => setHipTightness(parseInt(e.target.value))} className="w-full accent-gold" />
                <div className="flex justify-between text-xs text-dark-muted"><span>1 (tight)</span><span>3</span><span>5 (flexible)</span></div>
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-dark-muted mb-1">
                  Ankle mobility (1 = very limited, 5 = excellent)
                  <InfoBubble title="How to assess your ankle mobility">
                    <p>Here&apos;s a quick test. Stand facing a wall with one foot about 4 inches away. Try to touch your knee to the wall without lifting your heel. Can you do it easily, barely, or not at all?</p>
                    <p><span className="font-bold text-[#D4782F]">1</span> <span className="font-semibold">(Very stiff):</span> You can&apos;t touch your knee to the wall from 4 inches. Deep squats force your heels off the ground. You&apos;ve had ankle sprains or wear stiff shoes most of the time. Going downhill on steep trails feels jarring.</p>
                    <p><span className="font-bold text-[#D4782F]">2</span> <span className="font-semibold">(Stiff):</span> Knee barely touches the wall at 4 inches. Squatting deep requires heel elevation or a wide stance. You notice ankle tightness on steep descents or uneven ground. Calves feel chronically tight.</p>
                    <p><span className="font-bold text-[#D4782F]">3</span> <span className="font-semibold">(Average):</span> You pass the wall test at 4 inches without difficulty. You can squat to parallel with heels down. Steep terrain doesn&apos;t bother your ankles specifically. Most people who walk or run regularly are here.</p>
                    <p><span className="font-bold text-[#D4782F]">4</span> <span className="font-semibold">(Good):</span> You pass the wall test at 5+ inches. Full deep squat with heels flat is comfortable. You can walk on uneven rocky terrain for hours without ankle fatigue. Trail runners and hikers who train on varied terrain are typically here.</p>
                    <p><span className="font-bold text-[#D4782F]">5</span> <span className="font-semibold">(Excellent):</span> You can easily pass the wall test at 6+ inches. Deep pistol squats are accessible. Your ankles have never limited any athletic movement. This level is common in gymnasts, experienced barefoot runners, and dedicated mobility practitioners.</p>
                  </InfoBubble>
                </label>
                <input type="range" min="1" max="5" value={ankleMobility} onChange={(e) => setAnkleMobility(parseInt(e.target.value))} className="w-full accent-gold" />
                <div className="flex justify-between text-xs text-dark-muted"><span>1 (limited)</span><span>3</span><span>5 (excellent)</span></div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="flexRoutine" checked={hasFlexRoutine} onChange={(e) => setHasFlexRoutine(e.target.checked)} className="accent-gold w-4 h-4" />
                <label htmlFor="flexRoutine" className="text-sm text-dark-text">I have a regular stretching/mobility routine</label>
              </div>
            </div>
          </div>

          <button
            onClick={submitLayer1}
            disabled={loading}
            className="w-full bg-gold text-dark-bg py-3 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors"
          >
            {loading ? "Generating questions..." : "Continue to Objective-Specific Questions"}
          </button>
        </div>
      )}

      {/* Layer 2: AI-Generated Questions */}
      {phase === "layer2" && (
        <div className="space-y-6">
          <div className="bg-test-blue/20 border border-test-blue/30 text-blue-300 px-4 py-3 rounded-lg text-sm">
            These questions are tailored to {objectiveName || "your objective"} to give you the most accurate assessment.
          </div>

          {aiQuestions.map((q) => (
            <div key={q.id} className="space-y-2">
              <label className="block text-sm font-medium text-dark-text">{q.question}</label>
              {q.dimension && (
                <span className="text-xs text-dark-muted capitalize">{q.dimension.replace("_", " / ")}</span>
              )}

              {q.fieldType === "text" && (
                <textarea
                  value={(aiAnswers[q.id] as string) || ""}
                  onChange={(e) => setAiAnswers({ ...aiAnswers, [q.id]: e.target.value })}
                  className={`${inputClass} min-h-[80px]`}
                  placeholder="Your answer..."
                />
              )}

              {q.fieldType === "number" && (
                <input
                  type="number"
                  value={(aiAnswers[q.id] as number) ?? ""}
                  onChange={(e) => setAiAnswers({ ...aiAnswers, [q.id]: parseFloat(e.target.value) || 0 })}
                  className={inputClass}
                />
              )}

              {q.fieldType === "dropdown" && q.options && (
                <select
                  value={(aiAnswers[q.id] as string) || ""}
                  onChange={(e) => setAiAnswers({ ...aiAnswers, [q.id]: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select...</option>
                  {q.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {q.fieldType === "scale" && (
                <div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={(aiAnswers[q.id] as number) || 3}
                    onChange={(e) => setAiAnswers({ ...aiAnswers, [q.id]: parseInt(e.target.value) })}
                    className="w-full accent-gold"
                  />
                  <div className="flex justify-between text-xs text-dark-muted">
                    <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Want more precise assessment? */}
          <button
            onClick={requestMoreQuestions}
            disabled={moreQuestionsLoading}
            className="w-full py-2.5 border border-dark-border text-dark-text rounded-lg text-sm hover:bg-dark-card transition-colors disabled:opacity-50"
          >
            {moreQuestionsLoading ? "Generating..." : "Want a more precise assessment? Get more questions"}
          </button>

          {/* Freeform text */}
          <div>
            <label className="block text-sm font-medium text-dark-muted mb-1">
              Anything else relevant to your readiness for {objectiveName || "this objective"}?
            </label>
            <textarea
              value={freeformText}
              onChange={(e) => setFreeformText(e.target.value)}
              className={`${inputClass} min-h-[80px]`}
              placeholder="Optional — any additional context about your fitness, experience, injuries, etc."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPhase("layer1")}
              className="px-4 py-2.5 border border-dark-border text-dark-text rounded-lg hover:bg-dark-card transition-colors"
            >
              Back
            </button>
            <button
              onClick={submitAssessment}
              disabled={loading}
              className="flex-1 bg-gold text-dark-bg py-3 rounded-lg font-medium disabled:opacity-50 hover:bg-gold/90 transition-colors"
            >
              {loading ? "Scoring..." : "Score My Assessment"}
            </button>
          </div>
        </div>
      )}

      {/* Scoring phase */}
      {phase === "scoring" && (
        <div className="text-center py-16 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto" />
          <p className="text-dark-muted">Analyzing your responses against {objectiveName || "objective"} demands...</p>
          <p className="text-xs text-dark-muted">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Results */}
      {phase === "results" && results && (
        <div className="space-y-6">
          <div className="bg-test-blue/20 border border-test-blue/30 text-blue-300 px-4 py-3 rounded-lg text-sm">
            These are estimated scores. They&apos;ll calibrate as you train and complete test weeks.
          </div>

          {results.climbingRole && (
            <div className="bg-dark-card/80 border border-dark-border/50 rounded-lg px-4 py-3 text-sm">
              <span className="text-dark-muted">Climbing role: </span>
              <span className="text-gold font-medium capitalize">{results.climbingRole}</span>
              {results.climbingRole === "follow" && (
                <span className="text-dark-muted ml-1">— targets adjusted for following</span>
              )}
            </div>
          )}

          {/* Score cards */}
          <div className="grid grid-cols-2 gap-4">
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const score = results.scores[dim];
              const target = results.adjustedTargets?.[dim] ?? 0;
              const pct = target > 0 ? Math.min(100, Math.round((score / target) * 100)) : 0;
              const label = dim === "climbing_technical" ? "Climbing" : dim.charAt(0).toUpperCase() + dim.slice(1);

              return (
                <div key={dim} className="bg-dark-card/80 backdrop-blur-sm rounded-xl p-4 border border-dark-border/50">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-sm text-dark-muted">{label}</span>
                    <span className="text-xs text-dark-muted">/ {target}</span>
                  </div>
                  <div className="text-3xl font-bold text-gold">{score}</div>
                  <div className="w-full bg-dark-border rounded-full h-2 mt-2">
                    <div
                      className="bg-gold rounded-full h-2 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Per-dimension reasoning */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">AI Reasoning</h3>
            {(["cardio", "strength", "climbing_technical", "flexibility"] as const).map((dim) => {
              const r = results.reasoning[dim];
              if (!r) return null;
              const label = dim === "climbing_technical" ? "Climbing / Technical" : dim.charAt(0).toUpperCase() + dim.slice(1);
              return (
                <div key={dim} className="bg-dark-card/80 rounded-xl p-4 border border-dark-border/50">
                  <h4 className="text-sm font-semibold text-gold mb-1">{label}</h4>
                  <p className="text-sm text-dark-text">{r.explanation}</p>
                  <p className="text-xs text-dark-muted mt-1">Key factor: {r.keyFactor}</p>
                </div>
              );
            })}
          </div>

          {viewResults ? (
            <button
              onClick={() => router.push("/plan")}
              className="w-full bg-dark-card/80 text-gold border border-gold/30 py-3 rounded-lg font-medium hover:bg-dark-card transition-colors"
            >
              ← Back to Plan
            </button>
          ) : (
            <button
              onClick={() => router.push(`/plan?generate=true&objectiveId=${objectiveId}&assessmentId=${results.assessmentId}`)}
              className="w-full bg-gold text-dark-bg py-3 rounded-lg font-medium hover:bg-gold/90 transition-colors"
            >
              Generate Training Plan
            </button>
          )}
        </div>
      )}
    </div>
  );
}
