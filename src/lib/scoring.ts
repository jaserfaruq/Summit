import { DimensionScores, WeekType } from "./types";

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
  if (weekType === "recovery" || weekType === "taper") {
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
 * Based on the 16-week example pattern from the spec.
 */
export function generateWeekSchedule(totalWeeks: number): WeekType[] {
  const schedule: WeekType[] = new Array(totalWeeks).fill("regular");

  // Last 2 weeks are always taper
  if (totalWeeks >= 2) {
    schedule[totalWeeks - 1] = "taper";
    schedule[totalWeeks - 2] = "taper";
  }

  // Place test weeks approximately every 4 weeks
  // Week 2 is the first (optional early calibration) test
  const testWeeks: number[] = [];
  if (totalWeeks > 4) {
    testWeeks.push(1); // week 2 (0-indexed: 1)

    // Then every ~4 weeks after that
    let nextTest = 4; // week 5 (0-indexed: 4)
    while (nextTest < totalWeeks - 2) {
      testWeeks.push(nextTest);
      nextTest += 4;
    }
  }

  for (const tw of testWeeks) {
    if (tw < totalWeeks - 2) {
      schedule[tw] = "test";
      // Recovery week after each test (except if it would be in taper)
      if (tw + 1 < totalWeeks - 2) {
        schedule[tw + 1] = "recovery";
      }
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
