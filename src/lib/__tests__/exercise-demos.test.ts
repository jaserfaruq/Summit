import { describe, it, expect } from 'vitest';
import {
  normalizeExerciseName,
  lookupExerciseDemo,
  EXERCISE_DEMO_MAP,
} from '../exercise-demos';

// ============================================
// normalizeExerciseName
// ============================================
describe('normalizeExerciseName', () => {
  it('lowercases a simple name', () => {
    expect(normalizeExerciseName('Push-Ups')).toBe('push-ups');
  });

  it('strips weight annotation with @ symbol', () => {
    expect(normalizeExerciseName('Loaded Step-Ups @ 35lb')).toBe('step-ups');
  });

  it('strips parenthetical content', () => {
    expect(
      normalizeExerciseName('Hangboard Repeaters (7s on/3s off, half crimp)')
    ).toBe('hangboard repeaters');
  });

  it('strips descriptor prefix and parenthetical', () => {
    expect(
      normalizeExerciseName('Single-Leg Step-Down (slow eccentric)')
    ).toBe('step-down');
  });

  it('strips rep/set patterns', () => {
    expect(normalizeExerciseName('3x10 Push-Ups')).toBe('push-ups');
  });

  it('preserves compound names', () => {
    expect(normalizeExerciseName('Farmer Carries')).toBe('farmer carries');
  });

  it('strips "Weighted" prefix', () => {
    expect(normalizeExerciseName('Weighted Pull-Ups')).toBe('pull-ups');
  });

  it('strips "Banded" prefix', () => {
    expect(normalizeExerciseName('Banded Face Pulls')).toBe('face pulls');
  });

  it('preserves "Dead Hangs" as-is', () => {
    expect(normalizeExerciseName('Dead Hangs')).toBe('dead hangs');
  });

  it('preserves names with no prefix to strip', () => {
    expect(normalizeExerciseName('Hip Flexor Stretch Hold')).toBe(
      'hip flexor stretch hold'
    );
  });

  it('strips weight in kg', () => {
    expect(normalizeExerciseName('Squats 50kg')).toBe('squats');
  });

  it('strips weight in lbs with space', () => {
    expect(normalizeExerciseName('Step-Ups 25 lbs')).toBe('step-ups');
  });

  it('strips "Alternating" prefix', () => {
    expect(normalizeExerciseName('Alternating Lunges')).toBe('lunges');
  });

  it('strips "Single-Arm" prefix', () => {
    expect(normalizeExerciseName('Single-Arm Kettlebell Press')).toBe(
      'press'
    );
  });

  it('strips multiple modifiers at once', () => {
    expect(
      normalizeExerciseName('Loaded Single-Leg Step-Ups @ 35lb (slow tempo)')
    ).toBe('step-ups');
  });

  it('handles timing patterns in name', () => {
    expect(normalizeExerciseName('Plank Hold 60sec')).toBe('plank hold');
  });

  it('handles sets notation', () => {
    expect(normalizeExerciseName('5 sets Push-Ups')).toBe('push-ups');
  });

  it('handles reps notation', () => {
    expect(normalizeExerciseName('20 reps Squats')).toBe('squats');
  });

  it('collapses extra whitespace', () => {
    expect(normalizeExerciseName('  Pull-Ups   ')).toBe('pull-ups');
  });

  it('strips "with {equipment}" patterns', () => {
    expect(normalizeExerciseName('Walking lunges with dumbbells')).toBe('walking lunges');
  });

  it('strips "with" after weight removal', () => {
    expect(normalizeExerciseName('Squats with 25lb barbell')).toBe('squats');
  });

  it('strips trailing descriptive phrases', () => {
    expect(normalizeExerciseName('Deep squat holds at your comfortable depth')).toBe('deep squat holds');
  });

  it('strips "on each side" suffix', () => {
    expect(normalizeExerciseName('Romanian Deadlifts on each side')).toBe('romanian deadlifts');
  });

  it('strips "for time" suffix', () => {
    expect(normalizeExerciseName('Farmer carries for time')).toBe('farmer carries');
  });

  it('strips distance patterns', () => {
    expect(normalizeExerciseName('Trail run 5 miles')).toBe('trail run');
  });

  it('strips "Barbell" prefix', () => {
    expect(normalizeExerciseName('Barbell Overhead Press')).toBe('overhead press');
  });

  it('strips "Dumbbell" prefix', () => {
    expect(normalizeExerciseName('Dumbbell Rows')).toBe('rows');
  });
});

// ============================================
// lookupExerciseDemo — exact matches
// ============================================
describe('lookupExerciseDemo — exact matches', () => {
  it('finds pull-ups with simple capitalized input', () => {
    const result = lookupExerciseDemo('Pull-Ups');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['pull-ups'].youtubeId
    );
    expect(result.curated!.channelName).toBeTruthy();
  });

  it('finds squats', () => {
    const result = lookupExerciseDemo('Squats');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['squats'].youtubeId
    );
  });

  it('finds dead hangs', () => {
    const result = lookupExerciseDemo('Dead Hangs');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['dead hangs'].youtubeId
    );
  });

  it('finds farmer carries', () => {
    const result = lookupExerciseDemo('Farmer Carries');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['farmer carries'].youtubeId
    );
  });

  it('finds planks', () => {
    const result = lookupExerciseDemo('Planks');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['planks'].youtubeId
    );
  });

  it('finds turkish get-ups', () => {
    const result = lookupExerciseDemo('Turkish Get-Ups');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['turkish get-ups'].youtubeId
    );
  });

  it('finds pigeon pose', () => {
    const result = lookupExerciseDemo('Pigeon Pose');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['pigeon pose'].youtubeId
    );
  });
});

// ============================================
// lookupExerciseDemo — fuzzy matches
// ============================================
describe('lookupExerciseDemo — fuzzy matches', () => {
  it('matches "Loaded Step-Ups @ 35lb" to step-ups', () => {
    const result = lookupExerciseDemo('Loaded Step-Ups @ 35lb');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['step-ups'].youtubeId
    );
  });

  it('matches "Weighted Pull-Ups" to pull-ups', () => {
    const result = lookupExerciseDemo('Weighted Pull-Ups');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['pull-ups'].youtubeId
    );
  });

  it('matches "3x10 Push-Ups" to push-ups', () => {
    const result = lookupExerciseDemo('3x10 Push-Ups');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['push-ups'].youtubeId
    );
  });

  it('matches "Single-Leg Step-Ups (slow eccentric)" to step-ups via contains', () => {
    const result = lookupExerciseDemo('Single-Leg Step-Ups (slow eccentric)');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['step-ups'].youtubeId
    );
  });

  it('matches "Hip Flexor Stretches with Band" to hip flexor stretches via starts-with', () => {
    const result = lookupExerciseDemo('Hip Flexor Stretches with Band');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['hip flexor stretches'].youtubeId
    );
  });

  it('matches "Barbell Deadlifts" to deadlifts via contains', () => {
    const result = lookupExerciseDemo('Barbell Deadlifts');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(
      EXERCISE_DEMO_MAP['deadlifts'].youtubeId
    );
  });
});

// ============================================
// lookupExerciseDemo — new curated matches
// ============================================
describe('lookupExerciseDemo — new curated exercises', () => {
  it('finds bulgarian split squats', () => {
    const result = lookupExerciseDemo('Bulgarian Split Squats');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.channelName).toBe('ATHLEAN-X');
  });

  it('finds russian twists', () => {
    const result = lookupExerciseDemo('Russian Twists');
    expect(result.curated).not.toBeNull();
  });

  it('finds face pulls', () => {
    const result = lookupExerciseDemo('Face Pulls');
    expect(result.curated).not.toBeNull();
  });

  it('finds rucking', () => {
    const result = lookupExerciseDemo('Rucking');
    expect(result.curated).not.toBeNull();
  });

  it('matches verbose AI description to curated entry', () => {
    const result = lookupExerciseDemo('Deep squat holds at your comfortable depth');
    expect(result.curated).not.toBeNull();
  });

  it('matches "Walking Lunges with 25lb dumbbells" to walking lunges', () => {
    const result = lookupExerciseDemo('Walking Lunges with 25lb dumbbells');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.youtubeId).toBe(EXERCISE_DEMO_MAP['walking lunges'].youtubeId);
  });

  it('finds dips', () => {
    const result = lookupExerciseDemo('Dips');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.channelName).toBe('Jeff Nippard');
  });

  it('finds rowing', () => {
    const result = lookupExerciseDemo('Rowing');
    expect(result.curated).not.toBeNull();
    expect(result.curated!.channelName).toBe('concept2usa');
  });
});

// ============================================
// lookupExerciseDemo — no match
// ============================================
describe('lookupExerciseDemo — no match', () => {
  it('returns null curated for an unknown exercise', () => {
    const result = lookupExerciseDemo('Obscure Exercise');
    expect(result.curated).toBeNull();
  });

  it('still returns valid search URLs for unknown exercises', () => {
    const result = lookupExerciseDemo('Obscure Exercise');
    expect(result.searchQuery).toBe('Obscure Exercise exercise demonstration');
    expect(result.youtubeSearchUrl).toContain(
      'https://www.youtube.com/results?search_query='
    );
    expect(result.googleSearchUrl).toContain(
      'https://www.google.com/search?tbm=isch&q='
    );
  });
});

// ============================================
// lookupExerciseDemo — search URLs
// ============================================
describe('lookupExerciseDemo — search URLs', () => {
  it('builds correct YouTube search URL', () => {
    const result = lookupExerciseDemo('Pull-Ups');
    expect(result.youtubeSearchUrl).toBe(
      'https://www.youtube.com/results?search_query=Pull-Ups%20exercise%20demonstration'
    );
  });

  it('builds correct Google search URL', () => {
    const result = lookupExerciseDemo('Pull-Ups');
    expect(result.googleSearchUrl).toBe(
      'https://www.google.com/search?tbm=isch&q=Pull-Ups%20exercise%20demonstration'
    );
  });

  it('properly encodes special characters in search URLs', () => {
    const result = lookupExerciseDemo('Step-Ups @ 35lb');
    expect(result.youtubeSearchUrl).toContain(
      'search_query=Step-Ups%20%40%2035lb'
    );
  });

  it('search query uses original exercise name', () => {
    const result = lookupExerciseDemo('Loaded Step-Ups @ 35lb');
    expect(result.searchQuery).toBe(
      'Loaded Step-Ups @ 35lb exercise demonstration'
    );
  });

  it('youtubeSearchUrl starts with correct base URL', () => {
    const result = lookupExerciseDemo('Anything');
    expect(result.youtubeSearchUrl.startsWith('https://www.youtube.com/results')).toBe(true);
  });

  it('googleSearchUrl starts with correct base URL', () => {
    const result = lookupExerciseDemo('Anything');
    expect(result.googleSearchUrl.startsWith('https://www.google.com/search')).toBe(true);
  });
});

// ============================================
// EXERCISE_DEMO_MAP — data integrity
// ============================================
describe('EXERCISE_DEMO_MAP — data integrity', () => {
  it('contains at least 100 curated entries', () => {
    expect(Object.keys(EXERCISE_DEMO_MAP).length).toBeGreaterThanOrEqual(100);
  });

  it('all entries have non-empty youtubeId', () => {
    for (const [key, demo] of Object.entries(EXERCISE_DEMO_MAP)) {
      expect(demo.youtubeId, `${key} should have youtubeId`).toBeTruthy();
      expect(demo.youtubeId.length, `${key} youtubeId should be 11 chars`).toBe(11);
    }
  });

  it('all entries have non-empty title', () => {
    for (const [key, demo] of Object.entries(EXERCISE_DEMO_MAP)) {
      expect(demo.title, `${key} should have title`).toBeTruthy();
    }
  });

  it('all entries have non-empty channelName', () => {
    for (const [key, demo] of Object.entries(EXERCISE_DEMO_MAP)) {
      expect(demo.channelName, `${key} should have channelName`).toBeTruthy();
    }
  });

  it('all map keys are lowercase', () => {
    for (const key of Object.keys(EXERCISE_DEMO_MAP)) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});
