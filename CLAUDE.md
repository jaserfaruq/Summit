# Summit Planner — Implementation Specification v2

> **READ THIS FILE AT THE START OF EVERY SESSION.** This is the complete specification for Summit Planner, updated to reflect the current state of the codebase after the full-build audit (March 2026). Do not deviate from these schemas, scoring rules, or prompt designs without explicit instruction from the user. For product rationale, design history, and detailed context, see `docs/PRODUCT_GUIDE.md` in this repo.

-----

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database + Auth:** Supabase (PostgreSQL, Row Level Security, Auth with email/password)
- **AI:** Anthropic Claude API — `claude-opus-4-20250514` (all routes)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Prompt Caching:** `callClaudeWithCache()` with ephemeral cache control — used for session generation (Prompt 2B) and alternatives (Prompt 6)
- **SDK Versions:** `@anthropic-ai/sdk` ^0.78.0, `@supabase/ssr` ^0.9.0, `@supabase/supabase-js` ^2.99.1, `next` 14.2.35

## Design System

- **Primary:** #1B4D3E (dark forest green) — headers, primary buttons, active states
- **Accent:** #D4782F (burnt orange) — callouts, warnings, CTAs
- **Background:** #F4F1EC (warm cream) — page backgrounds
- **Mid:** #8B9D83 (sage) — secondary text, borders
- **Test week blue:** #1A5276 — test week banners, benchmark indicators
- **Recovery green:** #2E7D32 — recovery week banners
- **Taper amber:** #F57F17 — taper week banners
- **Score arc colors:** Green (current >= target OR gap ≤ 10), Yellow (gap 11–24), Red (gap ≥ 25)

-----

## Database Schema

### profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT,
  location TEXT,
  training_days_per_week INT DEFAULT 5,
  equipment_access TEXT[],
  is_validator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- Auto-profile creation trigger on signup
-- RLS: users can only read/update their own row
```

### validated_objectives

```sql
CREATE TABLE validated_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route TEXT NOT NULL,
  match_aliases TEXT[] NOT NULL,
  type TEXT NOT NULL,           -- hike | trail_run | alpine_climb | rock_climb | mountaineering | scramble | backpacking
  difficulty TEXT NOT NULL,     -- beginner | intermediate | advanced | expert
  description TEXT,
  summit_elevation_ft INT,
  total_gain_ft INT,
  distance_miles FLOAT,
  duration_days INT,
  technical_grade TEXT,
  tags JSONB NOT NULL,
  target_scores JSONB NOT NULL,
  taglines JSONB NOT NULL,
  relevance_profiles JSONB NOT NULL,
  graduation_benchmarks JSONB NOT NULL,
  recommended_weeks INT,
  created_by TEXT,
  last_reviewed DATE,
  status TEXT DEFAULT 'active'
);
-- RLS: readable by all authenticated users
```

### benchmark_exercises

```sql
CREATE TABLE benchmark_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  dimension TEXT NOT NULL,
  tags JSONB NOT NULL,
  equipment_required TEXT[],
  is_gym_reproducible BOOLEAN DEFAULT TRUE,
  difficulty_scale JSONB,
  measurement_type TEXT NOT NULL,
  measurement_unit TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'active'
);
-- RLS: readable by all authenticated users
```

### objectives

```sql
CREATE TABLE objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  target_date DATE NOT NULL,
  type TEXT NOT NULL,
  distance_miles FLOAT,
  elevation_gain_ft FLOAT,
  technical_grade TEXT,
  target_cardio_score INT NOT NULL,
  target_strength_score INT NOT NULL,
  target_climbing_score INT NOT NULL,
  target_flexibility_score INT NOT NULL,
  current_cardio_score INT DEFAULT 0,
  current_strength_score INT DEFAULT 0,
  current_climbing_score INT DEFAULT 0,
  current_flexibility_score INT DEFAULT 0,
  taglines JSONB NOT NULL,
  relevance_profiles JSONB NOT NULL,
  graduation_benchmarks JSONB NOT NULL,
  climbing_role TEXT,              -- lead | follow (set during assessment, affects climbing targets)
  matched_validated_id UUID REFERENCES validated_objectives(id),
  tier TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users can only see their own objectives
```

### assessments

```sql
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  objective_id UUID NOT NULL REFERENCES objectives(id),  -- assessment is per-objective
  assessed_at TIMESTAMPTZ DEFAULT now(),
  cardio_score INT NOT NULL,
  strength_score INT NOT NULL,
  climbing_score INT NOT NULL,
  flexibility_score INT NOT NULL,
  standard_answers JSONB NOT NULL,     -- Layer 1: structured question responses
  ai_questions JSONB,                  -- Layer 2: the AI-generated questions that were asked
  ai_answers JSONB,                    -- Layer 2: user's answers to AI questions
  freeform_text TEXT,                  -- optional "anything else" from user
  ai_reasoning JSONB,                  -- AI's per-dimension scoring explanation
  raw_data JSONB                       -- legacy / full dump
);
-- RLS: users own their assessments
-- Assessment is now per-objective (taken AFTER creating objective)
```

### score_history

```sql
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  objective_id UUID NOT NULL REFERENCES objectives(id),
  week_ending DATE NOT NULL,
  cardio_score INT NOT NULL,
  strength_score INT NOT NULL,
  climbing_score INT NOT NULL,
  flexibility_score INT NOT NULL,
  change_reason TEXT NOT NULL,  -- assessment | weekly_rating | rebalance
  is_test_week BOOLEAN DEFAULT FALSE,
  confidence TEXT DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users own their score history
```

### training_plans

```sql
CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  objective_id UUID NOT NULL REFERENCES objectives(id),
  assessment_id UUID REFERENCES assessments(id),
  current_week_number INT DEFAULT 1,  -- tracks active week, advances on completion
  created_at TIMESTAMPTZ DEFAULT now(),
  plan_data JSONB NOT NULL,
  graduation_workouts JSONB NOT NULL,
  status TEXT DEFAULT 'active'
);
-- RLS: users own their plans
```

### weekly_targets

```sql
CREATE TABLE weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id),
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  week_type TEXT NOT NULL,       -- test | recovery | regular | taper (currently all weeks generated as 'regular')
  total_hours FLOAT,
  expected_scores JSONB NOT NULL,
  sessions JSONB NOT NULL,
  weekly_report JSONB              -- AI-generated weekly report, stored after background generation
);
-- RLS: via plan ownership
```

### workout_logs

```sql
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  plan_id UUID REFERENCES training_plans(id),   -- links to plan
  week_number INT,                                -- links to specific week
  logged_date DATE NOT NULL,
  dimension TEXT NOT NULL,
  duration_min INT,
  details JSONB,
  benchmark_results JSONB,
  completed_as_prescribed BOOLEAN DEFAULT FALSE,
  rating INT,                    -- 1-5 scale
  rating_comment TEXT,           -- required when rating != 3
  session_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users own their logs
```

### component_feedback

```sql
CREATE TABLE component_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  objective_id UUID NOT NULL REFERENCES objectives(id),
  dimension TEXT NOT NULL,
  component_text TEXT NOT NULL,
  component_type TEXT NOT NULL,
  vote TEXT NOT NULL,
  objective_type TEXT,
  objective_tags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: validators can read/write; regular users cannot access
```

### partnerships

```sql
CREATE TABLE partnerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',          -- pending | accepted | declined
  requester_shares_scores BOOLEAN DEFAULT FALSE,   -- requester opts in to show scores
  recipient_shares_scores BOOLEAN DEFAULT FALSE,   -- recipient opts in to show scores
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_partnership UNIQUE (requester_id, recipient_id),
  CONSTRAINT no_self_partner CHECK (requester_id != recipient_id)
);
-- Indexes on requester_id+status and recipient_id+status
-- RLS: users can only see/modify partnerships they are part of
```

### partner_notifications

```sql
CREATE TABLE partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),          -- who receives the notification
  partner_id UUID NOT NULL REFERENCES profiles(id),        -- the matched partner
  partner_name TEXT NOT NULL,                               -- denormalized for display
  partnership_id UUID NOT NULL REFERENCES partnerships(id), -- link to the partnership
  week_number INT NOT NULL,                                 -- which week the match is for
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  partner_plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL,                                 -- environment | dimension | both
  match_summary TEXT NOT NULL,                              -- "Alex also has climbing this week"
  matched_sessions JSONB NOT NULL,                          -- array of matched session details
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_notification UNIQUE (user_id, partner_id, plan_id, week_number)
);
-- Indexes on user_id+is_read and user_id+plan_id+week_number
-- RLS: users can only see/update/delete their own notifications; system can insert
```

-----

## API Routes

### POST /api/match-objective

**Input:** `{ name, route?, type?, details?, mode: "match" | "search" }`
**Logic:**

1. **Match mode:** Normalize input, check `validated_objectives.match_aliases` for fuzzy match. Gold if found, Silver if similar type/tags, Bronze if nothing.
1. **Search mode:** Call Claude with Prompt SEARCH to generate 3 geographically relevant suggestions, cross-reference against validated library for tier matching.
   **Output:** `{ tier, validatedObjective?, anchors[], suggestions? }`

### POST /api/estimate-scores

**Input:** `{ objectiveDetails, benchmarkExercises[], anchors[], validatorFeedback[] }`
**Logic:** Call Claude API with Prompt 1. Parse JSON response. Model: opus. Max tokens: 8192. Timeout: 60s.
**Output:** `{ dimensions, relevanceProfiles, graduationBenchmarks }`

### POST /api/generate-assessment-questions

**Input:** `{ objectiveId, standardAnswers }`
**Logic:**

1. Fetch objective (target scores, graduation benchmarks, relevance profiles).
1. Call Claude with Prompt ASSESS-Q: “Given this objective and these baseline answers, generate 3–5 follow-up questions that would help you assess this athlete’s readiness.”
1. Return questions with field types (text, number, dropdown, scale).
   **Output:** `{ questions: [{ id, question, fieldType, options? }] }`

### POST /api/generate-more-questions

**Input:** `{ objectiveId, standardAnswers, previousQuestions, previousAnswers }`
**Logic:** Call Claude with Prompt ASSESS-Q again, asking for 2–3 additional questions based on gaps in what it knows so far.
**Output:** `{ questions: [{ id, question, fieldType, options? }] }`

### POST /api/score-assessment

**Input:** `{ objectiveId, standardAnswers, aiQuestions, aiAnswers, freeformText? }`
**Logic:**

1. Fetch objective (target scores, graduation benchmarks, relevance profiles).
1. Call Claude with Prompt ASSESS-SCORE with all data including climbing role from AI answers. Model: opus. Max tokens: 8192.
1. **Lead/follow detection:** Scans AI questions for “lead or follow” keyword to extract climbing role from answers.
1. If climbing role = “follow”, update objective’s target scores and graduation benchmarks with the adjusted values from the AI response.
1. Store climbing_role on the objective.
1. Store assessment with all fields (standard_answers, ai_questions, ai_answers, freeform_text, ai_reasoning).
1. Store `programmingHints` in the assessment’s raw_data field — the plan generator uses these.
1. Update current scores on objective.
1. Write to score_history with confidence = “low”.
   **Output:** `{ scores, reasoning, programmingHints, adjustedTargets?, climbingRole, assessmentId }`

### POST /api/generate-plan

**Input:** `{ userId, objectiveId, assessmentId }`
**Logic:**

1. Fetch objective (including climbing_role), assessment (including programmingHints from raw_data), graduation benchmarks.
1. Calculate weeks available.
1. Create plan structure with linear interpolation for expected scores per week.
1. Use programmingHints.sessionsPerWeek per dimension to allocate time across dimensions (instead of equal allocation).
1. **Week types:** Currently all weeks are generated as `weekType: "regular"`. Test/recovery/taper scheduling is not yet implemented — the schema supports it but the plan generator does not assign special week types.
1. Calculate hours per week using progressive volume formula: `0.7 + (weekNumber / totalWeeks) * 0.3`, with taper multiplier (0.6) for final 2 weeks.
1. **Seed data precedence:** Uses three-tier benchmark matching: (1) hardcoded seed data (authoritative), (2) validated_objectives FK, (3) match_aliases fuzzy match. Seed data overlays DB records.
1. Store plan in `training_plans` with empty sessions. Store programmingHints in plan_data (along with heroImageUrl and difficultyAdjustments) so Prompt 2B can use them.
1. Store weeks in `weekly_targets`.
1. Sessions are generated on-demand via `/api/generate-week-sessions`.
1. Fetch Unsplash hero image for the objective (non-blocking).
1. Build a data-driven `planPhilosophy` text summary stored in plan_data.
   **Output:** `{ planId, weekCount }`
   **Note:** Does NOT call Claude for sessions. Structure only. ProgrammingHints from assessment flow through to session generation.

### POST /api/generate-week-sessions

**Input:** `{ planId, weekNumber }`
**Logic:** Call Claude with Prompt 2B to generate sessions for a single week. Passes the programmingHints from the assessment so the AI adapts starting intensity, session content, and coaching voice to the athlete’s specific profile. Uses `claude-opus-4-20250514` with prompt caching (`callClaudeWithCache`). Max tokens: 8192. Timeout: 120s. Stores sessions in `weekly_targets.sessions`. Calculates per-dimension progress fractions (including maintenance mode detection at 1.25× target).
**Output:** `{ sessions[] }`

### POST /api/generate-all-sessions

**Input:** `{ planId }`
**Logic:** Batch-generates all remaining weeks using `Promise.allSettled()`, up to 3 concurrent calls. Uses `claude-opus-4-20250514` with prompt caching. Max tokens: 8192. Timeout: 300s (5 minutes). Tracks and reports errors per-week.
**Output:** `{ generated, total, errors? }`

### POST /api/complete-week

**Input:** `{ planId, weekNumber, ratings: { cardio, strength, climbing_technical, flexibility }, comments?: { cardio?, strength?, climbing_technical?, flexibility? } }`
**Logic:**

1. Fetch weekly_target for week_type.
1. **If week_type = “recovery” or “taper”:** No score changes. Skip.
1. **If rating = 3 (any dimension):** Apply base multiplier 1.0. No AI call.
1. **If rating != 3 (any dimension):** Comment is required. Call Claude with Prompt 3B to evaluate relevance of the comment against the objective’s relevance profiles. AI returns adjusted multiplier (base ±0.25).
1. Calculate: `newScore = currentScore + expectedGain × multiplier`
1. Apply no-session regression: -1 point per dimension with no logged sessions.
1. Write to score_history.
1. Update current scores on objective.
1. Advance `current_week_number`.
1. Check rebalance threshold (5+ points off trajectory in any dimension). If triggered, call `/api/rebalance`.
1. **Report generation is client-triggered** (not background async). Due to Vercel serverless limitations (function can be killed after sending response), the client calls `/api/generate-weekly-report` after receiving the complete-week response. Previously used a detached promise, but this was unreliable on serverless.
1. Returns `aiExplanations` per dimension so the UI can show why multipliers were adjusted.
1. Validates all scores are finite before persisting (safety net).
   **Output:** `{ updatedScores, expectedScores, gaps, summary, rebalanceRecommended, aiExplanations }`
   **Timeout:** 60s. **Model:** sonnet. **Max tokens:** 1024 (for Prompt 3B calls).

### POST /api/generate-weekly-report

**Input:** `{ planId, weekNumber }`
**Logic:**

1. Fetch: weekly_target (sessions, expected_scores, week_type), workout_logs for this week, score_history entries for this week and previous week, objective (target scores, relevance profiles, taglines), AI relevance evaluation results (multiplier adjustments and explanations from Prompt 3B).
1. Call Claude with Prompt REPORT (see below).
1. Store the report in `weekly_targets.weekly_report` as JSON.
1. **Client-triggered** (not background). The client calls this endpoint after receiving the complete-week response. The UI polls or checks for the report and shows a “View Report” button on the week card when it’s available.
1. Logic is delegated to `src/lib/generate-report.ts`.
   **Output:** `{ success }` (report stored in weekly_targets.weekly_report, not returned directly)
   **Timeout:** 120s. **Model:** sonnet.

### Rating Multipliers

|Rating|Label          |Base Multiplier|With AI (±0.25)|Effective Range|
|------|---------------|---------------|---------------|---------------|
|1     |“Way too hard” |0              |0 to 0.25      |0 – 0.25       |
|2     |“Struggled”    |0.5            |±0.25          |0.25 – 0.75    |
|3     |“Just right”   |1.0            |No AI call     |1.0            |
|4     |“Slightly easy”|1.25           |±0.25          |1.0 – 1.5      |
|5     |“Way too easy” |1.5            |±0.25          |1.25 – 1.75    |

### POST /api/rebalance

**Input:** `{ planId, currentWeek, actualScores, expectedScores, targetScores }`
**Logic:** Math-only rebalancing. Recalculates expected scores from current actuals, recalculates hours, clears sessions for on-demand regeneration. Does NOT call Claude.
**Output:** `{ updatedWeeks[] }`

### POST /api/generate-alternatives

**Input:** `{ planId, weekNumber, sessionIndex }`
**Logic:** Call Claude with Prompt 6 (with prompt caching) to generate 2 alternative sessions. Provides outdoor/gym cardio options, bodyweight/equipment strength options, bouldering/outdoor climbing options, different modality flexibility options. Model: opus. Max tokens: 4096. Timeout: 120s.
**Output:** `{ original, alternatives: [session, session] }`

### POST /api/replace-session

**Input:** `{ planId, weekNumber, sessionIndex, replacementSession }`
**Logic:** Swaps session with selected alternative. Preserves original. Recalculates total hours for the week.
**Output:** `{ success, sessions }`

### POST /api/adjust-difficulty

**Input:** `{ planId, adjustment: "much_easier" | "slightly_easier" | "slightly_harder" | "much_harder" }`
**Logic:** Two-step: (1) Math-only `scaleDifficultyTargets()` scales the remaining gap between current and target scores using scale factors: much_easier=0.60, slightly_easier=0.80, slightly_harder=1.20, much_harder=1.50. (2) Calls Claude with Prompt RESCALE_BENCHMARKS to rescale graduation benchmark values to match new targets. Recalculates expected scores for remaining weeks. Clears sessions for on-demand regeneration. Tracks adjustments in `plan_data.difficultyAdjustments` array.
**Output:** `{ newTargets, newBenchmarks, updatedWeeks }`
**Timeout:** 60s. **Model:** sonnet. **Max tokens:** 4096.

### POST /api/find-routes

**Input:** `{ location, targetDistance, targetElevation, preferences }`
**Logic:** Call Claude with Prompt 5. **TODO: Enable `web_search` tool for real results.**
**Output:** `{ routes[] }`

### POST /api/delete-plan

**Input:** `{ planId }`
**Logic:** Cascading delete: detaches workout_logs (removes FK reference but keeps logs), deletes weekly_targets, deletes plan, deletes assessments, deletes objective, deletes score_history entries.
**Output:** `{ success }`

### POST /api/delete-workout

**Input:** `{ logId }`
**Logic:** Deletes workout log. If week was already completed, reverts scores to previous score_history entry (or assessment baseline if no prior history) and decrements week number.
**Output:** `{ success, weekReverted? }`

### POST /api/delete-assessment

**Input:** `{ assessmentId }`
**Logic:** Deletes assessment and resets objective's current scores to 0. Does NOT delete the associated plan — allows user to re-assess and regenerate.
**Output:** `{ success }`

### GET /api/debug-claude

Diagnostic endpoint for Claude API connectivity testing. Sends a simple 5-word prompt to sonnet and returns response time, token counts.

### POST /api/partners/invite

**Input:** `{ recipientEmail }`
**Logic:** Looks up user by email via service role. Validates no self-invite, no existing partnership. Creates `partnerships` row with status `pending`.
**Output:** `{ partnershipId, recipientName, status }`

### POST /api/partners/respond

**Input:** `{ partnershipId, action: "accept" | "decline" }`
**Logic:** Verifies user is the recipient and partnership is pending. Updates status.
**Output:** `{ partnership }`

### GET /api/partners/list

**Logic:** Fetches all partnerships for current user. For accepted partners, fetches their active plan, current week sessions (with completion status), objective name, week label. Determines score visibility (both users must opt in). Returns accepted and pending lists.
**Output:** `{ accepted: AcceptedPartner[], pending: PendingPartner[] }`

### POST /api/partners/toggle-scores

**Input:** `{ partnershipId, shareScores: boolean }`
**Logic:** Updates the caller's score sharing flag (`requester_shares_scores` or `recipient_shares_scores`). Scores are only visible when BOTH partners opt in.
**Output:** `{ partnership }`

### POST /api/partners/remove

**Input:** `{ partnershipId }`
**Logic:** Verifies user is part of partnership. Deletes related notifications, then deletes partnership.
**Output:** `{ success }`

### GET /api/partners/week/[partnerId]

**Logic:** Fetches partner's active plan, current week sessions with completion status, objective details. Runs session matching against user's current week to find overlapping sessions. Returns score data only if both partners share scores.
**Output:** `{ partnerId, partnerName, objectiveName, weekNumber, totalWeeks, weekType, sessions, scoresVisible, scores, targetScores, matches }`

### GET /api/partners/notifications

**Logic:** Fetches unread/undismissed partner notifications for user's current plan and week.
**Output:** `{ notifications[] }`

### POST /api/partners/notifications/dismiss

**Input:** `{ notificationId }`
**Logic:** Sets `is_dismissed = true` on the notification.
**Output:** `{ success }`

-----

## Scoring Rules

### Formula

```
newScore = currentScore + expectedWeeklyGain × multiplier
```

Where `multiplier` comes from the rating system (see table above). For ratings 1/2/4/5, the AI adjusts the base multiplier by ±0.25 based on relevance evaluation of the user’s comment.

### How the AI relevance evaluation works

Rating 3 (“Just right”) = user did the plan as prescribed. Full credit, no comment needed, no AI call.

Rating 1, 2, 4, or 5 = something was different. App requires a comment explaining what happened. The AI reads the comment against the objective’s relevance profiles and adjusts the multiplier:

- User rates 2, writes “struggled through all the loaded step-ups but finished” → AI bumps toward 0.75 (relevant training, just hard)
- User rates 2, writes “gave up on step-ups and went swimming” → AI keeps at 0.25 (irrelevant substitution)
- User rates 5, writes “added extra step-ups and a 2-mile ruck” → AI bumps toward 1.75 (relevant extra work)
- User rates 5, writes “did the session plus an hour of bench press” → AI keeps at 1.25 (irrelevant extra work)

### Week types (never overlap)

|Type    |Volume|Benchmarks           |Scoring                        |Rebalancing                 |
|--------|------|---------------------|-------------------------------|----------------------------|
|test    |75–80%|Yes (3 of 5 sessions)|Rating system with AI relevance|Full rebalance if 5+ pts off|
|recovery|50%   |No                   |No changes                     |No                          |
|regular |100%  |No                   |Rating system with AI relevance|Emergency if 5+ pts behind  |
|taper   |60%   |No                   |No changes (scores locked)     |No                          |

### Volume & Hours

- **Max weekly hours:** 20
- **Volume progression:** Progressive factor `0.7 + (week/total × 0.3)` — gradual ramp, not flat 10% jumps
- **Hours formula:** `min(daysPerWeek * hoursFactor, 20)`

### Maintenance Mode

When a dimension’s current score ≥ 1.25 × target score, that dimension enters maintenance:

- Volume drops to 60%
- Limited to 1 session per week
- Prevents wasting time on a dimension you’ve already crushed

### Progress Fractions (per-dimension session scaling)

- **Maintenance** (current ≥ 1.25 × target): 60% volume
- **At-target** (current ≥ target): 80% → 100% volume
- **Below-target** (current < target): max(50%, current/target) → 100% volume

### Overshoot Rule

Graduation benchmarks are set at approximately 150% of actual objective requirements. If Mont Blanc needs 10 miles of cardio capacity, the graduation target might be 15 miles. This means if you can hit the graduation workout, you’re more than ready — not barely ready.

### No-session regression

-1 point per dimension per week with no logged sessions.

### Rebalance threshold

5+ points off expected trajectory triggers rebalancing.

### Expected scores

Linear interpolation from current to target across plan duration. Expected at week N = current + (target - current) × (N / totalWeeks).

### Exceeded benchmarks

Cap at 100% for scoring. Surface to user: “Your [dimension] exceeds requirements.”

### Taper

Final 2 weeks before objective. Volume at 60%. No scoring changes. No rebalancing. Last test week must fall before taper.

### Week revert on workout deletion

Deleting a workout from a completed week reverts scores and week number. Safety net.

-----

## AI Prompts

> **Note:** All prompts are defined in `src/lib/prompts.ts`. The actual implementations include MTI reference plan URLs for calibration (13 URLs from mtntactical.com/shop/) and detailed JSON response schemas. The summaries below capture the intent; see the source file for exact prompt text. Deprecated prompts (PROMPT_2_SYSTEM full-plan generation, PROMPT_2A_SYSTEM structure-only) are kept in the file for reference but are not called.

### Prompt 1: Target Score Estimation & Graduation Benchmarks

```
You are an expert mountain athletics coach who assesses the physical demands of mountaineering, alpine climbing, and trail running objectives. You think in the style of Mountain Tactical Institute. Given an objective's details, you evaluate the fitness required across four fixed dimensions.

The four training dimensions are fixed: Cardio, Strength, Climbing/Technical, and Flexibility. For each dimension, generate:

1. A target score (0–100). Scale: 0 = no capacity, 25 = beginner, 50 = intermediate, 75 = strong amateur, 100 = elite. Scores reflect 'ready safely and enjoyably.'

2. A tagline of 4–7 words: vivid coach shorthand.

3. A relevance profile with keyComponents (7–10 items) and irrelevantComponents (7–10 items). Practical, whiteboard-level. Broad surface area.

4. Graduation benchmarks: 2–4 per dimension from the provided library. Cardio: 1–2. Strength: 2–4. Climbing/Technical: 1–3. Flexibility: 1–3.

TRAINING OVERSHOOT RULE: Set graduation benchmarks above actual requirements (~150% for cardio distance/elevation, +1/+2 climbing sub-grades). If the athlete can hit the graduation workout, they should be MORE than ready.

Select benchmark exercises ONLY from the provided library.

[If validated feedback exists:] Experienced validators have confirmed: {feedback}. Use this to refine.
[If calibration anchors exist:] Calibrated profiles for similar objectives: {anchors}. Use as anchors.

Return only valid JSON.
```

### Prompt 2B: Single-Week Session Generation (Active)

```
You are an expert mountain athletics coach designing a single week of training in the style of Mountain Tactical Institute — sport-specific, no-fluff, approachable exercise names.

Generate sessions for week {weekNumber} of {totalWeeks}.

ATHLETE PROFILE (from assessment):
{programmingHints}
Climbing role: {climbingRole}

Use the programming hints to adapt the session content to this specific athlete:
- Start exercises at the recommended intensity level (e.g., "start step-ups at 25lb" not the full graduation weight if the athlete isn't ready)
- Allocate time across dimensions as recommended (e.g., "3 cardio sessions/week" for an athlete with a massive cardio gap)
- Apply specific adaptations (e.g., "include pull-up progression from zero" for a runner with no upper body, "focus trad on gear placement speed" for a climber who needs efficiency)
- If a dimension is flagged as "maintain", prescribe maintenance-level volume, don't build
- Adapt the coaching voice to the athlete — a bodybuilder needs to hear "your squat doesn't help here, this is endurance." A runner needs to hear "now do it with a pack." A climber needs to hear "you can climb this grade, now do it efficiently with gear."

If climbing role is FOLLOW: climbing sessions focus on following, cleaning gear, rappelling, exposure comfort. No trad lead practice or anchor building under pressure.
If climbing role is LEAD: climbing sessions include trad lead practice at one grade below max, anchor building drills, rack management, speed on moderate terrain.

TRAINING OVERSHOOT RULES: Graduation benchmarks are set above actual requirements. Scale weekly sessions proportionally toward these targets.

CLIMBING GRADE PRESCRIPTION RULES: Use relative descriptors ("one grade below your max", "at your comfortable outdoor level") not raw grades.

MAINTENANCE MODE: If a dimension's current score >= 1.25x target, prescribe 60% volume, 1 session/week for that dimension.

PROGRESS FRACTIONS: Scale session difficulty based on:
- Maintenance (current >= 1.25x target): 60% of graduation targets
- At-target (current >= target): 80-100% of graduation targets
- Below-target: max(50%, current/target fraction) progressing to 100%

EXERCISE SELECTION: Use standard, well-known exercises only. Step-ups, lunges, leg blasters, push-ups, pull-ups, dead hangs, farmer carries, planks, hip flexor stretches, climbing routes, rappels, and sport-specific movement drills. Graduation benchmark exercises anchor test weeks. Never invent novel or unusual exercises. The creativity is in the programming — emphasis, progression, and time allocation — not the exercise vocabulary.

Each session must include:
- Name, objective line with duration
- Warm-up block with exercises and reps
- Numbered training block with exact reps/sets/weight/distance/pace
- Each exercise needs a durationMinutes field
- warmUpMinutes and cooldownMinutes fields
- Intensity descriptors: "Moderate = comfortable but not easy", "Zone 2 = conversational, nose-breathing", "Threshold = fastest sustainable"
- Cool-down notes

Every exercise must train key components from relevance profiles. Never prescribe irrelevant components. Approachable names only — no proprietary jargon.

Max weekly hours: 20.

On test weeks: 3 of 5 sessions contain benchmark exercises. Mark clearly with graduation targets inline.

Return valid JSON.
```

### Prompt 3B: AI Relevance Evaluation (NEW — for non-3 ratings)

```
You are evaluating whether an athlete's actual training was relevant to their specific objective. The athlete rated their week as {rating} and provided this comment: "{comment}"

The objective is: {objectiveName}
The prescribed session was: {sessionDetails}
The dimension being evaluated is: {dimension}

Relevance profile for this dimension:
Key components: {keyComponents}
Irrelevant components: {irrelevantComponents}

The base multiplier for rating {rating} is {baseMultiplier}. You may adjust it by up to ±0.25 based on how relevant the athlete's actual training was to the key components.

Rules:
- If the comment describes training that targets key components, adjust upward (toward +0.25)
- If the comment describes training that targets irrelevant components, adjust downward (toward -0.25)
- If the comment is ambiguous, keep the base multiplier unchanged
- Return the adjusted multiplier and a brief explanation (1-2 sentences)

Return JSON:
{
  "adjustedMultiplier": number,
  "explanation": "string"
}
```

### Prompt 4: Plan Rebalancing (Defined, not actively called)

```
Rebalance training plan. Regenerate future weekly sessions to get scores back on trajectory.
Ahead dimensions drop to maintenance (min 60% volume). Behind dimensions get freed time.
Total hours stay constant. Prioritize highest target score if behind in multiple.
MAINTENANCE MODE: current >= 1.25x target → 60% volume, 1 session/week.
Do not modify test/recovery/taper scheduling.
```

**Note:** Currently not called. Rebalancing is math-only with sessions regenerating on-demand.

### Prompt 5: Route Recommendations

```
Find 3–5 trail running or hiking routes near {location} matching {distance} miles and {elevation} ft gain.
Return JSON with name, location, distance, elevation, description, sourceUrl, whyItFits.
```

**TODO:** Enable `web_search` tool for real results.

### Prompt 6: Session Alternatives

```
Generate 2 alternative sessions for {dimension} for week {weekNumber}.
Provide variety: outdoor/gym options for cardio, bodyweight/equipment for strength,
bouldering/outdoor for climbing, different modalities for flexibility.
Same format as Prompt 2B sessions. Match the difficulty level of the original session.
```

### Prompt RESCALE: Difficulty Adjustment

```
You are an expert mountain athletics coach rescaling graduation benchmarks for a training plan whose difficulty has been adjusted. The athlete wants their plan to be harder or easier, so the target scores have changed. You must update the graduation benchmark targets to match the new target scores while keeping the same exercises.

Rules:
- Keep the SAME exerciseId and exerciseName for every benchmark — only change graduationTarget and whyThisTarget.
- Scale the numeric values in graduationTarget proportionally to the score change.
- Maintain the TRAINING OVERSHOOT RULE: graduation targets should remain above actual requirements.
- For climbing grades, adjust by sub-grades when the score change is significant enough (10+ point change).
- Round to sensible values (whole reps, nearest 0.5 miles, nearest 100 ft elevation).

Return JSON with same structure as graduation benchmarks input.
```

### Prompt SEARCH: Objective Suggestions

```
The user is searching for an objective: "{query}"
Suggest 3 geographically relevant mountain/trail objectives.
For each, return name, route, type, difficulty, brief description.
Cross-reference against the validated objectives library if possible.
```

### Prompt ASSESS-Q: Assessment Question Generation

```
You are an expert mountain athletics coach assessing an athlete's readiness for a specific objective. You have their standard fitness baseline answers. Now generate follow-up questions that will help you accurately score their current fitness against this objective's specific demands.

Objective: {objectiveName} via {route}
Target scores: Cardio {n}, Strength {n}, Climbing/Technical {n}, Flexibility {n}
Graduation benchmarks: {graduationBenchmarks}
Relevance profiles: {relevanceProfiles}

Standard answers provided:
{standardAnswers}

REQUIRED: If this objective involves technical climbing (Climbing/Technical target > 15), your FIRST question MUST be:
"Do you plan to lead or follow on this route?" with fieldType "dropdown" and options ["Lead", "Follow"].
This answer reshapes the entire climbing dimension:
- LEAD: Full climbing targets stay as-is. Graduation benchmarks include trad lead efficiency, anchor building, rack management.
- FOLLOW: Climbing target score is reduced to approximately 60% of the lead target. Graduation benchmarks shift to: follow efficiently, clean gear, rappel confidently, comfortable on exposure. No lead-specific skills required.

After the lead/follow question, generate 3–4 additional questions that probe the specific capabilities this objective demands. Each question should help you assess one or more dimensions more accurately. Focus on the key components from the relevance profiles.

Your questions should also gather information that will help PROGRAM the training plan — not just score the athlete. For example:
- Asking about loaded pack experience tells you both the score AND whether to start step-ups at 25lb or 35lb.
- Asking about climbing gym frequency tells you both the score AND how many climbing sessions per week to prescribe.
- Asking about grip endurance tells you both the score AND whether to include dead hang progressions or just maintenance.

For Mont Blanc you might ask about loaded pack hiking experience and altitude exposure.
For the Exum Ridge you might ask about multi-pitch trad efficiency and climbing after exhaustion.
For a trail ultra you might ask about time on feet beyond 4 hours and fueling strategy.

Return JSON:
{
  "questions": [{
    "id": "string",
    "question": "string",
    "dimension": "string (primary dimension this helps assess)",
    "fieldType": "text | number | dropdown | scale",
    "options": ["string"] // only for dropdown
  }]
}
```

**For “want more questions” follow-up call:** Same prompt but add: “You already asked these questions: {previousQuestions}. The athlete answered: {previousAnswers}. Generate 2–3 additional questions targeting gaps in what you know. Do not repeat topics already covered.”

### Prompt ASSESS-SCORE: AI Assessment Scoring

```
You are an expert mountain athletics coach scoring an athlete's current fitness for a specific objective AND providing programming recommendations. You have comprehensive information about their background. Score them accurately against the graduation benchmarks — these are the concrete finish line for each dimension.

Objective: {objectiveName} via {route}
Target scores: Cardio {n}, Strength {n}, Climbing/Technical {n}, Flexibility {n}
Graduation benchmarks: {graduationBenchmarks}
Relevance profiles (key components): {keyComponents per dimension}
Climbing role: {lead | follow} (from assessment)

If climbing role is FOLLOW:
- Reduce the Climbing/Technical target score to approximately 60% of the original target.
- Adjust graduation benchmarks: remove lead-specific benchmarks (gear placement speed, anchor building). Replace with follow-specific: "follow 5 pitches efficiently", "clean gear competently", "rappel confidently."
- Return the adjusted target and adjusted benchmarks in the output.

A score of 0 means no relevant capacity for this objective.
A score equal to the target means the athlete could complete the graduation workout today.
Use the graduation benchmarks as your calibration — map what the athlete tells you to what percentage of the graduation benchmark they could likely achieve.

Standard fitness baseline:
{standardAnswers}

Objective-specific answers:
{aiAnswers}

Additional context from athlete:
{freeformText}

For each dimension, provide:
1. A score (0 to the target score maximum — never above target)
2. A 2-3 sentence explanation connecting their answers to the graduation benchmarks
3. The key factor that most influenced your score
4. Programming recommendations — specific guidance for the plan generator about this athlete's needs:
   - Starting intensity for benchmark exercises (e.g., "start step-ups at 25lb not 35lb due to bodyweight")
   - Time allocation priority (e.g., "needs 3 cardio sessions/week, not 2")
   - Specific adaptations (e.g., "include pull-up progression from zero", "focus trad sessions on gear placement speed, not harder grades")
   - Maintenance vs build (e.g., "cardio is strong — maintain with 2 sessions, invest time elsewhere")

Return JSON:
{
  "climbingRole": "lead | follow",
  "adjustedTargets": {
    "cardio": number, "strength": number, "climbing_technical": number, "flexibility": number
  },
  "adjustedBenchmarks": { ... } // only if climbing role changes targets
  "scores": {
    "cardio": number, "strength": number, "climbing_technical": number, "flexibility": number
  },
  "reasoning": {
    "cardio": { "explanation": "string", "keyFactor": "string" },
    "strength": { "explanation": "string", "keyFactor": "string" },
    "climbing_technical": { "explanation": "string", "keyFactor": "string" },
    "flexibility": { "explanation": "string", "keyFactor": "string" }
  },
  "programmingHints": {
    "cardio": { "startingIntensity": "string", "sessionsPerWeek": number, "keyAdaptation": "string" },
    "strength": { "startingIntensity": "string", "sessionsPerWeek": number, "keyAdaptation": "string" },
    "climbing_technical": { "startingIntensity": "string", "sessionsPerWeek": number, "keyAdaptation": "string" },
    "flexibility": { "startingIntensity": "string", "sessionsPerWeek": number, "keyAdaptation": "string" }
  }
}
```

### Prompt REPORT: Weekly Report Generation

```
You are a mountain athletics coach writing a weekly training report for your athlete. You have complete data about what they did this week, how it affected their scores, and where they stand relative to their plan. Write a structured, warm report with clear section headers.

Objective: {objectiveName} via {route}
Week: {weekNumber} of {totalWeeks}
Week type: {weekType}

Sessions prescribed: {sessionsList}
Sessions completed: {completedCount} of {totalCount}
Ratings given: {ratingsPerDimension}
Comments provided: {commentsPerDimension}

AI relevance evaluations (from Prompt 3B):
{relevanceResults — multiplier adjustments and explanations per dimension}

Score changes:
{perDimension: { before, after, change, expectedGain, actualMultiplier, reason }}

Expected scores at this point (from linear trajectory):
{expectedScores}

Target scores: {targetScores}

Write the report with these 5 sections:

## Week Summary
One paragraph. How many sessions completed, ratings breakdown, overall effort level. Acknowledge what they did well first.

## Score Changes & Why
For EACH dimension that had a score change, explain: the score before → after, what caused it. If the AI adjusted the multiplier because of a relevance evaluation, explain in plain language why — connect their specific comment to the specific relevance profile components. Example: "Your flexibility dropped because the yoga class you described focused on neck and shoulders, which aren't key components for Mont Blanc. The prescribed session targeted hip flexors and ankles — those are what move your score."

For dimensions where they scored 3 (just right), keep it brief: "Cardio: 35 → 38 (+3). You completed both sessions as prescribed. On track."

For missed sessions, explain the -1 regression.

## Where You Stand
For each dimension, one line: actual score vs expected trajectory at this point. Flag anything 3+ points ahead or behind. Keep it visual and clear.

## Next Week Focus
2-3 sentences of specific, actionable guidance. Name the session(s) to prioritize. If a dimension has buffer, name it as the one to skip if life gets busy. Be concrete — "prioritize Tuesday's hip mobility session" not "work on flexibility."

## Consider Adjusting?
ONLY include this section if any dimension is 4+ points behind trajectory for 2+ consecutive weeks. Suggest "consider rebalancing" or "consider making [dimension] easier/harder" with a brief explanation of why. If everything is on track or ahead, DO NOT include this section.

Tone: structured with clear headers, warm but direct. Like a coach's written weekly check-in. No fluff. Under 400 words total.

Return JSON:
{
  "summary": "string (markdown)",
  "scoreChanges": "string (markdown)",
  "whereYouStand": "string (markdown)",
  "nextWeekFocus": "string (markdown)",
  "considerAdjusting": "string (markdown) | null",
  "generatedAt": "ISO timestamp"
}
```

-----

## Pages & UI

### / (Landing Page)

Mountain silhouette background with blur effect. Title, tagline, Login/Sign Up CTAs.

### /login, /signup

Standard Supabase Auth UI. Email/password. Redirect to /dashboard after login.

### /dashboard

- If no objective: “Add your first objective” CTA → /calendar.
- If objective but no assessment: “Assess your fitness for [objective name]” CTA → /assessment/[objectiveId].
- If assessment but no plan: “Generate Training Plan” button.
- If plan exists:
  - **Readiness section:** 4 progress arcs (current vs target). Tagline under each. Green/yellow/red.
  - **This week summary:** Week type badge. Sessions with “Mark Complete” buttons.
  - **Graduation benchmarks:** Latest results vs targets.
  - **Objective countdown:** Name, date, weeks remaining.
  - **DeletePlanButton** and **UpdateAssessmentButton** components.
  - Banner if scores are estimates: “Estimated scores — take your first benchmark test to calibrate.”

### /calendar

- Monthly grid view (desktop), sorted list view (mobile < 768px).
- Objectives as colored events (green = hike, blue = trail run, orange = climb).
- Click empty date → create objective modal with search mode (Prompt SEARCH).
- Click event → objective detail modal (edit/delete).
- Tier badge on each objective (Gold/Silver/Bronze).

### /assessment (redirect)

Legacy route — redirects to `/calendar`. Assessment is now accessed per-objective via `/assessment/[objectiveId]`.

### /assessment/[objectiveId]

Assessment is per-objective and happens AFTER creating the objective. Two layers:

**Layer 1: Standard Questions (same for everyone, ~2 minutes)**

- Training days per week
- Longest cardio effort in last 3 months (distance, duration, elevation gain)
- Strength training frequency and type (dropdown)
- Climbing experience level + skill checkboxes (indoor gym, outdoor sport, trad, multi-pitch, glacier, crevasse rescue)
- Flexibility self-assessment:
  - Hip mobility (1–5 scale) with info bubble (see below)
  - Ankle mobility (1–5 scale) with info bubble (see below)
  - Regular flexibility routine? (yes/no)

**Hip Mobility Info Bubble Content:**
Here's how to think about this. Try sitting cross-legged on the floor — can you sit comfortably with a straight back, or do your knees stay high and your back rounds? Now try a deep lunge with your back knee close to the ground — can you hold it for 30 seconds without pain?

1 (Very tight): You can't sit cross-legged comfortably. Deep lunges feel restricted or painful. Getting in and out of a low car seat is awkward. You spend most of your day sitting and rarely stretch or do lower-body mobility work.

2 (Tight): You can sit cross-legged but not for long. Lunges feel tight in the front of your back hip. You occasionally stretch or do yoga but your hips are noticeably stiff, especially after sitting for hours.

3 (Average): You can do a deep lunge and hold it. Sitting cross-legged is fine. You don't have a dedicated flexibility routine, but you move regularly and your hips don't limit your activities. Most active people are here.

4 (Pretty flexible): You can easily hold a deep lunge with your back knee an inch from the ground. Pigeon pose and similar hip stretches feel comfortable. You probably do yoga or dedicated mobility work at least once a week.

5 (Very flexible): Full splits or near-splits. You can drop into a deep squat with feet flat and sit there comfortably. Hip mobility has never limited any physical activity. Dancers, martial artists, and dedicated yoga practitioners are typically here.

**Ankle Mobility Info Bubble Content:**
Here's a quick test. Stand facing a wall with one foot about 4 inches away. Try to touch your knee to the wall without lifting your heel. Can you do it easily, barely, or not at all?

1 (Very stiff): You can't touch your knee to the wall from 4 inches. Deep squats force your heels off the ground. You've had ankle sprains or wear stiff shoes most of the time. Going downhill on steep trails feels jarring.

2 (Stiff): Knee barely touches the wall at 4 inches. Squatting deep requires heel elevation or a wide stance. You notice ankle tightness on steep descents or uneven ground. Calves feel chronically tight.

3 (Average): You pass the wall test at 4 inches without difficulty. You can squat to parallel with heels down. Steep terrain doesn't bother your ankles specifically. Most people who walk or run regularly are here.

4 (Good): You pass the wall test at 5+ inches. Full deep squat with heels flat is comfortable. You can walk on uneven rocky terrain for hours without ankle fatigue. Trail runners and hikers who train on varied terrain are typically here.

5 (Excellent): You can easily pass the wall test at 6+ inches. Deep pistol squats are accessible. Your ankles have never limited any athletic movement. This level is common in gymnasts, experienced barefoot runners, and dedicated mobility practitioners.

**Layer 2: AI-Generated Questions (3–5 tailored to this objective)**

- After Layer 1 is submitted, call `/api/generate-assessment-questions`
- Display 3–5 AI-generated questions specific to this objective
- Each question has an appropriate field type (text input, number, dropdown, scale)
- **“Want a more precise assessment?” button** → calls `/api/generate-more-questions` for 2–3 additional questions based on gaps
- Final free-form box: “Anything else you think is relevant to your readiness for [objective name]?”

**Scoring step:**

- Call `/api/score-assessment` with all data
- **Summary screen:** Gauges per dimension with target alongside. Graduation workouts displayed below each gauge.
- **AI reasoning shown per dimension:** e.g., “Cardio: 35 — You run 5 miles weekly but haven’t done loaded hiking. The graduation benchmark requires 700 loaded step-ups in 30 min. Your current base is roughly 35% of that capacity.”
- “Estimated” banner: “These scores will calibrate as you train and complete test weeks.”

### /plan

- **Header:** Objective name, mountain hero image (SVG fallback + Unsplash), total weeks, current week.
- **Difficulty selector:** Easier/harder/way easier/way harder buttons.
- **Graduation workouts:** Pinned “finish line” section.
- **Score trajectory chart:** 4 lines + dashed targets.
- **Week list:** Expandable. Each week shows:
  - Week number, date range, week_type badge (test=blue, recovery=green, taper=amber).
  - Sessions generated on-demand when week is expanded.
  - Session cards with “Mark Complete” button and 1–5 rating selector.
  - **Rating 3:** One tap, done.
  - **Rating 1/2/4/5:** Comment field appears, required before submission.
  - Benchmark sessions: star icon + blue highlight + graduation target inline.
  - **“Try Different” button** per session → AlternativesPanel with 2 AI-generated alternatives.
- **Rebalance button** if scores deviate significantly.
- **“View Report” button** on completed weeks — appears when weekly_report is populated. Opens the AI-generated weekly report inline or as a modal. Shows all 5 sections with markdown rendering. The button should have a subtle animation or indicator when the report first becomes available.

### /log

- Accessed from “Mark Complete” on plan session: pre-filled, one-tap confirm (rating 3).
- Rating selector (1–5). If non-3, comment field is mandatory.
- Dimension-specific fields for manual entry:
  - Cardio: activity type, distance, duration, elevation, avg HR.
  - Strength: add-exercise pattern (name, sets, reps, weight).
  - Climbing: type, grade, pitches, duration.
  - Flexibility: routine name, duration, body areas worked.
- Benchmark sessions on test weeks: structured fields for exact results.

### /progress

- Line chart per dimension over time from score_history.
- Solid dots = test weeks (high confidence). Lighter dots = regular weeks.
- Horizontal dashed lines = target scores.

### /partners

- **Partner list:** Shows accepted partners with their objective name, current week label, and session overview.
- **Invite form:** Email-based invite to connect with another Summit user.
- **Pending invites:** Shows sent/received invites with accept/decline actions.
- **Partner week view:** Click a partner to see their current week's sessions with completion status, environment tags, and session matching against your own week.
- **Score sharing toggle:** Opt-in per partnership. Both partners must opt in for scores to be visible. Toggle via PartnerScoreToggle component.
- **Session matching:** Highlights overlapping sessions (same dimension, same environment, or both) between you and a partner. Matches shown inline with badges.
- **Partner notifications:** Banner on dashboard when a partner has overlapping sessions this week. Notifications are auto-generated when sessions are generated (fire-and-forget via `checkAndCreateNotifications()`). Dismissable.
- **Remove partner:** Deletes partnership and all related notifications.

### /admin/objectives (validator only — currently single tab, planned 5 tabs)

Only accessible if `profiles.is_validator = true`. Auth guard in `(app)/layout.tsx` checks `is_validator` flag and passes to AppShell.

**Currently implemented: Objectives tab only**

- List view of all validated_objectives with search/filter by type.
- Click to expand inline editing: name, route, type (dropdown), difficulty (dropdown), description, physical stats, match_aliases, status.
- “Add New” button.
- Edit + Save buttons per objective.

**Planned (not yet built): Full 5-tab admin portal**

**Tab 1: Objectives (expand existing)**

- Add columns: status, user match count.
- Add filters: difficulty, status, tags.
- Add inline editing for:
  - **Target Scores:** 4 number inputs (cardio, strength, climbing_technical, flexibility) with tagline text fields next to each.
  - **Relevance Profiles (inline):** For each dimension, show key components and irrelevant components as editable lists. Each component has: text (editable), vote count from component_feedback (read-only). Add component button. Delete component button.
  - **Graduation Benchmarks (inline):** For each dimension, show assigned benchmark exercises with their graduation targets. Each benchmark row: exercise name (dropdown from benchmark_exercises library), graduation target (editable text). Add benchmark button. Remove benchmark button.
  - **Recommended weeks:** number input.
  - **Metadata:** created_by, last_reviewed (auto-updates on save).
- “Retire” button sets status = retired (soft delete).

**Tab 2: Exercises**

- List view of all benchmark_exercises with columns: name, dimension, measurement type, status, usage count (how many validated objectives reference this exercise).
- Search and filter by dimension, tags, gym-reproducible.
- Click to expand inline editing:
  - Name, description (textarea — should be clear enough to follow without a coach).
  - Dimension (dropdown), tags (editable tag list), equipment_required (editable list).
  - is_gym_reproducible (checkbox).
  - Difficulty scale: beginner, intermediate, strong, elite targets (4 text fields).
  - Measurement type (dropdown: reps/time/distance/pass_fail/self_rated), measurement unit.
  - **Cross-reference (read-only):** List of validated objectives that use this exercise with their graduation targets. Click to jump to that objective in Tab 1.
- “Add New Exercise” button.
- “Save” persists to Supabase.

**Tab 3: Feedback**

- Shows all component_feedback rows, grouped by objective.
- Filter by: dimension, objective type, vote direction, component type (key/irrelevant/user_added).
- Sort by: most upvoted, most recent, most controversial (high votes both directions).
- Each feedback item shows: component text, dimension, vote (up/down), user who submitted, objective name.
- **Pending queue:** User-added components that haven’t been reviewed. Admin can:
  - “Approve” → adds the component to the validated objective’s canonical relevance profile.
  - “Reject” → removes from queue, keeps in feedback table for record.
  - “Edit & Approve” → modify text before adding to canonical profile.
- **Trending view:** Components with 3+ upvotes across similar objective types, not yet in canonical profiles. Candidates for addition.

**Tab 4: Activity**

- **Usage stats:** Total users, active plans, objectives created this month.
- **Popular objectives:** Table of validated objectives sorted by match count. Shows Gold/Silver/Bronze breakdown.
- **Novel objective candidates:** Table of user-created objectives that are Bronze tier, sorted by frequency. Shows: objective name, route (if provided), type, how many users created it, average AI-generated target scores. These are candidates for your team to validate and promote to the library.
  - “Promote to Validated” button → pre-fills a new validated objective form in Tab 1 with the AI-generated data as starting point.
- **Tier distribution:** Simple chart showing % of objectives that are Gold/Silver/Bronze.

**Tab 5: AI Review**

- Shows AI-generated outputs for Silver and Bronze tier objectives.
- Filter by: tier, objective type, date range.
- Each row shows: user’s objective name, tier, AI-generated target scores, AI-generated taglines, AI-generated graduation benchmarks.
- Expandable to see full relevance profiles.
- **Quality flags:** Admin can mark an AI output as:
  - “Looks good” — no action needed.
  - “Needs adjustment” — flag for review, add a note.
  - “Promote to validated” — takes the AI output, opens it in Tab 1 for refinement, then saves as a validated objective.
- This is how you catch bad AI outputs and also discover new objectives to add to the library.

### Validator overlay on objective detail page (user-facing)

- On the regular /plan or objective detail page, if is_validator.
- Shows relevance profile components per dimension with upvote/downvote buttons.
- “Add missing component” text input per dimension.
- Vote counts displayed.
- This is the lightweight feedback mechanism. The admin portal (Tab 3) is where you review and act on it.

-----

## Implementation Status

### Completed

1. **AI relevance evaluation on non-3 ratings** — Prompt 3B fully implemented in `/api/complete-week`. Comment required for non-3 ratings, AI adjusts multiplier ±0.25 with clamping.
1. **Assessment redesign** — Two-layer assessment fully implemented. Standard questions → AI-generated follow-ups (lead/follow first for climbing objectives) → AI scoring with reasoning + programming hints. Objective-first flow. Prompts ASSESS-Q and ASSESS-SCORE wired end-to-end.
1. **Max hours update** — Cap changed from 10 to 20.
1. **Weekly report** — Prompt REPORT and `/api/generate-weekly-report` implemented. Client-triggered (not background async, due to Vercel serverless limitations). 5 sections with markdown rendering. “View Report” button on completed weeks with polling.
1. **Delete assessment endpoint** — `/api/delete-assessment` implemented (resets scores to 0, preserves plan).
1. **Switched all Claude API calls to Opus** — Default model in `callClaude()` and `callClaudeWithCache()` changed from sonnet to opus (`claude-opus-4-20250514`).
1. **Training partners** — Full partner system implemented. Email-based invites, accept/decline, bi-directional score sharing (opt-in), session matching (by dimension and environment), partner notifications on session generation, partner week view. 8 API routes, 7 components, `/partners` page in main nav. Database: `partnerships` and `partner_notifications` tables with RLS.
1. **AI loading indicators** — `AILoadingIndicator` component with rotating messages, elapsed timer, and size variants. Used across assessment, plan generation, and session generation flows.
1. **Design system overhaul** — New typography, alpine color palette refinements, improved contrast on mountain background with backdrop cards, fixed text visibility across app.
1. **Flexibility info bubbles** — Hip mobility and ankle mobility assessment questions include expandable `InfoBubble` components with detailed self-assessment guidance (1–5 scale descriptions).
1. **Session naming convention** — Consistent naming pattern added to Prompt 2B for generated sessions.
1. **Auto-expand plan sections** — Philosophy and graduation sections auto-expand on first plan visit.

### Features Not Yet Built (Priority Order)

1. **Full admin portal** — Currently only Objectives tab exists at `/admin/objectives` with basic list + inline editing. Missing: Exercises tab (with cross-references), Feedback tab (vote aggregation + approval queue), Activity tab (usage stats + novel objective candidates), AI Review tab (audit Silver/Bronze outputs). Also missing: inline relevance profile and graduation benchmark editing in Objectives tab.
1. **Week type scheduling** — All weeks are generated as `weekType: “regular”`. Test, recovery, and taper week type assignment is not implemented in plan generation (schema supports it, UI supports badges, but plan generator doesn't schedule them).
1. **Validator overlay UI** — Lightweight upvote/downvote on objective detail page for validators.
1. **Route recommendations UI** — “Find Routes” on cardio sessions. `/api/find-routes` exists but `web_search` tool not enabled.
1. **Score chart on dashboard** — Compact line chart from score_history.
1. **AI-powered rebalancing** — Prompt 4 exists but not called. Math-only works for now.

-----

## Seed Data

15 validated objectives seeded:

1. Half Dome (Mist Trail + Cables)
1. Colorado 14er Class 1–2
1. Mt. Whitney (Main Trail)
1. Mont Blanc (Goûter Route)
1. Mt. Rainier (Disappointment Cleaver)
1. Denali (West Buttress)
1. Grand Teton (Upper Exum Ridge)
1. Cathedral Peak (SE Buttress)
1. Trail Half Marathon
1. 50K Mountain Ultra
1. Colorado 14er Class 3–4
1. Enchantments Traverse
1. John Muir Trail
1. Kilimanjaro (Machame Route)
1. Tour du Mont Blanc

15 benchmark exercises seeded (3 cardio, 5 strength, 3 climbing, 3 flexibility + 1 flexibility).

Seed data is defined in `src/lib/seed-data.ts`. The `findSeedMatch(name, route?)` function looks up objectives from the hardcoded array. Seed data takes precedence over DB records (authoritative source for Gold tier objectives).

-----

## Key Library Files

| File | Purpose |
|------|---------|
| `src/lib/claude.ts` | `callClaude()`, `callClaudeWithCache()`, `parseClaudeJSON<T>()`. Default model: opus. Timeout: 120s. Cache uses ephemeral `cache_control`. |
| `src/lib/prompts.ts` | All AI prompt constants (PROMPT_1, 2, 2A, 2B, 3B, 4, 5, 6, ASSESS_Q, ASSESS_SCORE, RESCALE_BENCHMARKS, SEARCH, REPORT). Includes MTI reference URLs. |
| `src/lib/scoring.ts` | `calculateScoreFromRatings()`, `calculateAllScoresFromRatings()`, `expectedScoreAtWeek()`, `shouldHighlightRebalance()`, `scoreArcColor()`, `calculateSessionMinutes()`, `scaleDifficultyTargets()`, `dimensionProgressFractions()`. |
| `src/lib/types.ts` | All TypeScript types: `Profile`, `ValidatedObjective`, `Objective`, `Assessment`, `TrainingPlan`, `WeeklyTarget`, `PlanSession`, `WorkoutLog`, `ScoreHistory`, `ComponentFeedback`, `WeeklyReport`, `ProgrammingHints`, `DimensionScores`, `RATING_MULTIPLIERS`, `Partnership`, `PartnerNotification`, `MatchResult`, `PartnerSession`, `AcceptedPartner`, `PendingPartner`, `PartnerListResponse`, `PartnerWeekResponse`. |
| `src/lib/seed-data.ts` | Hardcoded 15 validated objectives + 15 benchmark exercises. `findSeedMatch()` for authoritative Gold tier lookups. |
| `src/lib/generate-report.ts` | `generateWeeklyReport()` — fetches all data for a completed week and calls Claude with PROMPT_REPORT. Stores result in `weekly_targets.weekly_report`. |
| `src/lib/session-matching.ts` | `inferSessionEnvironment()`, `findPartnerMatches()`, `generateMatchSummary()`, `strongestMatchType()`. Keyword-based environment inference for sessions (gym/outdoor/climbing_gym/crag/home). Greedy best-match pairing between two users' weekly sessions by dimension and environment. |
| `src/lib/partner-notifications.ts` | `checkAndCreateNotifications()` — fire-and-forget function called after session generation. Checks all accepted partnerships, runs session matching, creates bidirectional notifications via service client. |
| `src/lib/unsplash.ts` | `fetchHeroImageUrl()` — fetches Unsplash image URL for objective (non-blocking, used in plan generation). |
| `src/lib/supabase.ts` | Browser-side Supabase client (SSR pattern). |
| `src/lib/supabase-server.ts` | Server-side Supabase client using cookies (for API routes). |
| `src/lib/supabase-service.ts` | Service role Supabase client (bypasses RLS, used for cross-user queries in partner features). |
| `src/lib/supabase-middleware.ts` | Supabase session lifecycle management for SSR. |
| `src/lib/use-plan-data.ts` | `usePlanData()` — SWR-based hook for fetching and caching plan data (plan, weeks, objective, assessment, workout logs) on the client. |
| `src/middleware.ts` | Next.js middleware for session refresh on all routes (except static assets). |

## Database Migrations

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables (profiles, validated_objectives, benchmark_exercises, objectives, assessments, score_history, training_plans, weekly_targets, workout_logs, component_feedback) + RLS policies |
| `002_assessment_redesign.sql` | Added objective_id FK to assessments, standard_answers, ai_questions, ai_answers, freeform_text, ai_reasoning, raw_data fields |
| `003_ai_relevance_and_max_hours.sql` | Added climbing_role to objectives, rating_comment to workout_logs. Max weekly hours updated to 20. |
| `004_weekly_report.sql` | Added weekly_report JSONB column to weekly_targets |
| `005_performance_indexes_and_rls.sql` | Performance indexes + RLS policy refinements |
| `006_training_partners.sql` | Added `partnerships` and `partner_notifications` tables with RLS policies and indexes |
| `007_fix_partner_notifications_cascade.sql` | Added ON DELETE CASCADE to plan_id and partner_plan_id FKs on partner_notifications, added DELETE RLS policy |

## Components

| Component | File | Purpose |
|-----------|------|---------|
| AppShell | `src/components/AppShell.tsx` | Layout with header, nav (Dashboard, Plan, Progress, Partners, Admin if validator), mountain bg image |
| ScoreArc | `src/components/ScoreArc.tsx` | 4 progress arc displays (current vs target, green/yellow/red) |
| ThisWeekSessions | `src/components/ThisWeekSessions.tsx` | Dashboard widget showing current week's sessions with "Mark Complete" |
| DeletePlanButton | `src/components/DeletePlanButton.tsx` | Delete plan with confirmation dialog |
| DeleteAssessmentButton | `src/components/DeleteAssessmentButton.tsx` | Delete assessment with confirmation dialog |
| UpdateAssessmentButton | `src/components/UpdateAssessmentButton.tsx` | Re-assess objective button |
| ObjectiveModal | `src/components/ObjectiveModal.tsx` | Create/edit objectives in calendar (with search mode) |
| AlternativesPanel | `src/components/AlternativesPanel.tsx` | Shows 2 AI-generated alternative sessions per session |
| WeekBadge | `src/components/WeekBadge.tsx` | Week type badge (test=blue, recovery=green, regular, taper=amber) |
| AILoadingIndicator | `src/components/AILoadingIndicator.tsx` | Animated loading indicator with rotating messages, elapsed timer, and sm/md/lg size variants |
| InfoBubble | `src/components/InfoBubble.tsx` | Expandable info tooltip rendered via portal, used for assessment guidance text |
| AddObjectiveButton | `src/components/AddObjectiveButton.tsx` | Dashboard CTA that opens ObjectiveModal for first objective creation |
| SyncUpButton | `src/components/SyncUpButton.tsx` | "Try Different" button on sessions — fetches and displays alternative sessions |
| PartnerList | `src/components/PartnerList.tsx` | Renders accepted partners (with session overview) and pending invites with accept/decline |
| PartnerCard | `src/components/PartnerCard.tsx` | Individual partner card showing objective, week, and session summary |
| PartnerInviteForm | `src/components/PartnerInviteForm.tsx` | Email input form for sending partner invitations |
| PartnerWeekView | `src/components/PartnerWeekView.tsx` | Expanded view of a partner's current week with sessions, matches, and optional scores |
| PartnerSessionCard | `src/components/PartnerSessionCard.tsx` | Individual session card in partner week view with environment badge and completion status |
| PartnerScoreToggle | `src/components/PartnerScoreToggle.tsx` | Toggle switch for opting in/out of score sharing per partnership |
| PartnerNotificationBanner | `src/components/PartnerNotificationBanner.tsx` | Dashboard banner showing partner session overlap notifications with dismiss action |

-----

## Build Order (remaining work)

1. **Admin portal expansion** — Add 4 missing tabs (Exercises, Feedback, Activity, AI Review) to `/admin/objectives`. Add inline relevance profile and graduation benchmark editing to Objectives tab. All inline editing with direct Supabase persistence.
1. **Week type scheduling** — Implement test/recovery/taper week assignment in `/api/generate-plan`. Currently all weeks are “regular”. Need: test weeks with benchmark sessions, recovery weeks at 50% volume with no scoring, taper (final 2 weeks) with locked scores.
1. **Validator overlay** — Build lightweight UI on objective detail page for is_validator users.
1. **Route recommendations** — Wire /api/find-routes into cardio session cards. Enable web_search tool.
1. **Dashboard score chart** — Add compact line chart from score_history to /dashboard.
1. **AI-powered rebalancing** — Prompt 4 via Claude for session regeneration (currently math-only).

-----

## Design Context

### Users

Summit serves a wide spectrum — from someone whose first objective is Half Dome or a Colorado 14er, to a serious athlete training for Denali or the Grand Teton. What unites them isn't skill level but intent: they have a specific objective in mind and want a structured, intelligent path to get there. They are self-directed, goal-oriented, and willing to do the work. They are not looking for a cheerleader — they want to know exactly where they stand and what to do next.

**Context of use**: Mostly at home, post-workout, planning the week ahead. Occasionally glanced at in the field. Rarely used casually — there's always a purpose.

**Job to be done**: "Build me toward this specific summit. Tell me honestly where I am. Tell me what to do this week."

### Brand Personality

**Purposeful. Ambitious. Human.**

Summit is a serious coach that also respects you as a person. It doesn't talk down, doesn't over-celebrate every small win, and doesn't pad the difficulty. But it's not cold either — it understands that these objectives mean something to the people pursuing them. Mont Blanc is not just a number on a spreadsheet. The tone is direct, warm, earned. Like an experienced guide who believes in you without patronizing you.

**Voice**: Concise and clear. No fluff. Coaching language, not fitness influencer language. MTI-inspired — "you'll need 700 loaded step-ups in 30 min" not "crush your goals."

**Anti-references**: Generic fitness apps (MyFitnessPal energy), crypto/luxury aesthetic (gold-on-black, glowing accents), corporate wellness dashboard vibes.

### Aesthetic Direction

**Dark theme. Keep it.**

The mountain-photo-with-dark-overlay is the right instinct — it grounds the app in the landscape. The execution needs refinement: the current gold `#D4A017` reads as crypto/luxury rather than alpine, and Arial as the body font is a non-choice.

**Primary references**: Strava and Whoop — data-forward, dark, motivational without being flashy. Serious fitness interfaces that respect the athlete's intelligence.

**Visual tone**: Deep alpine dark. Not pure black — closer to the color of the sky just before dawn on a high ridge. Warm, textured darkness (think dark forest, not dark mode UI). Accents should feel earned — the burnt orange `#D4782F` and forest green `#1B4D3E` in the Design System section are the right accent colors; replace the current gold `#D4A017`.

**Typography**: A distinctive display font for headings (something with weight and character — not geometric sans, not system default). Clean, highly legible body font. Type hierarchy is critical — this is a data-rich app.

**Photography**: The mountain background is a core design element. It should feel like you're looking at the objective, not just a stock photo. Treat it as a full-bleed atmospheric layer. The current `bg-black/50` overlay is too heavy — reduce to 25–35% to let the landscape show through.

**What should change**:
- Replace gold `#D4A017` with burnt orange `#D4782F` as the primary action/CTA color
- Introduce forest green `#1B4D3E` as a secondary accent (active states, progress indicators)
- Replace Arial with a real font pairing (distinctive display + legible body)
- Lighten the photo overlay from 50% to ~30% black

### Design Principles

1. **The objective is always present.** Every screen should subtly remind the user what they're training toward — the mountain, the date, the gap. Purpose drives motivation.
2. **Data first, decoration second.** Score arcs, progress lines, session details — this is what users come for. Visuals exist to make data legible, not to fill space.
3. **Earn the complexity.** The app is sophisticated under the hood. The interface should feel like that intelligence is working *for* the user, not exposing itself. Progressive disclosure over dumping everything at once.
4. **Direct without harsh.** Copy should state facts clearly and suggest actions specifically. No hedging, no over-praising. The user is an adult who can handle honest coaching.
5. **Atmosphere, not decoration.** The dark theme and mountain photography are not decorative choices — they create the psychological context of altitude, commitment, and the outdoors. Every visual decision should serve that atmosphere or make data more readable.