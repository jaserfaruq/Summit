# Plan: Simplify Scoring System — 1-5 Self-Rating

## Summary of Changes

Replace benchmark-based scoring and test weeks with a simple 1-5 self-rating per dimension per session. Scores update via a multiplier on expected weekly gain. Rebalancing becomes manual (user-triggered button). Graduation benchmarks remain as display-only aspirational targets.

## Decisions

- **Week types**: All uniform (taper baked into plan generation prompt, not a special type)
- **Rating**: Per dimension per session, 1-5 scale
- **Score math**: Multiplier on expected gain (1→0x, 2→0.5x, 3→1x, 4→1.25x, 5→1.5x)
- **Benchmarks**: Keep in DB and display, remove from scoring
- **Rebalancing**: Manual button always visible, highlighted when off-track, regenerates all remaining weeks
- **AI prompts**: Remove Prompt 3 (weekly AI eval). Keep Prompt 4 (rebalance) but trigger manually. Keep Prompt 1 (graduation benchmarks display-only).
- **Feedback**: After completing week, show scores + trajectory gap + plain-language summary

---

## Step-by-step Implementation

### 1. Update Types (`src/lib/types.ts`)
- Add `SessionRating` interface: `{ sessionName: string, dimension: Dimension, rating: 1|2|3|4|5 }`
- Add `WeekCompletionFeedback` interface: `{ updatedScores, expectedScores, gaps: Record<Dimension, number>, summary: string }`
- Remove `WeekType` type (or change to just `"regular"`)
- Keep `BenchmarkResult` and `GraduationBenchmark` types (display-only) but mark as display-only
- Update `WorkoutLog` to include `rating: number` field
- Update `CompleteWeekRequest` to accept ratings instead of benchmark_results
- Update `CompleteWeekResponse` to include trajectory feedback

### 2. Update Scoring Logic (`src/lib/scoring.ts`)
- Remove `calculateDimensionScore()` (benchmark formula)
- Add `calculateScoreFromRatings(ratings: number[], expectedGain: number, currentScore: number): number`
  - Average ratings for dimension → multiplier: `{1: 0, 2: 0.5, 3: 1.0, 4: 1.25, 5: 1.5}`
  - New score = `currentScore + (expectedGain × multiplier)`
  - Cap at target score (or allow slight overshoot?)
- Remove `generateWeekSchedule()` (no week types)
- Keep `expectedScoresAtWeek()` (still need linear interpolation for trajectory)
- Remove `checkRebalanceTrigger()` (no auto-rebalance)
- Add `generateCompletionSummary(actual, expected, target): string` — plain-language feedback
- Add `shouldHighlightRebalance(actual, expected): boolean` — true if any dimension 5+ pts off

### 3. Update Complete-Week API (`src/app/api/complete-week/route.ts`)
- Remove all test-week logic (benchmark extraction, `calculateDimensionScore` calls)
- Remove all regular-week AI evaluation (Prompt 3 call)
- New logic: accept `ratings: SessionRating[]`, group by dimension, calculate score updates using multiplier formula
- Return `WeekCompletionFeedback` with scores, gaps, and summary
- Remove auto-rebalance trigger — just return scores

### 4. Update Rebalance API (`src/app/api/rebalance/route.ts`)
- Remove tier 1/tier 2 distinction
- Accept manual trigger: `{ planId, currentWeek }`
- Fetch current scores, expected scores, target scores
- Call Prompt 4 (updated) to regenerate all remaining weeks
- Return updated weeks

### 5. Update Plan Generation (`src/app/api/generate-plan/route.ts`)
- Remove test week scheduling from week schedule generation
- Remove `weekType` differentiation — all weeks are regular
- Bake taper into the prompt: "Reduce volume by 40% in the final 2 weeks before the objective date"
- Remove benchmark session flags from session generation
- Update Prompt 2/2B in `src/lib/prompts.ts`:
  - Remove test week instructions
  - Remove benchmark session requirements
  - Remove week type concept
  - Add taper instruction as part of periodization

### 6. Update AI Prompts (`src/lib/prompts.ts`)
- **Prompt 1 (estimate-scores)**: Keep mostly as-is. Graduation benchmarks still generated for display.
- **Prompt 2/2B (plan generation)**: Remove test week/benchmark session instructions. Add taper baked in. Remove `isBenchmarkSession` from output schema.
- **Prompt 3 (weekly eval)**: DELETE entirely
- **Prompt 4 (rebalance)**: Simplify — no tier distinction, just "regenerate remaining weeks given current vs target scores"

### 7. Update Workout Logging UI (`src/app/(app)/log/page.tsx`)
- Remove benchmark results form section
- Remove benchmark auto-detection from sessions
- Add 1-5 rating selector per dimension for the session being logged
- Rating UI: 5 buttons/radio with descriptions (1="Way too hard"...5="Way too easy")
- "Mark Complete" quick-log: default to rating 3 (as prescribed = right challenge level)
- Still allow "Log Different" for custom entries with rating

### 8. Update Plan Page (`src/app/(app)/plan/page.tsx`)
- Remove week type badges (WeekBadge component)
- Remove test week / benchmark session highlighting (blue stars, blue borders)
- Add "Rebalance Plan" button — always visible, highlighted (orange/accent) when any dimension 5+ pts off trajectory
- After "Complete Week": show feedback modal with scores, trajectory gaps, and plain-language summary
- Keep graduation workouts section as display-only "finish line"
- Remove `isBenchmarkSession` visual indicators from session cards

### 9. Update Dashboard (`src/app/(app)/dashboard/page.tsx`)
- Remove "Estimated scores — take your first benchmark test" banner
- Keep score arcs (they work with any scoring system)
- Update "This week" section: remove benchmark session indicators

### 10. Update Progress Page (`src/app/(app)/progress/page.tsx`)
- Remove test week vs regular week dot distinction (all dots same size/style)
- Remove "Test" vs "Estimate" type badges in score table
- Keep the chart otherwise as-is

### 11. Update/Remove WeekBadge Component (`src/components/WeekBadge.tsx`)
- Remove or replace with a simple week number display

### 12. Database Migration (new migration file)
- Add `rating INT` column to `workout_logs` (1-5 scale)
- Remove `is_test_week` and `confidence` from `score_history` (or leave for backward compat)
- Update `weekly_targets.week_type` default to `'regular'` (or remove column)
- Keep `benchmark_exercises` table (display-only)
- Keep `graduation_benchmarks` in objectives (display-only)

### 13. Update CLAUDE.md
- Update scoring rules section
- Update week types table
- Remove benchmark scoring formula
- Update API route descriptions
- Remove Prompt 3 section
- Update Prompt 2 and Prompt 4 descriptions
