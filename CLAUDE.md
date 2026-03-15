
# Summit Planner — Implementation Specification

> **READ THIS FILE AT THE START OF EVERY SESSION.** This is the complete specification for Summit Planner. Do not deviate from these schemas, scoring rules, or prompt designs without explicit instruction from the user. The companion guide (v6) contains rationale and product context.

-----

## Stack

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS
- **Database + Auth:** Supabase (PostgreSQL, Row Level Security, Auth with email/password)
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Deployment:** Vercel (auto-deploy from GitHub)

## Design System

- **Primary:** #1B4D3E (dark forest green) — headers, primary buttons, active states
- **Accent:** #D4782F (burnt orange) — callouts, warnings, CTAs
- **Background:** #F4F1EC (warm cream) — page backgrounds
- **Mid:** #8B9D83 (sage) — secondary text, borders
- **Test week blue:** #1A5276 — test week banners, benchmark indicators
- **Recovery green:** #2E7D32 — recovery week banners
- **Taper amber:** #F57F17 — taper week banners
- **Score arc colors:** Green (within 10 of target), Yellow (10–25 away), Red (25+ away)

-----

## Database Schema

### profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT,
  location TEXT,              -- city for route recommendations
  training_days_per_week INT DEFAULT 5,
  equipment_access TEXT[],     -- ['dumbbells', 'pull-up bar', 'loaded pack', 'climbing gym', etc.]
  is_validator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users can only read/update their own row
```

### validated_objectives

```sql
CREATE TABLE validated_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- "Mont Blanc"
  route TEXT NOT NULL,          -- "Goûter Route (Voie Normale)"
  match_aliases TEXT[] NOT NULL, -- ['mont blanc', 'mont blanc normal route', 'mont blanc gouter', 'mont blanc from saint-gervais']
  type TEXT NOT NULL,           -- hike | trail_run | alpine_climb | rock_climb | mountaineering | scramble | backpacking
  difficulty TEXT NOT NULL,     -- beginner | intermediate | advanced | expert
  description TEXT,
  summit_elevation_ft INT,
  total_gain_ft INT,
  distance_miles FLOAT,
  duration_days INT,
  technical_grade TEXT,         -- PD, 5.7, Class 3, etc.
  tags JSONB NOT NULL,          -- ["high-altitude", "glacier", "heavy-pack", "multi-day", "trad-climbing"]
  target_scores JSONB NOT NULL, -- {cardio: 78, strength: 58, climbing_technical: 12, flexibility: 45}
  taglines JSONB NOT NULL,      -- {cardio: "Sustained effort in thin air", ...}
  relevance_profiles JSONB NOT NULL,  -- {cardio: {summary, keyComponents[], irrelevantComponents[]}, ...}
  graduation_benchmarks JSONB NOT NULL, -- {cardio: [{exerciseId, graduationTarget, whyThisTarget}], ...}
  recommended_weeks INT,
  created_by TEXT,
  last_reviewed DATE,
  status TEXT DEFAULT 'active'  -- active | draft | retired
);
-- RLS: readable by all authenticated users (reference data)
```

### benchmark_exercises

```sql
CREATE TABLE benchmark_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- "Timed Loaded Step-Ups"
  description TEXT NOT NULL,     -- full instructions
  dimension TEXT NOT NULL,       -- cardio | strength | climbing_technical | flexibility
  tags JSONB NOT NULL,           -- ["heavy-pack", "gym-reproducible", "altitude"]
  equipment_required TEXT[],     -- ["16-inch box", "25lb pack"]
  is_gym_reproducible BOOLEAN DEFAULT TRUE,
  difficulty_scale JSONB,        -- {beginner: "200 reps/30min @ 25lb", intermediate: "400", strong: "550 @ 35lb", elite: "700+"}
  measurement_type TEXT NOT NULL, -- reps | time | distance | pass_fail | self_rated
  measurement_unit TEXT,          -- reps, seconds, meters, inches, 1-5 scale
  created_by TEXT,
  status TEXT DEFAULT 'active'
);
-- RLS: readable by all authenticated users (reference data)
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
  -- Target scores (what's needed)
  target_cardio_score INT NOT NULL,
  target_strength_score INT NOT NULL,
  target_climbing_score INT NOT NULL,
  target_flexibility_score INT NOT NULL,
  -- Current scores (where user is now)
  current_cardio_score INT DEFAULT 0,
  current_strength_score INT DEFAULT 0,
  current_climbing_score INT DEFAULT 0,
  current_flexibility_score INT DEFAULT 0,
  -- AI-generated or pulled from validated library
  taglines JSONB NOT NULL,             -- {cardio: "Sustained effort in thin air", ...}
  relevance_profiles JSONB NOT NULL,   -- {cardio: {summary, keyComponents[], irrelevantComponents[]}, ...}
  graduation_benchmarks JSONB NOT NULL, -- {cardio: [{exerciseId, exerciseName, graduationTarget}], ...}
  -- Tier tracking
  matched_validated_id UUID REFERENCES validated_objectives(id),  -- null for Silver/Bronze
  tier TEXT NOT NULL DEFAULT 'bronze',  -- gold | silver | bronze
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users can only see their own objectives
```

### assessments

```sql
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  assessed_at TIMESTAMPTZ DEFAULT now(),
  cardio_score INT NOT NULL,
  strength_score INT NOT NULL,
  climbing_score INT NOT NULL,
  flexibility_score INT NOT NULL,
  raw_data JSONB              -- full questionnaire responses
);
-- RLS: users own their assessments
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
  change_reason TEXT NOT NULL,  -- assessment | test_week | regular_week | rebalance
  is_test_week BOOLEAN DEFAULT FALSE,
  confidence TEXT DEFAULT 'low', -- high (test week) | low (regular week or assessment)
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
  created_at TIMESTAMPTZ DEFAULT now(),
  plan_data JSONB NOT NULL,           -- full plan JSON from Claude
  graduation_workouts JSONB NOT NULL, -- the graduation benchmarks snapshot
  status TEXT DEFAULT 'active'        -- active | completed | superseded
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
  expected_scores JSONB NOT NULL, -- {cardio: 48, strength: 35, ...} linear interpolation
  sessions JSONB NOT NULL         -- array of session objects (full detail)
);
-- RLS: via plan ownership
```

### workout_logs

```sql
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  logged_date DATE NOT NULL,
  dimension TEXT NOT NULL,        -- cardio | strength | climbing_technical | flexibility
  duration_min INT,
  details JSONB,                  -- free-form: {activity, distance, elevation, exercises, etc.}
  benchmark_results JSONB,        -- test week only: {exerciseId, result, graduationTarget, percentComplete}
  completed_as_prescribed BOOLEAN DEFAULT FALSE,
  session_name TEXT,              -- which plan session this corresponds to
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
  component_type TEXT NOT NULL,   -- key | irrelevant | user_added
  vote TEXT NOT NULL,             -- up | down
  objective_type TEXT,
  objective_tags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: validators can read/write; regular users cannot access
```

-----

## API Routes

### POST /api/match-objective

**Input:** `{ name, route, type, details }`
**Logic:**

1. Normalize input (lowercase, trim).
1. Check `validated_objectives.match_aliases` for fuzzy match (case-insensitive, partial match).
1. If exact match found → return full validated objective data + `tier: "gold"`.
1. If no exact match, find validated objectives with matching `type` and overlapping `tags` → return as `anchors[]` + `tier: "silver"`.
1. If no similar objectives → return `tier: "bronze"` with empty anchors.
   **Output:** `{ tier, validatedObjective?, anchors[], tier }`

### POST /api/estimate-scores

**Input:** `{ objectiveDetails, benchmarkExercises[], anchors[], validatorFeedback[] }`
**Logic:** Call Claude API with Prompt 1 (see below). Parse JSON response.
**Output:** `{ dimensions, relevanceProfiles, graduationBenchmarks }`

### POST /api/generate-plan

**Input:** `{ userId, objectiveId, assessmentId }`
**Logic:**

1. Fetch objective (with target scores, current scores, graduation benchmarks, relevance profiles).
1. Fetch assessment.
1. Calculate weeks available from now to target_date minus 2 (taper).
1. Call Claude API with Prompt 2 (see below).
1. Parse JSON response.
1. Store plan in `training_plans`.
1. Store each week in `weekly_targets`.
   **Output:** `{ planId, weekCount }`

### POST /api/complete-week

**Input:** `{ planId, weekNumber, workoutLogs[] }`
**Logic:**

1. Fetch the weekly_target to get `week_type`.
1. **If week_type = “test”:**
- For each dimension, find benchmark_results in the logs.
- Calculate: `dimensionScore = (avg of min(result/target, 1.0) across benchmarks) × targetScore`.
- Write to score_history with `is_test_week = true, confidence = "high"`.
- Update current scores on objective.
- Compare actual scores to expected_scores. If any dimension is 3+ points off, trigger rebalancing (call Prompt 4).
1. **If week_type = “regular”:**
- Call Claude API with Prompt 3, passing logs + relevance profiles.
- Apply adjustments (max ±3 per dimension).
- Write to score_history with `is_test_week = false, confidence = "low"`.
- Update current scores on objective.
- If any dimension estimated 5+ points below expected, trigger Tier 2 emergency rebalancing.
1. **If week_type = “recovery” or “taper”:** No score changes. Skip.
   **Output:** `{ updatedScores, rebalanceTriggered, adjustmentDetails }`

### POST /api/rebalance

**Input:** `{ planId, currentWeek, actualScores, expectedScores, targetScores, tier (1 or 2) }`
**Logic:** Call Claude API with Prompt 4. If Tier 1, regenerate all remaining weeks. If Tier 2, adjust next 1–2 weeks only. Update weekly_targets in database.
**Output:** `{ updatedWeeks[] }`

### POST /api/find-routes

**Input:** `{ location, targetDistance, targetElevation, preferences }`
**Logic:** Call Claude API with Prompt 5 (web search enabled).
**Output:** `{ routes[] }`

-----

## Scoring Rules

### Formula

```
dimensionScore = avg(min(benchmarkResult / graduationTarget, 1.0) for each benchmark) × targetScore
```

### Week types (never overlap)

|Type    |Volume|Benchmarks           |Scoring                   |Rebalancing                 |
|--------|------|---------------------|--------------------------|----------------------------|
|test    |75–80%|Yes (3 of 5 sessions)|High-confidence formula   |Full rebalance if 3+ pts off|
|recovery|50%   |No                   |No changes                |No                          |
|regular |100%  |No                   |AI estimate ±1–3 pts      |Emergency if 5+ pts behind  |
|taper   |60%   |No                   |No changes (scores locked)|No                          |

### Week scheduling (16-week example)

```
W1: regular (self-assessment scores)
W2: test (optional early calibration — highlighted in UI)
W3-W4: regular
W5: test
W6: recovery
W7-W8: regular
W9: test
W10: recovery
W11-W12: regular
W13: test (final)
W14-W15: taper
W16: taper → OBJECTIVE
```

### Expected scores

Linear interpolation from current to target across plan duration. If cardio starts at 35 and target is 78 over 16 weeks: expected at week N = 35 + (78-35) × (N/16).

### Exceeded benchmarks

Cap at 100% for scoring. Surface to user: “Your cardio exceeds requirements.”

### Quick-log

- “Mark Complete” button on each session → sets `completed_as_prescribed = true`, logs session data from plan.
- “Log Different” → free-form entry.
- Benchmark sessions on test weeks always require structured entry (exact numbers).

### Dynamic rebalancing

- After test week: compare actual vs expected per dimension. If any 3+ pts off → Tier 1 full rebalance.
- During regular week: if AI estimates any dimension 5+ pts below trajectory → Tier 2 emergency (next 1–2 weeks only).
- Ahead dimension drops to maintenance (never below 60% of planned volume).
- Behind dimensions get the freed time.
- Multiple behind → prioritize highest target score.
- Never rebalance during recovery or taper weeks.

-----

## AI Prompts

### Prompt 1: Target Score Estimation & Graduation Benchmarks

**System prompt:**

```
You are an expert mountain athletics coach who assesses the physical demands of mountaineering, alpine climbing, and trail running objectives. Given an objective's details, you evaluate the fitness required across four fixed dimensions and define what each dimension specifically means for this objective.

The four training dimensions are fixed: Cardio, Strength, Climbing/Technical, and Flexibility. For each dimension, generate:

1. A target score (0–100). Scoring scale: 0 = no capacity, 25 = beginner, 50 = intermediate recreational athlete, 75 = strong amateur, 100 = elite/professional. Target scores should reflect 'ready to do this safely and enjoyably,' not bare minimum survival.

2. A tagline of 4–7 words: vivid coach shorthand for what this dimension means for this objective.

3. A relevance profile with keyComponents (7–10 items) and irrelevantComponents (7–10 items). Components should be at a practical level — the kind of thing a coach writes on a whiteboard. Broad surface area across the dimension, not drilling deep into one sub-area. Each component should be distinct enough that a coach could look at a training log and say 'yes, this trained that component' or 'no, it didn't.'

4. Graduation benchmarks: 2–4 benchmark exercises per dimension selected from the provided benchmark exercise library. For each, set an objective-specific graduation target. The graduation workout represents the exact performance level needed to complete this objective safely and comfortably. Cardio: 1–2 benchmarks. Strength: 2–4. Climbing/Technical: 1–3. Flexibility: 1–3. The exact count depends on the objective's demands.

[If validated feedback exists:] Experienced validators have confirmed these components for similar objectives: {insert aggregated feedback}. Use this to refine your assessment.

[If calibration anchors exist:] Here are calibrated profiles for similar validated objectives: {insert closest matches with their full profiles}. Use these as anchors to calibrate your assessment relative to known standards.

Select benchmark exercises ONLY from the provided library. Do not invent new exercises.

Return only valid JSON matching this schema:
{
  "dimensions": {
    "cardio": { "tagline": "string (4-7 words)", "targetScore": number },
    "strength": { "tagline": "string", "targetScore": number },
    "climbing_technical": { "tagline": "string", "targetScore": number },
    "flexibility": { "tagline": "string", "targetScore": number }
  },
  "relevanceProfiles": {
    "cardio": {
      "summary": "string (2-3 sentences)",
      "keyComponents": ["string", ...7-10 items],
      "irrelevantComponents": ["string", ...7-10 items]
    },
    "strength": { ... },
    "climbing_technical": { ... },
    "flexibility": { ... }
  },
  "graduationBenchmarks": {
    "cardio": [{
      "exerciseId": "string (from library)",
      "exerciseName": "string",
      "graduationTarget": "string",
      "whyThisTarget": "string (1 sentence)"
    }],
    "strength": [ ... ],
    "climbing_technical": [ ... ],
    "flexibility": [ ... ]
  }
}
```

**User message template:**

```
Objective: {name}. Route: {route}. Type: {type}. Season: {season}. Duration: {duration}. Summit elevation: {elevation}. Total gain: {gain}. Distance: {distance}. Technical grade: {grade}. Additional details: {details}. Pack weight: {packWeight}.

Available benchmark exercises: {JSON array of benchmark_exercises from database}

[If Silver tier:] Calibration anchors: {JSON array of closest validated objectives with full profiles}

[If validator feedback exists:] Validated feedback for similar objectives: {aggregated feedback}
```

### Prompt 2: Plan Generation

**System prompt:**

```
You are an expert mountain athletics coach who designs periodized training plans for mountaineering, alpine climbing, and trail running objectives. You create detailed, session-level programming in the style of Mountain Tactical Institute — sport-specific, no-fluff, focused on exercises that directly build the fitness demands of the objective.

You will receive: the athlete's current dimension scores (0–100), the objective's target scores, graduation benchmarks for each dimension, the objective details, relevance profiles (key and irrelevant components per dimension), the number of weeks available, and user preferences (training days per week, equipment access, location).

Design a plan that progresses each dimension's score from current to target over the available weeks. The weekly sessions are scaled-down versions of the graduation workouts, progressively getting closer. Week 1's step-up count is a fraction of the graduation target; the final pre-taper week is at or near the graduation target.

Periodization rules:
- Increase total volume by no more than 10% per week.
- Default to 5 sessions per week (adjust if user specifies fewer).
- Three non-overlapping week types:
  - TEST weeks: 3 of 5 sessions contain benchmark exercises. Volume at 75–80%. Scheduled approximately every 4 weeks.
  - RECOVERY weeks: 50% volume. No benchmarks. No scoring. Scheduled between test weeks.
  - REGULAR weeks: Full volume. Standard training.
- Include a 2-week TAPER before the objective date. Volume drops 40%, intensity stays. No benchmarks, no scoring.
- The last test week must fall before the taper begins.
- Week 2 should be offered as an optional early test week (the first scheduled test).
- At least one full rest day per week.
- Never exceed 12 hours per week for a recreational athlete.

For each week, provide named training sessions (not assigned to specific days). Each session must include:
- A short objective line with estimated duration.
- A warm-up block with specific exercises and reps.
- A numbered training block with exact reps, sets, weight, distance, duration, or pace as appropriate.
- Intensity descriptors in plain language: "Moderate = comfortable but not easy", "Zone 2 = conversational pace, nose-breathing", "Threshold = fastest sustainable pace".
- Foam rolling or recovery notes where appropriate.

Every prescribed exercise must directly train a key component from the relevance profiles. Never prescribe exercises that target irrelevant components. If a dimension's target score is under 15, limit to one session per week focused on basic competence.

Exercise names must be approachable and generic — "single-leg box step-downs" not proprietary names. Each exercise clear enough to follow without a coach.

On test weeks, mark benchmark sessions clearly. Include the graduation target inline so the user sees what they're measuring against.

Include expected scores per week as linear interpolation from current to target scores.

Return valid JSON matching this schema:
{
  "planSummary": {
    "philosophy": "string",
    "weeklyStructure": "string",
    "equipmentNeeded": ["string"],
    "keyExercises": ["string"]
  },
  "weeks": [{
    "weekNumber": number,
    "weekStartDate": "YYYY-MM-DD",
    "weekType": "test | recovery | regular | taper",
    "totalHoursTarget": number,
    "expectedScores": { "cardio": number, "strength": number, "climbing_technical": number, "flexibility": number },
    "sessions": [{
      "name": "string",
      "objective": "string (with duration)",
      "estimatedMinutes": number,
      "dimension": "string (primary dimension)",
      "isBenchmarkSession": boolean,
      "warmUp": {
        "rounds": number,
        "exercises": [{ "name": "string", "reps": "string" }]
      },
      "training": [{
        "exerciseNumber": number,
        "description": "string",
        "details": "string",
        "isBenchmark": boolean,
        "graduationTarget": "string | null",
        "intensityNote": "string | null"
      }],
      "cooldown": "string | null"
    }]
  }]
}
```

**User message template:**

```
Athlete profile: Available {days}/week. Equipment: {equipment list}. Location: {city}. Injuries: {injuries or "none"}.

Objective: {full objective details from objectives table}.

Current scores: Cardio {n}, Strength {n}, Climbing/Technical {n}, Flexibility {n}.
Target scores: Cardio {n}, Strength {n}, Climbing/Technical {n}, Flexibility {n}.
Weeks available: {n}.

Graduation benchmarks: {JSON of graduation benchmarks per dimension}

Relevance profiles: {JSON of full relevance profiles per dimension}
```

### Prompt 3: Weekly Score Evaluation (Regular Weeks Only)

**System prompt:**

```
You are evaluating an athlete's weekly training against their objective-specific relevance profiles. For each dimension, assess whether the logged training contributed to readiness for the specific objective.

Rules:
- Maximum adjustment: ±3 points per dimension.
- Training that targets key components → positive adjustment (up to +3).
- Training that targets irrelevant components → no adjustment or slight negative (0 to -1).
- Completed-as-prescribed sessions always contribute positively since they were designed around key components.
- If any dimension's estimated score would fall 5+ points below the expected trajectory, flag it for emergency rebalancing.

Return JSON:
{
  "adjustments": {
    "cardio": { "change": number, "reasoning": "string" },
    "strength": { "change": number, "reasoning": "string" },
    "climbing_technical": { "change": number, "reasoning": "string" },
    "flexibility": { "change": number, "reasoning": "string" }
  },
  "emergencyRebalance": boolean,
  "rebalanceDimensions": ["string"] // which dimensions are 5+ below
}
```

### Prompt 4: Plan Rebalancing

**System prompt:**

```
You are rebalancing a training plan because the athlete's actual scores deviate from expected scores. Regenerate future weekly sessions to get scores back on the linear trajectory toward target scores.

Rules:
- Ahead-of-schedule dimensions drop to maintenance level (never below 60% of their planned volume).
- Behind-schedule dimensions get the freed time.
- Total weekly hours stay roughly the same.
- If behind in multiple dimensions, prioritize the highest target score.
- Maintain the same session format (warm-up, training blocks, intensity notes).
- Do not modify test week, recovery week, or taper week scheduling.

For Tier 1 (post-test week): regenerate ALL remaining regular weeks.
For Tier 2 (emergency): regenerate only the next 1–2 weeks.

Return the same weekly session JSON format as Prompt 2.
```

### Prompt 5: Route Recommendations

**System prompt:**

```
Find 3–5 trail running or hiking routes near the athlete's location matching their weekly cardio target parameters. Return structured results.

Return JSON:
{
  "routes": [{
    "name": "string",
    "location": "string",
    "distanceMiles": number,
    "elevationGainFt": number,
    "description": "string (2-3 sentences)",
    "sourceUrl": "string",
    "whyItFits": "string (1 sentence)"
  }]
}
```

Enable web_search tool for this call.

-----

## Pages & UI

### /login, /signup

Standard Supabase Auth UI. Email/password. Redirect to /dashboard after login.

### /dashboard

- If no assessment: “Take your fitness assessment” CTA.
- If assessment but no objective: “Add your first objective” CTA.
- If objective but no plan: “Generate Training Plan” button.
- If plan exists:
  - **Readiness section:** 4 progress arcs (current vs target per dimension). Tagline under each. Green/yellow/red coloring.
  - **This week summary:** Week type badge (test/recovery/regular/taper). Sessions with “Mark Complete” buttons.
  - **Graduation benchmarks:** Latest test results vs targets.
  - **Objective countdown:** Name, date, weeks remaining.
  - **Score chart:** Line chart over time. Solid dots = test weeks. Dashed line = regular weeks. Horizontal dashed lines = targets.
  - Banner if scores are estimates: “Estimated scores — take your first benchmark test to calibrate.”

### /calendar

- react-big-calendar monthly view.
- Objectives as colored events (green = hike, blue = trail run, orange = climb).
- Click empty date → create objective modal.
- Click event → objective detail modal (edit/delete).
- Mobile: switch to sorted list view below 768px.
- Tier badge on each objective (Gold/Silver/Bronze).

### /assessment

- 4-step wizard. Quick self-report (under 5 minutes).
  - Step 1 (Cardio): Longest zone 2 run (distance + duration), weekly cardio hours.
  - Step 2 (Strength): Push-up reps, squat reps or experience level dropdown.
  - Step 3 (Climbing/Technical): Highest grade, experience level dropdown, comfort on exposure (1–5).
  - Step 4 (Flexibility): Self-rated hip tightness (1–5), self-rated ankle mobility (1–5), any regular routine (yes/no).
- Summary screen: gauges per dimension with target alongside. Graduation workouts displayed below each gauge. “Estimated” banner.

### /plan

- **Header:** Objective name, total weeks, current week highlighted.
- **Graduation workouts:** Pinned “finish line” section showing all benchmarks and targets.
- **Score trajectory chart:** 4 lines + dashed targets.
- **Week list:** Scrollable. Each week shows:
  - Week number, date range, week_type badge.
  - Total hours target.
  - Expected scores.
  - Session cards (collapsed by default, current week expanded).
- **Session card:**
  - Session name, objective line, duration.
  - If benchmark: star icon + blue highlight.
  - “Mark Complete” button (or “Log Different”).
  - Expandable to show full warm-up + training + cooldown.
- **Week type banners:** Test = blue, Recovery = green, Taper = amber.

### /log

- If accessed from “Mark Complete” on a plan session: pre-filled with session data, one-tap confirm.
- If accessed from “Log Different” or standalone:
  - Dimension selector (cardio/strength/climbing/flexibility).
  - Dimension-specific fields:
    - Cardio: activity type, distance, duration, elevation, avg HR.
    - Strength: add-exercise pattern (name, sets, reps, weight).
    - Climbing: type, grade, pitches, duration.
    - Flexibility: routine name, duration, body areas worked.
  - If test week benchmark session: structured fields for exact results (number inputs, timers).

### /progress

- Line chart of all four scores over time from score_history.
- Solid dots for test weeks (high confidence), lighter dots for regular weeks (low confidence).
- Horizontal dashed lines for target scores.
- Date range selector.

### /admin/objectives (validator only)

- List of validated_objectives with search/filter.
- Edit form for each: all fields editable.
- Add new validated objective form.
- Only visible if `profiles.is_validator = true`.

### Validator overlay (on objective detail page)

- Only visible if `profiles.is_validator = true`.
- Shows relevance profile components per dimension.
- Each component has upvote/downvote buttons.
- “Add missing component” text input per dimension.
- Vote counts displayed next to each component.

-----

## Seed Data

Seed the database with 15 validated objectives on first deployment:

1. Half Dome (Mist Trail + Cables)
1. Colorado 14er Class 1–2 (Quandary, Elbert, Bierstadt)
1. Mt. Whitney (Main Trail)
1. Mont Blanc (Goûter Route)
1. Mt. Rainier (Disappointment Cleaver)
1. Denali (West Buttress)
1. Grand Teton (Upper Exum Ridge)
1. Cathedral Peak (SE Buttress)
1. Trail Half Marathon (~4,000ft gain)
1. 50K Mountain Ultra (~8,000ft gain)
1. Colorado 14er Class 3–4 (Capitol Peak, Longs Peak)
1. Enchantments Traverse
1. John Muir Trail
1. Kilimanjaro (Machame Route)
1. Tour du Mont Blanc

Full data for each (target scores, taglines, relevance profiles, graduation benchmarks) is in the companion Validated Objectives Library document.

-----

## Build Order

1. **Project setup:** Next.js + Tailwind + Supabase auth + deploy to Vercel.
1. **Foundation tables:** validated_objectives, benchmark_exercises. Seed with 15 objectives. Admin page.
1. **User objectives + calendar:** objectives table, /calendar, /api/match-objective, /api/estimate-scores (Prompt 1), tier badging.
1. **Assessment:** /assessment wizard, scoring, “estimated” labeling, graduation workout display.
1. **Plan generation:** /api/generate-plan (Prompt 2), /plan view with week types, session cards, score trajectory.
1. **Logging + scoring:** /log with quick-log, /api/complete-week (test week math + regular week AI), score_history, /progress chart.
1. **Rebalancing:** /api/rebalance (Prompt 4), Tier 1 and Tier 2 triggers.
1. **Readiness dashboard:** /dashboard with arcs, countdown, score chart.
1. **Validator feedback:** component_feedback table, overlay UI, wire into Prompt 1.
1. **Route recommendations:** /api/find-routes (Prompt 5), UI integration on cardio cards.
1. **Polish:** Mobile responsiveness, empty states, onboarding flow, error handling.
