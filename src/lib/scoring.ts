import { DimensionScores, PlanSession, Dimension, WorkoutRating, RATING_MULTIPLIERS, GapClassification, DimensionGapAnalysis, GapAnalysis } from "./types";

const DIMENSIONS: Dimension[] = ["cardio", "strength", "climbing_technical", "flexibility"];

/**
 * Calculate updated score for a dimension based on 1-5 self-ratings.
 * Averages ratings for the dimension, maps to a multiplier, and applies
 * that multiplier to the expected weekly gain.
 * If an aiMultiplier is provided (from Prompt 3B), it is used instead of
 * the base multiplier lookup.
 */
export function calculateScoreFromRatings(
  ratings: WorkoutRating[],
  expectedGain: number,
  currentScore: number,
  aiMultiplier?: number
): number {
  if (ratings.length === 0) {
    // No training logged for this dimension — slight regression
    return Math.max(0, currentScore - 1);
  }

  let multiplier: number;
  if (aiMultiplier !== undefined) {
    multiplier = aiMultiplier;
  } else {
    const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    // Round to nearest valid rating for multiplier lookup
    const roundedRating = Math.max(1, Math.min(5, Math.round(avgRating))) as WorkoutRating;
    multiplier = RATING_MULTIPLIERS[roundedRating];
  }

  const newScore = currentScore + expectedGain * multiplier;
  return Math.round(Math.max(0, newScore));
}

/**
 * Calculate scores for all dimensions from session ratings.
 * If aiMultipliers is provided, uses those instead of base multipliers
 * for the specified dimensions.
 */
export function calculateAllScoresFromRatings(
  ratings: { dimension: Dimension; rating: WorkoutRating }[],
  currentScores: DimensionScores,
  expectedScores: DimensionScores,
  aiMultipliers?: Partial<Record<Dimension, number>>
): DimensionScores {
  const result = { ...currentScores };

  for (const dim of DIMENSIONS) {
    const dimRatings = ratings.filter(r => r.dimension === dim).map(r => r.rating);
    const expectedGain = expectedScores[dim] - currentScores[dim];

    result[dim] = calculateScoreFromRatings(
      dimRatings,
      expectedGain,
      currentScores[dim],
      aiMultipliers?.[dim]
    );
  }

  return result;
}

/**
 * Linear interpolation for expected scores at a given week.
 * When current exceeds target (maintenance dimension), holds at current
 * score rather than interpolating downward.
 */
export function expectedScoreAtWeek(
  currentScore: number,
  targetScore: number,
  weekNumber: number,
  totalWeeks: number
): number {
  if (currentScore >= targetScore) {
    // Maintenance dimension: hold at current score, never interpolate down
    return currentScore;
  }
  return Math.round(
    currentScore + (targetScore - currentScore) * (weekNumber / totalWeeks)
  );
}

/**
 * Calculate expected scores for all dimensions at a given week.
 */
export function expectedScoresAtWeek(
  current: DimensionScores,
  target: DimensionScores,
  weekNumber: number,
  totalWeeks: number
): DimensionScores {
  return {
    cardio: expectedScoreAtWeek(current.cardio, target.cardio, weekNumber, totalWeeks),
    strength: expectedScoreAtWeek(current.strength, target.strength, weekNumber, totalWeeks),
    climbing_technical: expectedScoreAtWeek(current.climbing_technical, target.climbing_technical, weekNumber, totalWeeks),
    flexibility: expectedScoreAtWeek(current.flexibility, target.flexibility, weekNumber, totalWeeks),
  };
}

/**
 * Check if rebalancing should be highlighted (any dimension 5+ pts off trajectory).
 */
export function shouldHighlightRebalance(
  actual: DimensionScores,
  expected: DimensionScores
): { recommended: boolean; dimensions: Dimension[] } {
  const offTrackDims: Dimension[] = [];

  for (const dim of DIMENSIONS) {
    const gap = Math.abs(expected[dim] - actual[dim]);
    if (gap >= 5) {
      offTrackDims.push(dim);
    }
  }

  return { recommended: offTrackDims.length > 0, dimensions: offTrackDims };
}

/**
 * Generate a plain-language summary of weekly progress.
 */
export function generateCompletionSummary(
  actual: DimensionScores,
  expected: DimensionScores,
  target: DimensionScores
): string {
  const dimLabels: Record<Dimension, string> = {
    cardio: "Cardio",
    strength: "Strength",
    climbing_technical: "Climbing/Technical",
    flexibility: "Flexibility",
  };

  const ahead: string[] = [];
  const onTrack: string[] = [];
  const behind: string[] = [];

  for (const dim of DIMENSIONS) {
    const gap = actual[dim] - expected[dim];
    const label = dimLabels[dim];

    if (actual[dim] >= target[dim]) {
      ahead.push(`${label} has reached its target`);
    } else if (gap >= 3) {
      ahead.push(`${label} is ahead of schedule (+${gap})`);
    } else if (gap <= -5) {
      behind.push(`${label} is falling behind (${gap})`);
    } else if (gap <= -3) {
      behind.push(`${label} is slightly behind (${gap})`);
    } else {
      onTrack.push(label);
    }
  }

  const parts: string[] = [];
  if (onTrack.length > 0) {
    parts.push(`${onTrack.join(" and ")} ${onTrack.length === 1 ? "is" : "are"} on track.`);
  }
  if (ahead.length > 0) {
    parts.push(ahead.join(". ") + ".");
  }
  if (behind.length > 0) {
    parts.push(behind.join(". ") + ".");
  }

  return parts.join(" ") || "All dimensions are progressing as expected.";
}

/**
 * Score arc color based on distance from target.
 */
export function scoreArcColor(current: number, target: number): "green" | "yellow" | "red" {
  if (current >= target) return "green";
  const gap = target - current;
  if (gap <= 10) return "green";
  if (gap < 25) return "yellow";
  return "red";
}

/**
 * Calculate estimatedMinutes for a session by summing its component durations.
 * Falls back to 45 if no duration data is available.
 */
export function calculateSessionMinutes(session: PlanSession): number {
  const warmUp = session.warmUp?.warmUpMinutes ?? 10;
  const training = session.training?.reduce(
    (sum, ex) => sum + (ex.durationMinutes ?? 0),
    0
  ) ?? 0;
  const cooldown = session.cooldownMinutes ?? 5;

  const total = warmUp + training + cooldown;
  // If AI didn't provide any per-exercise durations, fall back to existing value or default
  if (training === 0) {
    return session.estimatedMinutes || 45;
  }
  return Math.round(total);
}

/**
 * Calculate estimatedMinutes for each session in an array, mutating in place.
 */
export function calculateAllSessionMinutes(sessions: PlanSession[]): PlanSession[] {
  for (const session of sessions) {
    session.estimatedMinutes = calculateSessionMinutes(session);
  }
  return sessions;
}

/**
 * Calculate total hours for a week by summing all session durations.
 */
export function calculateWeekTotalHours(sessions: PlanSession[]): number {
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);
  return Math.round(totalMinutes / 60 * 10) / 10;
}

/**
 * Scale target scores for difficulty adjustment.
 * Scales the remaining gap between current and target by the given factor.
 * Caps at 100, floors at current + 1 to preserve a training gap.
 * Skips maintenance dimensions (current >= target).
 */
export function scaleDifficultyTargets(
  currentScores: DimensionScores,
  targetScores: DimensionScores,
  scaleFactor: number
): DimensionScores {
  const result = { ...targetScores };

  for (const dim of DIMENSIONS) {
    const current = currentScores[dim];
    const target = targetScores[dim];
    const gap = target - current;

    if (gap <= 0) continue; // maintenance dimension, skip

    const newTarget = current + gap * scaleFactor;
    result[dim] = Math.min(100, Math.max(current + 1, Math.round(newTarget)));
  }

  return result;
}

export interface DimensionProgress {
  /** For normal dimensions: percentage of graduation targets (0-100).
   *  For maintenance dimensions: volume percentage (always 60). */
  fraction: number;
  /** True if dimension significantly exceeds target (current >= 1.25x target) */
  maintenance: boolean;
}

/**
 * Calculate per-dimension progress fractions for a given week.
 *
 * Three tiers:
 * - current >= 1.25 * target: MAINTENANCE MODE — 60% fixed, 1 session/week
 * - current >= target: floor 80%, progresses to 100%
 * - current < target: floor = max(50%, current/target), progresses to 100%
 *
 * Progress at week N = floor + (1 - floor) * (N / totalWeeks)
 */
export function dimensionProgressFractions(
  currentScores: DimensionScores,
  targetScores: DimensionScores,
  weekNumber: number,
  totalWeeks: number
): Record<string, DimensionProgress> {
  const result: Record<string, DimensionProgress> = {};

  for (const dim of DIMENSIONS) {
    const current = currentScores[dim];
    const target = targetScores[dim];

    // Significantly exceeds target → maintenance mode
    if (target > 0 && current >= 1.25 * target) {
      result[dim] = { fraction: 60, maintenance: true };
      continue;
    }

    let floor: number;
    if (target <= 0) {
      floor = 0.5;
    } else if (current >= target) {
      floor = 0.8;
    } else {
      floor = Math.max(0.5, current / target);
    }

    const progress = floor + (1 - floor) * (weekNumber / totalWeeks);
    result[dim] = {
      fraction: Math.round(Math.min(progress, 1.0) * 100),
      maintenance: false,
    };
  }

  return result;
}

/**
 * Classify the gap between current and target scores for cardio, strength,
 * and climbing_technical. Flexibility is excluded (always relative prescriptions).
 *
 * Aligns with existing maintenance thresholds:
 * - exceeds: current >= 1.25x target (matches maintenance mode trigger)
 * - on_target: current >= target
 * - achievable/stretch/very_challenging: based on points-per-week needed
 */
export function classifyGaps(
  currentScores: DimensionScores,
  targetScores: DimensionScores,
  totalWeeks: number
): GapAnalysis {
  const dims: Array<'cardio' | 'strength' | 'climbing_technical'> = [
    'cardio', 'strength', 'climbing_technical',
  ];

  const result = {} as GapAnalysis;

  for (const dim of dims) {
    const current = currentScores[dim];
    const target = targetScores[dim];
    const gap = target - current;

    if (target > 0 && current >= 1.25 * target) {
      result[dim] = { classification: 'exceeds', gap, pointsPerWeek: 0 };
    } else if (current >= target) {
      result[dim] = { classification: 'on_target', gap, pointsPerWeek: 0 };
    } else {
      const ppw = totalWeeks > 0 ? gap / totalWeeks : gap;
      let classification: GapClassification;
      if (ppw <= 2.5) {
        classification = 'achievable';
      } else if (ppw <= 4.0) {
        classification = 'stretch';
      } else {
        classification = 'very_challenging';
      }
      result[dim] = { classification, gap, pointsPerWeek: Math.round(ppw * 10) / 10 };
    }
  }

  return result;
}
