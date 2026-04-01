import { describe, it, expect } from 'vitest';
import {
  calculateScoreFromRatings,
  expectedScoreAtWeek,
  expectedScoresAtWeek,
  shouldHighlightRebalance,
  scoreArcColor,
  scaleDifficultyTargets,
  dimensionProgressFractions,
  classifyGaps,
} from '../scoring';
import type { DimensionScores } from '../types';

// ============================================
// calculateScoreFromRatings
// ============================================
describe('calculateScoreFromRatings', () => {
  it('applies -1 regression when no ratings', () => {
    expect(calculateScoreFromRatings([], 5, 30)).toBe(29);
  });

  it('floors at 0 on regression', () => {
    expect(calculateScoreFromRatings([], 5, 0)).toBe(0);
  });

  it('applies full gain for rating 3', () => {
    // multiplier = 1.0, so newScore = 30 + 5 * 1.0 = 35
    expect(calculateScoreFromRatings([3], 5, 30)).toBe(35);
  });

  it('applies zero gain for rating 1', () => {
    // multiplier = 0, so newScore = 30 + 5 * 0 = 30
    expect(calculateScoreFromRatings([1], 5, 30)).toBe(30);
  });

  it('applies half gain for rating 2', () => {
    // multiplier = 0.5, so newScore = 30 + 10 * 0.5 = 35
    expect(calculateScoreFromRatings([2], 10, 30)).toBe(35);
  });

  it('applies 1.25x gain for rating 4', () => {
    // multiplier = 1.25, so newScore = 30 + 8 * 1.25 = 40
    expect(calculateScoreFromRatings([4], 8, 30)).toBe(40);
  });

  it('applies 1.5x gain for rating 5', () => {
    // multiplier = 1.5, so newScore = 30 + 10 * 1.5 = 45
    expect(calculateScoreFromRatings([5], 10, 30)).toBe(45);
  });

  it('averages multiple ratings and rounds', () => {
    // avg of [2, 4] = 3, rounds to 3, multiplier = 1.0
    expect(calculateScoreFromRatings([2, 4], 10, 30)).toBe(40);
  });

  it('uses aiMultiplier when provided, ignoring ratings', () => {
    // aiMultiplier = 0.75, so newScore = 30 + 10 * 0.75 = 37.5 -> 38
    expect(calculateScoreFromRatings([1], 10, 30, 0.75)).toBe(38);
  });

  it('never goes below 0', () => {
    expect(calculateScoreFromRatings([1], -50, 10)).toBe(10);
  });
});

// ============================================
// expectedScoreAtWeek
// ============================================
describe('expectedScoreAtWeek', () => {
  it('interpolates linearly', () => {
    // current=20, target=60, week 5 of 10 = 20 + 40 * 0.5 = 40
    expect(expectedScoreAtWeek(20, 60, 5, 10)).toBe(40);
  });

  it('returns target at final week', () => {
    expect(expectedScoreAtWeek(20, 60, 10, 10)).toBe(60);
  });

  it('returns current at week 0', () => {
    expect(expectedScoreAtWeek(20, 60, 0, 10)).toBe(20);
  });

  it('holds at current when current exceeds target (maintenance)', () => {
    expect(expectedScoreAtWeek(80, 60, 5, 10)).toBe(80);
  });
});

// ============================================
// expectedScoresAtWeek
// ============================================
describe('expectedScoresAtWeek', () => {
  it('interpolates all dimensions', () => {
    const current: DimensionScores = { cardio: 20, strength: 30, climbing_technical: 10, flexibility: 40 };
    const target: DimensionScores = { cardio: 60, strength: 50, climbing_technical: 50, flexibility: 60 };
    const result = expectedScoresAtWeek(current, target, 5, 10);
    expect(result.cardio).toBe(40);
    expect(result.strength).toBe(40);
    expect(result.climbing_technical).toBe(30);
    expect(result.flexibility).toBe(50);
  });
});

// ============================================
// shouldHighlightRebalance
// ============================================
describe('shouldHighlightRebalance', () => {
  it('returns recommended when any dimension is 5+ points off', () => {
    const actual: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const expected: DimensionScores = { cardio: 30, strength: 46, climbing_technical: 20, flexibility: 30 };
    const result = shouldHighlightRebalance(actual, expected);
    expect(result.recommended).toBe(true);
    expect(result.dimensions).toContain('strength');
  });

  it('returns not recommended when all within 5 points', () => {
    const actual: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const expected: DimensionScores = { cardio: 32, strength: 42, climbing_technical: 22, flexibility: 33 };
    const result = shouldHighlightRebalance(actual, expected);
    expect(result.recommended).toBe(false);
    expect(result.dimensions).toHaveLength(0);
  });

  it('detects gap of exactly 5', () => {
    const actual: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const expected: DimensionScores = { cardio: 35, strength: 40, climbing_technical: 20, flexibility: 30 };
    const result = shouldHighlightRebalance(actual, expected);
    expect(result.recommended).toBe(true);
  });
});

// ============================================
// scoreArcColor
// ============================================
describe('scoreArcColor', () => {
  it('returns green when current >= target', () => {
    expect(scoreArcColor(60, 50)).toBe('green');
  });

  it('returns green when gap <= 10', () => {
    expect(scoreArcColor(45, 55)).toBe('green');
  });

  it('returns yellow when gap is 11-24', () => {
    expect(scoreArcColor(30, 50)).toBe('yellow');
  });

  it('returns red when gap >= 25', () => {
    expect(scoreArcColor(10, 60)).toBe('red');
  });

  it('returns green at exact boundary (gap = 10)', () => {
    expect(scoreArcColor(40, 50)).toBe('green');
  });

  it('returns yellow at gap = 11', () => {
    expect(scoreArcColor(39, 50)).toBe('yellow');
  });

  it('returns red at gap = 25', () => {
    expect(scoreArcColor(25, 50)).toBe('red');
  });
});

// ============================================
// scaleDifficultyTargets
// ============================================
describe('scaleDifficultyTargets', () => {
  const current: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 50 };
  const target: DimensionScores = { cardio: 60, strength: 70, climbing_technical: 50, flexibility: 70 };

  it('scales gap by factor (easier)', () => {
    const result = scaleDifficultyTargets(current, target, 0.6);
    // cardio: 30 + 30*0.6 = 48
    expect(result.cardio).toBe(48);
    // strength: 40 + 30*0.6 = 58
    expect(result.strength).toBe(58);
  });

  it('scales gap by factor (harder)', () => {
    const result = scaleDifficultyTargets(current, target, 1.5);
    // cardio: 30 + 30*1.5 = 75
    expect(result.cardio).toBe(75);
  });

  it('caps at 100', () => {
    const result = scaleDifficultyTargets(current, target, 3.0);
    // cardio: 30 + 30*3 = 120 -> capped at 100
    expect(result.cardio).toBe(100);
  });

  it('floors at current + 1', () => {
    const result = scaleDifficultyTargets(current, target, 0.01);
    // cardio: 30 + 30*0.01 = 30.3 -> floor at 31
    expect(result.cardio).toBe(31);
  });

  it('skips maintenance dimensions (current >= target)', () => {
    const maintenanceCurrent: DimensionScores = { cardio: 70, strength: 40, climbing_technical: 20, flexibility: 50 };
    const result = scaleDifficultyTargets(maintenanceCurrent, target, 0.6);
    // cardio: gap <= 0, skip — keeps original target
    expect(result.cardio).toBe(60);
  });
});

// ============================================
// dimensionProgressFractions
// ============================================
describe('dimensionProgressFractions', () => {
  it('returns maintenance mode when current >= 1.25x target', () => {
    const current: DimensionScores = { cardio: 80, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = dimensionProgressFractions(current, target, 5, 10);
    expect(result.cardio.maintenance).toBe(true);
    expect(result.cardio.fraction).toBe(60);
  });

  it('uses 80% floor when current >= target but < 1.25x', () => {
    const current: DimensionScores = { cardio: 65, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = dimensionProgressFractions(current, target, 5, 10);
    // floor = 0.8, progress = 0.8 + 0.2 * (5/10) = 0.9, fraction = 90
    expect(result.cardio.maintenance).toBe(false);
    expect(result.cardio.fraction).toBe(90);
  });

  it('uses max(50%, current/target) floor when below target', () => {
    const current: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = dimensionProgressFractions(current, target, 0, 10);
    // cardio: current/target = 0.5 = floor. progress at week 0 = 0.5. fraction = 50
    expect(result.cardio.fraction).toBe(50);
  });

  it('progresses toward 100% at final week', () => {
    const current: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = dimensionProgressFractions(current, target, 10, 10);
    expect(result.cardio.fraction).toBe(100);
  });
});

// ============================================
// classifyGaps
// ============================================
describe('classifyGaps', () => {
  it('classifies exceeds when current >= 1.25x target', () => {
    const current: DimensionScores = { cardio: 80, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = classifyGaps(current, target, 10);
    expect(result.cardio.classification).toBe('exceeds');
  });

  it('classifies on_target when current >= target', () => {
    const current: DimensionScores = { cardio: 65, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    const result = classifyGaps(current, target, 10);
    expect(result.cardio.classification).toBe('on_target');
  });

  it('classifies achievable when ppw <= 2.5', () => {
    const current: DimensionScores = { cardio: 40, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    // cardio: gap=20, ppw=20/10=2.0 -> achievable
    const result = classifyGaps(current, target, 10);
    expect(result.cardio.classification).toBe('achievable');
  });

  it('classifies stretch when ppw 2.5-4.0', () => {
    const current: DimensionScores = { cardio: 30, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    // cardio: gap=30, ppw=30/10=3.0 -> stretch
    const result = classifyGaps(current, target, 10);
    expect(result.cardio.classification).toBe('stretch');
  });

  it('classifies very_challenging when ppw > 4.0', () => {
    const current: DimensionScores = { cardio: 10, strength: 40, climbing_technical: 20, flexibility: 30 };
    const target: DimensionScores = { cardio: 60, strength: 60, climbing_technical: 50, flexibility: 50 };
    // cardio: gap=50, ppw=50/10=5.0 -> very_challenging
    const result = classifyGaps(current, target, 10);
    expect(result.cardio.classification).toBe('very_challenging');
  });
});
