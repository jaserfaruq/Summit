import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { GeneratePlanRequest } from "@/lib/types";
import { expectedScoresAtWeek, classifyGaps } from "@/lib/scoring";
import { fetchHeroImageUrl } from "@/lib/unsplash";
import { findSeedMatch } from "@/lib/seed-data";
import { callClaude } from "@/lib/claude";
import { PROMPT_PHILOSOPHY_SYSTEM } from "@/lib/prompts";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: GeneratePlanRequest = await request.json();
  const { objectiveId, assessmentId } = body;

  // Fetch objective
  const { data: objective, error: objError } = await supabase
    .from("objectives")
    .select("*")
    .eq("id", objectiveId)
    .single();

  if (objError || !objective) {
    return NextResponse.json({ error: "Objective not found" }, { status: 404 });
  }

  // Fetch assessment
  const { data: assessment, error: assError } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .single();

  if (assError || !assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Look up seed data first (authoritative), then fall back to validated_objectives table
  const seedData = findSeedMatch(objective.name);

  if (seedData) {
    // Seed data is the single source of truth for gold objectives
    objective.graduation_benchmarks = seedData.graduation_benchmarks;
    const updateFields: Record<string, unknown> = {
      graduation_benchmarks: seedData.graduation_benchmarks,
      taglines: seedData.taglines,
      target_cardio_score: seedData.target_scores.cardio,
      target_strength_score: seedData.target_scores.strength,
      target_climbing_score: seedData.target_scores.climbing_technical,
      target_flexibility_score: seedData.target_scores.flexibility,
      tier: "gold",
    };

    // Also link to validated objective if not already linked
    if (!objective.matched_validated_id) {
      const { data: allVOs } = await supabase
        .from("validated_objectives")
        .select("id, name")
        .eq("status", "active");
      const voMatch = allVOs?.find((vo: { name: string }) =>
        vo.name.toLowerCase() === seedData.name.toLowerCase()
      );
      if (voMatch) {
        updateFields.matched_validated_id = voMatch.id;
        objective.matched_validated_id = voMatch.id;
      }
    }

    await supabase.from("objectives").update(updateFields).eq("id", objectiveId);

    // Update local target scores for plan generation
    objective.target_cardio_score = seedData.target_scores.cardio;
    objective.target_strength_score = seedData.target_scores.strength;
    objective.target_climbing_score = seedData.target_scores.climbing_technical;
    objective.target_flexibility_score = seedData.target_scores.flexibility;
  } else if (objective.matched_validated_id) {
    // No seed match but has a validated ID — refresh from DB
    const { data: validatedObj } = await supabase
      .from("validated_objectives")
      .select("graduation_benchmarks, target_scores, taglines, relevance_profiles")
      .eq("id", objective.matched_validated_id)
      .single();

    if (validatedObj?.graduation_benchmarks) {
      objective.graduation_benchmarks = validatedObj.graduation_benchmarks;
      await supabase
        .from("objectives")
        .update({
          graduation_benchmarks: validatedObj.graduation_benchmarks,
          taglines: validatedObj.taglines,
          relevance_profiles: validatedObj.relevance_profiles,
        })
        .eq("id", objectiveId);
    }
  } else {
    // No seed match, no validated match — try to find one by name in DB
    const normalizedName = objective.name.toLowerCase().trim();
    const { data: allVOs } = await supabase
      .from("validated_objectives")
      .select("*")
      .eq("status", "active");

    if (allVOs) {
      const match = allVOs.find((vo: { match_aliases: string[] }) =>
        vo.match_aliases.some((alias: string) => {
          const a = alias.toLowerCase().trim();
          return a === normalizedName || normalizedName.includes(a) || a.includes(normalizedName);
        })
      );

      if (match) {
        objective.graduation_benchmarks = match.graduation_benchmarks;
        objective.matched_validated_id = match.id;
        await supabase
          .from("objectives")
          .update({
            graduation_benchmarks: match.graduation_benchmarks,
            taglines: match.taglines,
            relevance_profiles: match.relevance_profiles,
            matched_validated_id: match.id,
            tier: "gold",
            target_cardio_score: match.target_scores.cardio,
            target_strength_score: match.target_scores.strength,
            target_climbing_score: match.target_scores.climbing_technical,
            target_flexibility_score: match.target_scores.flexibility,
          })
          .eq("id", objectiveId);

        objective.target_cardio_score = match.target_scores.cardio;
        objective.target_strength_score = match.target_scores.strength;
        objective.target_climbing_score = match.target_scores.climbing_technical;
        objective.target_flexibility_score = match.target_scores.flexibility;
      }
    }
  }

  // Calculate weeks available
  const now = new Date();
  const targetDate = new Date(objective.target_date);
  const totalWeeks = Math.max(
    4,
    Math.floor((targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
  );

  // All weeks are regular — no special week types
  const daysPerWeek = profile?.training_days_per_week || 5;

  const currentScores = {
    cardio: assessment.cardio_score,
    strength: assessment.strength_score,
    climbing_technical: assessment.climbing_score,
    flexibility: assessment.flexibility_score,
  };

  const targetScores = {
    cardio: objective.target_cardio_score,
    strength: objective.target_strength_score,
    climbing_technical: objective.target_climbing_score,
    flexibility: objective.target_flexibility_score,
  };

  // Base hours: scale by training days, cap at 20
  const baseHours = Math.min(daysPerWeek * 1.2, 20);

  const weeks = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNumber = i + 1;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Taper: reduce volume in last 2 weeks
    const isTaper = weekNumber > totalWeeks - 2;
    const volumeMultiplier = isTaper ? 0.6 : 1.0;

    // Progressive volume: ramp up ~5% per week
    const progressionFactor = Math.min(1.0, 0.7 + (weekNumber / totalWeeks) * 0.3);
    const totalHours = Math.round(baseHours * volumeMultiplier * progressionFactor * 10) / 10;

    return {
      weekNumber,
      weekStartDate: weekStartStr,
      weekType: "regular" as const,
      totalHoursTarget: totalHours,
      expectedScores: expectedScoresAtWeek(currentScores, targetScores, weekNumber, totalWeeks),
    };
  });

  // Extract programmingHints from assessment raw_data
  const programmingHints = assessment.raw_data?.programmingHints || null;

  // Compute gap analysis for achievability warnings
  const gapAnalysis = classifyGaps(currentScores, targetScores, totalWeeks);

  // Generate AI philosophy and fetch hero image in parallel
  const philosophyFallback = buildPlanPhilosophy(objective.name, currentScores, targetScores, objective.taglines, totalWeeks);

  // Resolve route name from validated objective if matched
  let objectiveRouteName = objective.name;
  if (objective.matched_validated_id) {
    const { data: validatedObj } = await supabase
      .from("validated_objectives")
      .select("route")
      .eq("id", objective.matched_validated_id)
      .single();
    if (validatedObj?.route) objectiveRouteName = validatedObj.route;
  }

  const [philosophyText, heroImageUrl] = await Promise.all([
    generateAIPhilosophy(objective, assessment, currentScores, targetScores, totalWeeks, objectiveRouteName, gapAnalysis).catch((err) => {
      console.warn("AI philosophy generation failed, using fallback:", err);
      return philosophyFallback;
    }),
    fetchHeroImageUrl(objective.name).catch((err) => {
      console.warn("Hero image fetch failed, continuing without:", err);
      return null as string | null;
    }),
  ]);

  const planSummary = {
    philosophy: philosophyText,
    weeklyStructure: `${daysPerWeek} sessions per week across cardio, strength, climbing/technical, and flexibility. Sessions are generated on-demand when you expand each week.`,
    equipmentNeeded: profile?.equipment_access || ["basic gym equipment"],
    keyExercises: extractKeyExercises(objective.graduation_benchmarks),
  };

  try {
    // Store the plan
    const { data: plan, error: planError } = await supabase
      .from("training_plans")
      .insert({
        user_id: user.id,
        objective_id: objectiveId,
        assessment_id: assessmentId,
        plan_data: {
          planSummary,
          heroImageUrl,
          programmingHints,
          gapAnalysis,
          weeks: weeks.map((w) => ({ ...w, sessions: [] })),
        },
        graduation_workouts: objective.graduation_benchmarks,
        status: "active",
      })
      .select()
      .single();

    if (planError || !plan) {
      console.error("Failed to save plan:", planError);
      return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }

    // Store weekly targets with empty sessions
    const weeklyTargets = weeks.map((week) => ({
      plan_id: plan.id,
      user_id: user.id,
      week_number: week.weekNumber,
      week_start: week.weekStartDate,
      week_type: week.weekType,
      total_hours: week.totalHoursTarget,
      expected_scores: week.expectedScores,
      sessions: [], // Generated on-demand via /api/generate-week-sessions
    }));

    const { error: weekError } = await supabase
      .from("weekly_targets")
      .insert(weeklyTargets);

    if (weekError) {
      console.error("Error saving weekly targets:", weekError);
      // Clean up the orphaned plan
      await supabase.from("training_plans").delete().eq("id", plan.id);
      return NextResponse.json(
        { error: "Failed to save weekly targets: " + weekError.message },
        { status: 500 }
      );
    }

    // Update current scores on objective from assessment
    await supabase
      .from("objectives")
      .update({
        current_cardio_score: assessment.cardio_score,
        current_strength_score: assessment.strength_score,
        current_climbing_score: assessment.climbing_score,
        current_flexibility_score: assessment.flexibility_score,
      })
      .eq("id", objectiveId);

    return NextResponse.json({
      planId: plan.id,
      weekCount: weeks.length,
    });
  } catch (error) {
    console.error("Error generating plan:", error);
    return NextResponse.json(
      { error: "Failed to generate plan. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Generate a personalized plan philosophy using Claude AI,
 * incorporating assessment reasoning and programming hints.
 */
async function generateAIPhilosophy(
  objective: Record<string, unknown>,
  assessment: Record<string, unknown>,
  currentScores: Record<string, number>,
  targetScores: Record<string, number>,
  totalWeeks: number,
  routeName: string,
  gapAnalysis?: Record<string, { classification: string; gap: number; pointsPerWeek: number }>
): Promise<string> {
  const aiReasoning = assessment.ai_reasoning as Record<string, { explanation: string; keyFactor: string }> | null;
  const programmingHints = (assessment.raw_data as Record<string, unknown>)?.programmingHints || null;

  const gapLines = gapAnalysis ? Object.entries(gapAnalysis).map(([dim, g]) => {
    const label = dim === "climbing_technical" ? "Climbing/Technical" : dim.charAt(0).toUpperCase() + dim.slice(1);
    if (g.classification === "exceeds") return `- ${label}: EXCEEDS target (current is 125%+ of target) — this is a strength`;
    if (g.classification === "on_target") return `- ${label}: ON TARGET — meets requirements`;
    if (g.classification === "stretch") return `- ${label}: STRETCH goal (${g.pointsPerWeek} pts/wk needed — ambitious, requires consistency)`;
    if (g.classification === "very_challenging") return `- ${label}: VERY CHALLENGING (${g.pointsPerWeek} pts/wk needed — aggressive timeline, may not fully close this gap)`;
    return `- ${label}: ACHIEVABLE (${g.pointsPerWeek} pts/wk needed)`;
  }).join("\n") : "";

  const userMessage = `Objective: ${objective.name}${objective.type ? ` (${objective.type})` : ""}
Route: ${routeName}
Plan duration: ${totalWeeks} weeks
Target date: ${objective.target_date}

Current → Target scores:
- Cardio: ${currentScores.cardio} → ${targetScores.cardio}
- Strength: ${currentScores.strength} → ${targetScores.strength}
- Climbing/Technical: ${currentScores.climbing_technical} → ${targetScores.climbing_technical}
- Flexibility: ${currentScores.flexibility} → ${targetScores.flexibility}

${gapLines ? `Gap analysis:\n${gapLines}` : ""}

${aiReasoning ? `Assessment findings:
- Cardio: ${aiReasoning.cardio?.explanation || "N/A"} (Key factor: ${aiReasoning.cardio?.keyFactor || "N/A"})
- Strength: ${aiReasoning.strength?.explanation || "N/A"} (Key factor: ${aiReasoning.strength?.keyFactor || "N/A"})
- Climbing/Technical: ${aiReasoning.climbing_technical?.explanation || "N/A"} (Key factor: ${aiReasoning.climbing_technical?.keyFactor || "N/A"})
- Flexibility: ${aiReasoning.flexibility?.explanation || "N/A"} (Key factor: ${aiReasoning.flexibility?.keyFactor || "N/A"})` : "No detailed assessment reasoning available."}

${programmingHints ? `Programming hints: ${JSON.stringify(programmingHints)}` : ""}
${objective.climbing_role ? `Climbing role: ${objective.climbing_role}` : ""}

Write exactly 2 paragraphs. No formatting, no headers, no bullet points. Plain text only.`;

  const response = await callClaude(PROMPT_PHILOSOPHY_SYSTEM, userMessage, 1024, "sonnet");

  // Clean up: remove any markdown formatting the AI might add
  const cleaned = response
    .replace(/^#+\s.*$/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

const DIM_LABELS: Record<string, string> = {
  cardio: "Cardio",
  strength: "Strength",
  climbing_technical: "Climbing/Technical",
  flexibility: "Flexibility",
};

/**
 * Build a data-driven plan philosophy that explains WHY the plan
 * is structured the way it is, based on actual score gaps.
 */
function buildPlanPhilosophy(
  objectiveName: string,
  current: Record<string, number>,
  target: Record<string, number>,
  taglines: Record<string, string> | null,
  totalWeeks: number
): string {
  const dims = ["cardio", "strength", "climbing_technical", "flexibility"];

  // Categorize each dimension
  const bigGaps: { dim: string; gap: number; pct: number }[] = [];
  const moderateGaps: { dim: string; gap: number }[] = [];
  const maintenance: { dim: string }[] = [];
  const minimal: { dim: string }[] = [];

  for (const dim of dims) {
    const cur = current[dim] ?? 0;
    const tgt = target[dim] ?? 0;
    const gap = tgt - cur;
    const pctBehind = tgt > 0 ? Math.round((gap / tgt) * 100) : 0;

    if (cur >= tgt) {
      maintenance.push({ dim });
    } else if (pctBehind >= 50) {
      bigGaps.push({ dim, gap, pct: pctBehind });
    } else if (gap >= 10) {
      moderateGaps.push({ dim, gap });
    } else {
      minimal.push({ dim });
    }
  }

  // Sort big gaps by size (largest first)
  bigGaps.sort((a, b) => b.pct - a.pct);

  const parts: string[] = [];

  // Opening line
  parts.push(`This ${totalWeeks}-week plan prepares you for ${objectiveName}.`);

  // Big gaps — these drive the plan's focus
  if (bigGaps.length > 0) {
    const gapDescriptions = bigGaps.map((g) => {
      const label = DIM_LABELS[g.dim];
      const tagline = taglines?.[g.dim];
      const taglineSuffix = tagline ? ` — ${tagline.toLowerCase()}` : "";
      return `${label} (${current[g.dim]} → ${target[g.dim]}${taglineSuffix})`;
    });

    if (bigGaps.length === 1) {
      parts.push(`Your biggest priority is ${gapDescriptions[0]}. The plan dedicates the most training volume here to close this gap.`);
    } else {
      parts.push(`Your biggest gaps are in ${gapDescriptions.join(" and ")}. The plan prioritizes these dimensions with the most training volume.`);
    }
  }

  // Moderate gaps
  if (moderateGaps.length > 0) {
    const labels = moderateGaps.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${moderateGaps.length === 1 ? "needs" : "need"} steady progression to reach target.`);
  }

  // Maintenance dimensions
  if (maintenance.length > 0) {
    const labels = maintenance.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${maintenance.length === 1 ? "is" : "are"} already at or above target — the plan maintains ${maintenance.length === 1 ? "this" : "these"} with reduced volume and reallocates that time to weaker areas.`);
  }

  // Minimal gaps (close to target)
  if (minimal.length > 0 && bigGaps.length > 0) {
    const labels = minimal.map((g) => DIM_LABELS[g.dim]);
    parts.push(`${labels.join(" and ")} ${minimal.length === 1 ? "is" : "are"} close to target and ${minimal.length === 1 ? "needs" : "need"} only light work.`);
  }

  // Periodization note
  parts.push(`Rate each workout on a 1-5 scale to track your progress. The plan includes a 2-week taper to peak on your target date.`);

  return parts.join(" ");
}

// Extract exercise names from graduation benchmarks for the plan summary
function extractKeyExercises(graduationBenchmarks: unknown): string[] {
  const exercises: string[] = [];
  if (!graduationBenchmarks || typeof graduationBenchmarks !== "object") return exercises;
  const benchmarks = graduationBenchmarks as Record<string, Array<{ exerciseName?: string }>>;
  for (const dim of Object.keys(benchmarks)) {
    const dimBenchmarks = benchmarks[dim];
    if (Array.isArray(dimBenchmarks)) {
      for (const b of dimBenchmarks) {
        if (b.exerciseName) exercises.push(b.exerciseName);
      }
    }
  }
  return exercises;
}
