import { DimensionScores, PlanSession, WeekType } from "./types";

/**
 * Calculate dimension score from benchmark results.
 * Formula: avg(min(result/target, 1.0)) × targetScore
 */
export function calculateDimensionScore(
  benchmarkResults: { result: number; graduationTarget: number }[],
  targetScore: number
): number {
  if (benchmarkResults.length === 0) return 0;
  const avg =
    benchmarkResults.reduce((sum, b) => {
      return sum + Math.min(b.result / b.graduationTarget, 1.0);
    }, 0) / benchmarkResults.length;
  return Math.round(avg * targetScore);
}

/**
 * Linear interpolation for expected scores at a given week.
 */
export function expectedScoreAtWeek(
  currentScore: number,
  targetScore: number,
  weekNumber: number,
  totalWeeks: number
): number {
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
  const gap = Math.abs(target - current);
  if (gap <= 10) return "green";
  if (gap <= 25) return "yellow";
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
