import { dimensionProgressFractions, classifyGaps } from "@/lib/scoring";

/**
 * Shared utility for building the user message sent to Claude's Prompt 2B
 * for session generation. Used by generate-week-sessions, generate-all-sessions,
 * and generate-plan (eager week 1 generation).
 */

export interface SessionMessageProfile {
  training_days_per_week?: number;
  equipment_access?: string[];
  location?: string;
}

export interface SessionMessageWeekTarget {
  week_number: number;
  week_type: string;
  week_start: string;
  total_hours: number;
  expected_scores: Record<string, number>;
}

export function buildSessionUserMessage(
  profile: SessionMessageProfile | null,
  objective: Record<string, unknown>,
  weekTarget: SessionMessageWeekTarget,
  totalWeeks: number,
  programmingHints: Record<string, unknown> | null,
  climbingRole: string | null,
  daysPerWeek: number
): string {
  const weekNumber = weekTarget.week_number;

  const programmingHintsBlock = programmingHints
    ? `\nATHLETE PROFILE (from assessment):\n${JSON.stringify(programmingHints, null, 2)}\nClimbing role: ${climbingRole || "not specified"}\n\nUse the programming hints to adapt session content to this specific athlete:\n- Start exercises at the recommended intensity level\n- Allocate time across dimensions as recommended\n- Apply specific adaptations noted above\n- If a dimension is flagged as "maintain", prescribe maintenance-level volume\n`
    : "";

  return `Athlete profile: Available ${daysPerWeek} days/week. Generate EXACTLY ${daysPerWeek} sessions total — no more, no fewer. Equipment: ${(profile?.equipment_access || []).join(", ") || "basic gym equipment"}. Location: ${profile?.location || "not specified"}. Injuries: none.
${programmingHintsBlock}
Objective: ${objective.name}. Type: ${objective.type}. Target date: ${objective.target_date}. Distance: ${objective.distance_miles || "N/A"} miles. Elevation gain: ${objective.elevation_gain_ft || "N/A"} ft. Technical grade: ${objective.technical_grade || "N/A"}.

Current scores: Cardio ${objective.current_cardio_score}, Strength ${objective.current_strength_score}, Climbing/Technical ${objective.current_climbing_score}, Flexibility ${objective.current_flexibility_score}.
Target scores: Cardio ${objective.target_cardio_score}, Strength ${objective.target_strength_score}, Climbing/Technical ${objective.target_climbing_score}, Flexibility ${objective.target_flexibility_score}.

THIS IS WEEK ${weekNumber} of ${totalWeeks} total weeks.
Week type: ${weekTarget.week_type}.
Week start date: ${weekTarget.week_start}.
Target hours: ${weekTarget.total_hours}.
Expected scores this week: ${JSON.stringify(weekTarget.expected_scores)}.

Graduation benchmarks: ${JSON.stringify(redactRelativeBenchmarks(objective, totalWeeks))}

Relevance profiles: ${JSON.stringify(objective.relevance_profiles)}

${buildProgressFractionBlock(objective, weekNumber, totalWeeks)}`;
}

/**
 * For RELATIVE dimensions (athlete meets/exceeds target), strip specific
 * graduation target values so Claude can't latch onto concrete numbers.
 * Keeps exercise names but replaces graduationTarget with "RELATIVE — use
 * descriptors only".
 */
function redactRelativeBenchmarks(
  objective: Record<string, unknown>,
  totalWeeks: number
): Record<string, unknown> {
  const benchmarks = objective.graduation_benchmarks as Record<string, Array<Record<string, unknown>>> | undefined;
  if (!benchmarks) return {};

  const currentScores = {
    cardio: (objective.current_cardio_score as number) || 0,
    strength: (objective.current_strength_score as number) || 0,
    climbing_technical: (objective.current_climbing_score as number) || 0,
    flexibility: (objective.current_flexibility_score as number) || 0,
  };
  const targetScores = {
    cardio: (objective.target_cardio_score as number) || 0,
    strength: (objective.target_strength_score as number) || 0,
    climbing_technical: (objective.target_climbing_score as number) || 0,
    flexibility: (objective.target_flexibility_score as number) || 0,
  };
  const gaps = classifyGaps(currentScores, targetScores, totalWeeks);

  const redacted: Record<string, unknown> = {};
  for (const [dim, exercises] of Object.entries(benchmarks)) {
    const isFlexibility = dim === "flexibility";
    const gapInfo = !isFlexibility ? gaps[dim as keyof typeof gaps] : null;
    const isRelative = isFlexibility || !gapInfo || gapInfo.classification === "exceeds" || gapInfo.classification === "on_target";

    if (isRelative && Array.isArray(exercises)) {
      redacted[dim] = exercises.map((ex) => ({
        ...ex,
        graduationTarget: "RELATIVE — do not prescribe specific targets, use relative descriptors only",
      }));
    } else {
      redacted[dim] = exercises;
    }
  }
  return redacted;
}

function buildProgressFractionBlock(
  objective: Record<string, unknown>,
  weekNumber: number,
  totalWeeks: number
): string {
  const currentScores = {
    cardio: (objective.current_cardio_score as number) || 0,
    strength: (objective.current_strength_score as number) || 0,
    climbing_technical: (objective.current_climbing_score as number) || 0,
    flexibility: (objective.current_flexibility_score as number) || 0,
  };
  const targetScores = {
    cardio: (objective.target_cardio_score as number) || 0,
    strength: (objective.target_strength_score as number) || 0,
    climbing_technical: (objective.target_climbing_score as number) || 0,
    flexibility: (objective.target_flexibility_score as number) || 0,
  };
  const fractions = dimensionProgressFractions(currentScores, targetScores, weekNumber, totalWeeks);
  const gaps = classifyGaps(currentScores, targetScores, totalWeeks);

  const dimLabels: Record<string, string> = {
    cardio: "Cardio",
    strength: "Strength",
    climbing_technical: "Climbing/Technical",
    flexibility: "Flexibility",
  };

  const lines: string[] = [];
  const maintenanceDims: string[] = [];

  for (const [dim, label] of Object.entries(dimLabels)) {
    const prog = fractions[dim];
    const current = currentScores[dim as keyof typeof currentScores];
    const target = targetScores[dim as keyof typeof targetScores];

    // Determine prescription mode
    const isFlexibility = dim === "flexibility";
    const gapInfo = !isFlexibility ? gaps[dim as keyof typeof gaps] : null;
    const prescriptionMode = isFlexibility || !gapInfo || gapInfo.classification === "exceeds" || gapInfo.classification === "on_target"
      ? "RELATIVE" : "ABSOLUTE";

    if (prog.maintenance) {
      const performanceRatio = target > 0 ? Math.round((current / target) * 100) : 100;
      lines.push(`- ${label}: MAINTENANCE MODE (1 session/week, 60% volume) — current ${current} vs target ${target}. Athlete performs at ~${performanceRatio}% of graduation benchmarks. Prescribe the single session at this higher level, not at graduation target level. PRESCRIPTION: ${prescriptionMode}`);
      maintenanceDims.push(label);
    } else if (current >= target) {
      lines.push(`- ${label}: ${prog.fraction}% (already meets target — maintenance with slight progression). PRESCRIPTION: ${prescriptionMode}`);
    } else {
      const achievabilityNote = gapInfo && (gapInfo.classification === "stretch" || gapInfo.classification === "very_challenging")
        ? ` (${gapInfo.pointsPerWeek} pts/wk needed — ${gapInfo.classification === "stretch" ? "ambitious" : "very aggressive"} timeline)`
        : "";
      lines.push(`- ${label}: ${prog.fraction}%${achievabilityNote}. PRESCRIPTION: ${prescriptionMode}`);
    }
  }

  let result = `Per-dimension progress fractions for Week ${weekNumber} (percentage of graduation targets this week's sessions should reach):
${lines.join("\n")}

IMPORTANT: These percentages reflect the athlete's CURRENT fitness level. Do NOT prescribe beginner-level training for dimensions where the athlete is already strong. Match session intensity to the progress fraction shown.

PRESCRIPTION MODE KEY:
- RELATIVE: Athlete meets or exceeds target. NEVER prescribe specific grades, weights, distances, or rep counts as targets. Use ONLY relative descriptors: "at your comfortable level", "2 grades below your limit", "your usual pace", "at your working weight".
- ABSOLUTE: Athlete is below target. Prescribe specific, measurable targets progressing toward graduation benchmarks. Show clear weekly progression (e.g., "25lb step-ups this week, building to 35lb by week 8").
- Flexibility ALWAYS uses relative descriptors regardless of gap.

VIOLATION CHECK: Before returning, review every exercise in every session. If a dimension is tagged RELATIVE above, its exercises must NOT contain any specific grade (e.g., "5.7"), weight (e.g., "30lb"), distance (e.g., "4 miles"), or pace. Replace any such specifics with relative language. This is a hard rule.`;

  if (maintenanceDims.length > 0) {
    result += `\n\nMAINTENANCE REALLOCATION: ${maintenanceDims.join(", ")} ${maintenanceDims.length === 1 ? "is" : "are"} in maintenance mode. Reallocate freed training time to dimensions furthest below their target scores, prioritizing the dimension with the highest target score.`;
  }

  return result;
}
