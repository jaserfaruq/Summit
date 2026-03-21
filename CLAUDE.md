# Summit Planner — Implementation Specification v2

> **READ THIS FILE AT THE START OF EVERY SESSION.** This is the complete specification for Summit Planner, updated to reflect the current state of the codebase after the full-build audit (March 2026). Do not deviate from these schemas, scoring rules, or prompt designs without explicit instruction from the user. For product rationale, design history, and detailed context, see `docs/PRODUCT_GUIDE.md` in this repo.

-----

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database + Auth:** Supabase (PostgreSQL, Row Level Security, Auth with email/password)
- **AI:** Anthropic Claude API — `claude-sonnet-4-20250514` (default), `claude-opus-4-20250514` (session generation)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Prompt Caching:** `callClaudeWithCache()` with ephemeral cache control

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
  week_type TEXT NOT NULL,       -- test | recovery | regular | taper
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
**Logic:** Call Claude API with Prompt 1. Parse JSON response.
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
1. Call Claude with Prompt ASSESS-SCORE with all data including climbing role from AI answers.
1. If climbing role = “follow”, update objective’s target scores and graduation benchmarks with the adjusted values from the AI response.
1. Store climbing_role on the objective.
1. Store assessment with all fields (standard_answers, ai_questions, ai_answers, freeform_text, ai_reasoning).
1. Store `programmingHints` in the assessment’s raw_data field — the plan generator uses these.
1. Update current scores on objective.
1. Write to score_history with confidence = “low”.
   **Output:** `{ scores, reasoning, programmingHints, adjustedTargets?, climbingRole }`

### POST /api/generate-plan

**Input:** `{ userId, objectiveId, assessmentId }`
**Logic:**

1. Fetch objective (including climbing_role), assessment (including programmingHints from raw_data), graduation benchmarks.
1. Calculate weeks available.
1. Create plan structure with linear interpolation for expected scores per week.
1. Use programmingHints.sessionsPerWeek per dimension to allocate time across dimensions (instead of equal allocation).
1. Schedule week types (test/recovery/regular/taper).
1. Calculate hours per week using progressive volume formula.
1. Store plan in `training_plans` with empty sessions. Store programmingHints in plan_data so Prompt 2B can use them.
1. Store weeks in `weekly_targets`.
1. Sessions are generated on-demand via `/api/generate-week-sessions`.
1. Fetch Unsplash hero image for the objective.
   **Output:** `{ planId, weekCount }`
   **Note:** Does NOT call Claude for sessions. Structure only. ProgrammingHints from assessment flow through to session generation.

### POST /api/generate-week-sessions

**Input:** `{ planId, weekNumber }`
**Logic:** Call Claude with Prompt 2B to generate sessions for a single week. Passes the programmingHints from the assessment so the AI adapts starting intensity, session content, and coaching voice to the athlete’s specific profile. Uses `claude-opus-4-20250514` model. Stores sessions in `weekly_targets.sessions`.
**Output:** `{ sessions[] }`

### POST /api/generate-all-sessions

**Input:** `{ planId }`
**Logic:** Batch-generates all remaining weeks, up to 3 concurrent calls.
**Output:** `{ generatedWeeks[] }`

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
1. **Trigger background report generation:** Fire `/api/generate-weekly-report` asynchronously (don’t wait for it). The report generates in the background.
   **Output:** `{ updatedScores, rebalanceTriggered }`

### POST /api/generate-weekly-report

**Input:** `{ planId, weekNumber }`
**Logic:**

1. Fetch: weekly_target (sessions, expected_scores, week_type), workout_logs for this week, score_history entries for this week and previous week, objective (target scores, relevance profiles, taglines), AI relevance evaluation results (multiplier adjustments and explanations from Prompt 3B).
1. Call Claude with Prompt REPORT (see below).
1. Store the report in `weekly_targets.weekly_report` as JSON.
1. **This runs in the background** — the user doesn’t wait for it. The UI polls or checks for the report and shows a “View Report” button on the week card when it’s available.
   **Output:** `{ report }` (stored, not returned to user directly)

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

**Input:** `{ planId, weekNumber, sessionIndex, dimension }`
**Logic:** Call Claude with Prompt 6 to generate 2 alternative sessions. Provides outdoor/gym cardio options, bodyweight/equipment strength options, etc.
**Output:** `{ alternatives: [session, session] }`

### POST /api/replace-session

**Input:** `{ planId, weekNumber, sessionIndex, alternativeIndex }`
**Logic:** Swaps session with selected alternative. Preserves original.
**Output:** `{ updatedSession }`

### POST /api/adjust-difficulty

**Input:** `{ planId, adjustment: "much_easier" | "slightly_easier" | "slightly_harder" | "much_harder" }`
**Logic:** Call Claude with Prompt RESCALE. Scale factors: much_easier=0.60, slightly_easier=0.80, slightly_harder=1.20, much_harder=1.50. Applied to remaining gap between current and target scores.
**Output:** `{ updatedTargetScores, updatedBenchmarks }`

### POST /api/find-routes

**Input:** `{ location, targetDistance, targetElevation, preferences }`
**Logic:** Call Claude with Prompt 5. **TODO: Enable `web_search` tool for real results.**
**Output:** `{ routes[] }`

### POST /api/delete-plan

**Input:** `{ planId }`
**Logic:** Cascading delete of plan + objective + weekly targets.
**Output:** `{ success }`

### POST /api/delete-workout

**Input:** `{ workoutId }`
**Logic:** Deletes workout log. If week was already completed, reverts scores and week number.
**Output:** `{ updatedScores?, weekReverted? }`

### GET /api/debug-claude

Diagnostic endpoint for Claude API connectivity testing.

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
Rescale graduation benchmark targets proportionally.
Scale factors: much_easier=0.60, slightly_easier=0.80, slightly_harder=1.20, much_harder=1.50.
Apply to remaining gap between current and target scores.
Recalculate graduation targets to match new target scores.
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

### /assessment/[objectiveId]

Assessment is per-objective and happens AFTER creating the objective. Two layers:

**Layer 1: Standard Questions (same for everyone, ~2 minutes)**

- Training days per week
- Longest cardio effort in last 3 months (distance, duration, elevation gain)
- Strength training frequency and type (dropdown)
- Climbing experience level + skill checkboxes (indoor gym, outdoor sport, trad, multi-pitch, glacier, crevasse rescue)
- Flexibility self-assessment: hip tightness (1–5), ankle mobility (1–5), regular routine (yes/no)

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

### /admin (validator only — single page with 5 tabs)

Only accessible if `profiles.is_validator = true`. Redirects non-validators to /dashboard.

**Tab 1: Objectives**

- List view of all validated_objectives with columns: name, route, type, difficulty, status, user match count.
- Search and filter by type, difficulty, status, tags.
- Click any objective to expand inline editing panel showing ALL fields:
  - Core: name, route, match_aliases (editable tag list), type (dropdown), difficulty (dropdown), description (textarea), status (active/draft/retired).
  - Physical: summit_elevation_ft, total_gain_ft, distance_miles, duration_days, technical_grade.
  - Tags: editable tag list.
  - **Target Scores:** 4 number inputs (cardio, strength, climbing_technical, flexibility) with tagline text fields next to each.
  - **Relevance Profiles (inline):** For each dimension, show key components and irrelevant components as editable lists. Each component has: text (editable), vote count from component_feedback (read-only). Add component button. Delete component button.
  - **Graduation Benchmarks (inline):** For each dimension, show assigned benchmark exercises with their graduation targets. Each benchmark row: exercise name (dropdown from benchmark_exercises library), graduation target (editable text). Add benchmark button. Remove benchmark button.
  - **Recommended weeks:** number input.
  - **Metadata:** created_by, last_reviewed (auto-updates on save).
- “Add New Objective” button at top → opens empty form.
- “Save” button persists all changes directly to Supabase.
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

## Features Not Yet Built (Priority Order)

1. **AI relevance evaluation on non-3 ratings** — Prompt 3B. Comment required, AI adjusts multiplier ±0.25. The core product differentiator.
1. **Assessment redesign** — Two-layer assessment: standard questions + AI-generated objective-specific follow-ups (including lead/follow) + AI scoring with per-dimension reasoning + programming hints. Objective-first flow. Prompts ASSESS-Q and ASSESS-SCORE.
1. **Max hours update** — Change cap from 10 to 20.
1. **Weekly report** — AI-generated end-of-week report (Prompt REPORT). Background generation after week completion. 5 sections: summary, score changes with relevance explanations, trajectory status, next week focus, optional adjustment suggestions. “View Report” button on completed weeks.
1. **Admin portal** — Single page at /admin with 5 tabs: Objectives (with inline relevance profiles and graduation benchmarks), Exercises (with cross-references), Feedback (vote aggregation + approval queue), Activity (usage stats + novel objective candidates), AI Review (audit Silver/Bronze outputs). Replaces the current basic /admin/objectives page.
1. **Validator overlay UI** — Lightweight upvote/downvote on objective detail page for validators.
1. **Route recommendations UI** — “Find Routes” on cardio sessions. Enable web_search.
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

-----

## Build Order (remaining work)

1. **Assessment redesign** — Implement two-layer assessment (Prompts ASSESS-Q and ASSESS-SCORE). Standard questions → AI-generated follow-ups (lead/follow first for climbing objectives) → AI scoring with reasoning + programming hints. Flip flow to objective-first, then assess. Wire programming hints through to plan generation and Prompt 2B.
1. **AI relevance evaluation** — Implement Prompt 3B. Add mandatory comment field for non-3 ratings. Wire AI multiplier adjustment into /api/complete-week.
1. **Max hours update** — Change cap from 10 to 20.
1. **Weekly report** — Implement Prompt REPORT and /api/generate-weekly-report. Add weekly_report column to weekly_targets. Trigger background generation from /api/complete-week. Add “View Report” button on completed weeks in /plan.
1. **Admin portal** — Replace /admin/objectives with full 5-tab admin portal at /admin. Tabs: Objectives, Exercises, Feedback, Activity, AI Review. All inline editing with direct Supabase persistence.
1. **Validator overlay** — Build lightweight UI on objective detail page for is_validator users.
1. **Route recommendations** — Wire /api/find-routes into cardio session cards. Enable web_search tool.
1. **Dashboard score chart** — Add compact line chart from score_history to /dashboard.
1. **AI-powered rebalancing** — Prompt 4 via Claude for session regeneration (currently math-only).