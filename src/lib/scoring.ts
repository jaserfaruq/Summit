import { DimensionScores, PlanSession, WeekType } from "./types";

/**
 * Calculate dimension score from benchmark results.
 * Formula: avg(min(result/target, 1.0)) × targetScore
 *
 * When currentScore is provided and exceeds targetScore (maintenance dimension),
 * the score is uncapped: avg(result/graduationTarget) × targetScore, floored
 * at currentScore to prevent regression from testing.
 */
export function calculateDimensionScore(
  benchmarkResults: { result: number; graduationTarget: number }[],
  targetScore: number,
  currentScore?: number
): number {
  if (benchmarkResults.length === 0) return 0;

  const isMaintenanceDim = currentScore !== undefined && currentScore >= targetScore;

  if (isMaintenanceDim) {
    // Uncapped: allow scores above targetScore for strong athletes
    const avg =
      benchmarkResults.reduce((sum, b) => {
        return sum + b.result / b.graduationTarget;
      }, 0) / benchmarkResults.length;
    // Never drop below current score due to benchmark testing
    return Math.max(Math.round(avg * targetScore), currentScore);
  }

  // Standard capped formula for dimensions still building toward target
  const avg =
    benchmarkResults.reduce((sum, b) => {
      return sum + Math.min(b.result / b.graduationTarget, 1.0);
    }, 0) / benchmarkResults.length;
  return Math.round(avg * targetScore);
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
 * Check if any dimension deviates enough to trigger rebalancing.
 */
export function checkRebalanceTrigger(
  actual: DimensionScores,
  expected: DimensionScores,
  weekType: WeekType
): { triggered: boolean; dimensions: string[]; tier: 1 | 2 } {
  if (weekType === "taper") {
    return { triggered: false, dimensions: [], tier: 1 };
  }

  const threshold = weekType === "test" ? 3 : 5;
  const tier = weekType === "test" ? 1 : 2;
  const dimensions: string[] = [];

  for (const dim of ["cardio", "strength", "climbing_technical", "flexibility"] as const) {
    if (expected[dim] - actual[dim] >= threshold) {
      dimensions.push(dim);
    }
  }

  return { triggered: dimensions.length > 0, dimensions, tier };
}

/**
 * Generate week schedule for a plan of N weeks.
 * Test weeks on week 2 and the middle of the plan. No recovery weeks.
 */
export function generateWeekSchedule(totalWeeks: number): WeekType[] {
  const schedule: WeekType[] = new Array(totalWeeks).fill("regular");

  // Last 2 weeks are always taper
  if (totalWeeks >= 2) {
    schedule[totalWeeks - 1] = "taper";
    schedule[totalWeeks - 2] = "taper";
  }

  const taperStart = totalWeeks - 2;

  // Test week on week 2 (0-indexed: 1)
  if (totalWeeks > 4 && 1 < taperStart) {
    schedule[1] = "test";
  }

  // Test week at the midpoint of the plan (before taper)
  if (totalWeeks > 4) {
    const midWeek = Math.floor(taperStart / 2);
    if (midWeek > 1 && midWeek < taperStart) {
      schedule[midWeek] = "test";
    }
  }

  return schedule;
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
  const dimensions = ["cardio", "strength", "climbing_technical", "flexibility"] as const;
  const result: Record<string, DimensionProgress> = {};

  for (const dim of dimensions) {
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
