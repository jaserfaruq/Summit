# Summit Planner — Product Guide

> This is the product guide for Summit Planner. It contains the rationale, design history, and detailed context behind every architectural decision. The companion file `CLAUDE.md` at the project root contains the implementation specification.
> 
> **Version 6 — March 2026 — Prepared for Jaser**

-----

# 1. The Mindset Shift: You Are the Product Director

This guide is built around a fundamental premise: you are not going to learn to code this app. Claude Code is going to code it. Your job is to direct Claude Code with clear, specific, plain-language instructions, the same way a product leader directs an engineering team.

This is not a lesser approach. It is a different skill set. The quality of what Claude Code builds depends entirely on the quality of your instructions: how clearly you describe what you want, how well you break large goals into small tasks, and how effectively you review what Claude Code produces.

## 1.1 What You Will Do vs. What Claude Code Will Do

|**Your Job (Plain Language)**                                  |**Claude Code’s Job (Code)**                                              |
|---------------------------------------------------------------|--------------------------------------------------------------------------|
|Describe what the app should do, screen by screen              |Write all React components, pages, and styling                            |
|Define what data needs to be stored and how it relates         |Create database tables, queries, and migrations                           |
|Write the AI coaching prompts that generate training plans     |Build the API routes that call Claude’s API and parse responses           |
|Curate the validated objectives library and benchmark exercises|Build the database, matching logic, and admin interface                   |
|Define graduation workouts and set graduation targets          |Implement the scoring engine, test week flows, and progress visualizations|
|Curate and validate relevance profile component lists          |Build the validator feedback UI and aggregation system                    |
|Make product decisions (what to build next, what to cut)       |Implement those decisions in code                                         |
|Set up accounts (Supabase, Vercel, Anthropic, GitHub)          |Configure the project to connect to those services                        |
|Test the app by using it yourself and training with it         |Write automated tests if you want them                                    |

## 1.2 What You Still Need to Understand (Conceptually)

You don’t need to write code, but you need to understand a few concepts well enough to give Claude Code good directions. Think of it like hiring a contractor: you don’t need to frame a wall, but you need to know what a load-bearing wall is.

- **How a web app is structured:** Frontend (what the user sees) vs. backend (server-side logic).
- **What a database does:** Stores data permanently in tables with rows and columns. Tables reference each other.
- **What an API is:** A way for software to talk to software. Your app calls Claude’s API and Supabase’s API.
- **What environment variables are:** Secret values (API keys) that should never appear in the code.
- **What Git does:** Tracks every change so you can undo mistakes and deploy safely.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>The 90/10 rule</strong></p>
<p>Claude Code writes ~90% of the code. Your 10%: setting up accounts, writing AI coaching prompts, curating the validated objectives library and benchmark exercises, defining graduation targets, managing the validator community, and testing the app by training with it. That 10% is where all the product value lives.</p></td>
</tr>
</tbody>
</table>

# 2. The Tech Stack

Every tool was chosen because Claude Code works exceptionally well with it and can generate high-quality code from plain-language descriptions.

|**Layer**          |**Tool & Why**                                                                 |
|-------------------|-------------------------------------------------------------------------------|
|Frontend + Backend |Next.js 14+ with App Router. Single project for UI and API.                    |
|Styling            |Tailwind CSS. Describe visually; Claude Code translates to utility classes.    |
|Database + Auth    |Supabase (PostgreSQL). Managed DB, built-in auth, Row Level Security.          |
|AI / Training Plans|Claude API (Anthropic). Coaching prompts in English; Claude Code wires them in.|
|Deployment         |Vercel. Push to GitHub, auto-deploys. Zero-config for Next.js.                 |
|Version Control    |Git + GitHub. Claude Code runs commands; GitHub Desktop for visual interface.  |

## 2.1 Accounts You Need to Create

Set these up before building anything. Each has a free tier sufficient for development.

1. GitHub (github.com) — Where your code lives. Install GitHub Desktop.
1. Supabase (supabase.com) — Your database. Note the project URL and “anon” key.
1. Anthropic (console.anthropic.com) — Your AI API key.
1. Vercel (vercel.com) — Sign up with GitHub. Where your app lives on the internet.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to say to Claude Code</strong></p>
<p>Once accounts are set up: “Create a new Next.js 14 project with App Router and Tailwind. Configure Supabase: [credentials]. Set up environment variables so keys aren’t exposed to the browser.”</p></td>
</tr>
</tbody>
</table>

# 3. How to Talk to Claude Code Effectively

The quality of what Claude Code builds is directly proportional to how well you instruct it.

## 3.1 The Golden Rule: One Thing at a Time

Work in small, reviewable steps. Ask for one page, one feature, or one component at a time. Review, test, move on.

|**Don’t Say This**                  |**Say This Instead**                                                                                                                                                                                                                                                                                                         |
|------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Build me a fitness assessment page. |Build a fitness assessment page with 4 steps. Step 1 asks about cardio: “What is the longest run you’ve done in the last month while staying in heart rate zone 2?” with fields for distance in miles and duration in minutes. Include a Next button. Don’t build the other steps yet.                                       |
|Make the AI generate training plans.|Create an API route at /api/generate-plan that: 1) Checks if the objective matches a validated objective. If yes, pull benchmarks directly. If no, send closest validated objectives as anchors to Claude. 2) Generates graduation workouts, then weekly sessions progressing toward them. Here’s the system prompt: [paste].|
|Fix the bugs.                       |When I click “Complete Week” on the test week page, the scores don’t update. The formula should be: average % of graduation benchmarks × target score. Check /api/complete-week.                                                                                                                                             |

## 3.2 Describe Screens Like You’re Drawing Them

Describe pages spatially: what’s at the top, middle, left, right. What happens when you click things.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Example: The weekly plan view</strong></p>
<p>Build a page at /plan/[weekId]. At the top: week number, date range, objective name. If test week, show blue banner: “CALIBRATION WEEK — 3 benchmark sessions.” Below: 4 dimension cards. Each card has dimension name, tagline in italics, current/target score (e.g., 55/78), progress arc (green within 10 of target, yellow 10–25, red 25+), session(s) for that dimension. Benchmark sessions get star icon and blue highlight. Below each session: “Mark Complete” button for one-tap logging. On mobile, stack cards vertically.</p></td>
</tr>
</tbody>
</table>

## 3.3 Use Claude Code’s Memory: The CLAUDE.md File

Claude Code reads a CLAUDE.md file at the project root every session. Include: project overview, tech stack, database schema, four fixed dimensions, scoring system (graduation workouts, test weeks, formula), validated objectives and benchmark library, relevance profiles, styling conventions, and rules.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to say to Claude Code</strong></p>
<p>Create a CLAUDE.md file. Training app for mountaineering and trail running. Next.js 14, Tailwind, Supabase, Claude API. Four fixed dimensions: Cardio, Strength, Climbing/Technical, Flexibility (0–100). Scores per-objective. Each dimension has 2–4 graduation benchmarks. Score = (% benchmarks completed) × target score. Quick self-assessment for instant estimates; test weeks every ~4 weeks for calibration. Validated_objectives table for gold-standard curated objectives. Benchmark_exercises table for curated exercise library. [Full schema, colors, rules.]</p></td>
</tr>
</tbody>
</table>

## 3.4 The Review-and-Revise Loop

Instruct, review, revise. Be specific.

- **Bad:** “The scores look wrong.”
- **Good:** “After test week, cardio shows 71 but should be 55. Formula: avg % of benchmarks × target score. Benchmarks were 63% and 80% (avg 71%), target is 78, so 71% × 78 = 55. Check /api/complete-week.”

## 3.5 When You Get Stuck

Open browser console (right-click > Inspect > Console), copy-paste the error to Claude Code. For product decisions, use regular Claude chat.

# 4. The Scoring System: The App’s Central Nervous System

The scoring system answers the question every athlete asks: “Am I ready?” The answer is grounded in concrete, measurable benchmarks, not abstract numbers. This section describes the complete design, including how scores are established, updated, and used to adapt the plan.

## 4.1 The Four Fixed Dimensions

Every user always sees four training dimensions: Cardio, Strength, Climbing/Technical, and Flexibility. These names never change. Each dimension gets an AI-generated tagline (4–7 words) that contextualizes what it means for the specific objective.

|**Objective**                |**Sample Taglines**                                                                                    |
|-----------------------------|-------------------------------------------------------------------------------------------------------|
|Mont Blanc, Goûter Route     |Cardio: Sustained effort in thin air. Climbing/Technical: Crampons and glacier competence.             |
|Grand Teton, Upper Exum Ridge|Cardio: Heavy pack uphill to high camp. Climbing/Technical: Multi-pitch trad at altitude with exposure.|
|Trail ultra marathon         |Cardio: 6–10 hours of continuous movement. Climbing/Technical: Trail navigation and scrambling.        |
|Road marathon                |Climbing/Technical: Not a factor for this objective (target score 0, card grayed out).                 |

## 4.2 Scores Are Per-Objective

Every user’s four dimension scores are tied to a specific objective, not to the user globally. In V1, with one objective, there’s one set of scores — but the data model stores them on the objective, not on the user profile. This is the V2-ready design: in V2, each objective maintains its own independent scores.

The reason: a Flexibility score of 60 for Mont Blanc (hips, hamstrings, ankles) means something completely different than a Flexibility score of 60 for a bouldering trip (shoulders, wrists, hip turnout). The same person might be 60 for one and 35 for the other.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>V2 vision: Multi-objective optimization</strong></p>
<p>In V1, one active objective. In V2, users place multiple objectives throughout the year and the AI generates a master plan that sequences training blocks across all of them. Each objective maintains its own scores. The data model supports V2 without restructuring.</p></td>
</tr>
</tbody>
</table>

## 4.3 Graduation Workouts: The Concrete Finish Line

This is the core innovation. Instead of abstract target scores, the AI generates a concrete “graduation workout” for each dimension — the exact session you’d need to complete to be ready for your objective. The graduation workout IS the target. Your score measures how close you are to completing it today.

For Mont Blanc cardio, the graduation workout might be: “700+ weighted step-ups in 30 minutes @ 25lb pack” and “6-mile hilly trail effort with 2,000ft of gain in under 2:15 at Zone 2.” Week 1, you’re doing 300 step-ups and a 45-minute effort. Week 16, you’re doing the graduation workout. Every week is a clear stepping stone toward a finish line you can see from day one.

Each dimension has 2–4 benchmark exercises that together define the graduation workout. The number varies by objective — a climbing-heavy route like the Exum Ridge has 3 climbing benchmarks while a simple day hike might have 1. For a given objective, these ranges apply: Cardio 1–2 benchmarks, Strength 2–4, Climbing/Technical 1–3, Flexibility 1–3. The exact count depends on the objective’s demands. The benchmarks are selected from a curated library of proven exercises (Section 5).

Because the weekly plan sessions are scaled-down versions of the graduation workouts, the exercises feel familiar throughout the plan. Step-ups in Week 1 are the same step-ups in Week 16 — just at higher volume. This consistency means the user watches the same exercises get harder as they get fitter, which is deeply motivating.

## 4.4 Getting Your First Scores: Quick Assessment + Early Test

The user’s journey starts with two steps designed to balance instant gratification with accuracy:

**Step 1: Quick Self-Assessment (Instant Estimates)

A short questionnaire that asks about recent training: longest zone 2 run, push-up capacity, climbing experience, flexibility indicators. This takes 5–10 minutes and produces estimated scores immediately. The plan generates from these estimates so the user has something to follow from day one.

These scores are clearly labeled as estimates throughout the UI. The dashboard says: “Estimated scores — take your first benchmark test to calibrate.” The user understands these are rough starting points, not precise measurements.

**Step 2: Optional Early Benchmark Test (Week 2)

Week 2 of the plan is offered as an optional early test week. The app highlights this: “Ready to see where you really stand? This week includes benchmark sessions that will precisely calibrate your scores.” If the user takes it, scores recalibrate using the real benchmark formula and the plan adjusts. If they skip it, the next scheduled test week (around Week 5) catches them.

This approach means: the user gets scores and a plan instantly (from the self-assessment), starts training in Week 1 with real sessions, and gets their first precise calibration as early as Week 2 or as late as Week 5. There’s no waiting, no gap between signup and value.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Why the self-assessment still matters</strong></p>
<p>Even though benchmark tests are more accurate, the self-assessment serves a critical purpose: it gives the AI enough information to generate an appropriate Week 1. Without any assessment, the AI wouldn’t know whether to prescribe 200 step-ups or 600. The self-assessment is rough but directionally correct, and the first test week snaps everything to reality.</p></td>
</tr>
</tbody>
</table>

## 4.5 Three Week Types

Every week in the plan is exactly one of three types. They never overlap.

- **Test weeks:** High-signal calibration. Three of five sessions contain benchmark exercises. The user follows these exactly and reports precise results. Volume is at about 75–80% to keep the user fresh for accurate results without detraining. Score updates use the precise benchmark formula. Scheduled at regular intervals (approximately every 4 weeks, adjusted for plan length).
- **Recovery weeks:** True deload at 50% volume. No benchmark exercises, no scoring changes. The purpose is physical recovery. These are scheduled between test weeks (never on the same week). The scores the user carries into a recovery week are the same scores they carry out.
- **Regular training weeks:** The default. Users follow the plan or substitute freely. If they followed the plan as prescribed, they tap “Mark Complete” for one-tap logging. If they deviated, they describe what they did. The AI evaluates against relevance profiles and adjusts scores modestly (±1–3 points). These are directional estimates that the next test week will verify.

For a 16-week plan, a typical schedule might be: Week 1 regular (using self-assessment scores), Week 2 optional early test, Weeks 3–4 regular, Week 5 test, Week 6 recovery, Weeks 7–8 regular, Week 9 test, Week 10 recovery, Weeks 11–12 regular, Week 13 test (final), Weeks 14–15 taper, Week 16 taper.

**Taper weeks

The final 2 weeks before the objective are taper weeks. Volume drops 40% but intensity stays. Taper weeks are exempt from scoring and rebalancing. The scores the user carries into the taper are their “readiness scores” for the objective. The last test week must happen before the taper begins.

## 4.6 The Score Formula

**Score = (average % of graduation benchmarks completed) × target score

Example: Your cardio graduation benchmarks are “700 step-ups in 30 min” and “6-mile trail in 2:15.” You did 440 step-ups (63%) and the trail in 2:48 (80%). Average: 71%. Cardio target score is 78. Score = 71% × 78 = 55.

A score of 55 tells you exactly where you stand: 71% of the way to what Mont Blanc requires for cardio. When you hit 100% of the graduation workout, your score equals the target (78) and you’re ready.

**Exceeded benchmarks are capped at 100%

If you do 800 step-ups when the target is 700, that benchmark counts as 100%, not 114%. Your score can never exceed the target through benchmark testing. But the excess is surfaced to the user as a positive signal: “Your cardio exceeds Mont Blanc requirements — you’re more than ready in this dimension.” This is motivating and provides a natural signal for the rebalancing system to shift time away from this dimension.

**Expected scores = linear interpolation

Between test weeks, the plan includes expected scores per week. These are calculated as a straight-line interpolation from current scores to targets. If cardio starts at 35 and needs to reach 78 in 16 weeks, the expected score at Week 8 is roughly 57. The AI generates these when creating the plan. They form the trajectory line on the score chart that actual scores are compared against during rebalancing.

**How relevance profiles and benchmarks work together

Graduation benchmarks are the ground truth — they produce exact scores on test weeks. Relevance profiles are the AI’s guide for estimating score movement between test weeks. Think of it this way: benchmarks are the ruler, relevance profiles are the AI’s eyeball estimate when the ruler isn’t available. The next test week always reconciles any estimation drift.

## 4.7 Dynamic Rebalancing

After test weeks, the app compares actual scores to expected scores. If one dimension is ahead and another behind, it reallocates training time: reduce the ahead dimension to a maintenance level and invest the freed time in the lagging dimension.

**Two tiers of rebalancing

- **Tier 1 — Full rebalance after test weeks:** High-confidence data from real benchmarks. Complete reassessment of time allocation for all remaining weeks.
- **Tier 2 — Emergency correction on regular weeks:** If the AI estimates a dimension is 5+ points below trajectory, adjust the next 1–2 weeks without waiting for the test week. Catches situations like a user skipping all strength work for two weeks.

Key constraints: Total weekly hours stay roughly the same — you’re training smarter, not more. An ahead-of-schedule dimension never drops below 60% of planned volume (the maintenance threshold). If behind in multiple dimensions, priority goes to the highest target score (most critical for safety).

# 5. The Validated Objectives Library & Benchmark Exercises

The graduation benchmarks are the foundation the scoring system sits on. If the AI invents a bad benchmark, every score downstream is wrong. The validated objectives library and benchmark exercises database ensure quality through human curation.

## 5.1 Three Tiers of Plan Quality

- **Tier 1 — Exact match (Gold):** User creates an objective matching a validated objective (e.g., “Mont Blanc, Goûter Route”). The app pulls hand-curated target scores, taglines, relevance profiles, and graduation benchmarks directly. No AI needed. Badged: “Calibrated by our training team.”
- **Tier 2 — Similar anchor (Silver):** Objective not in the library, but similar validated objectives exist. The AI uses them as calibration anchors in its prompt. Badged: “AI-generated, anchored against validated objectives.”
- **Tier 3 — Novel (Bronze):** No close match. The AI generates everything using the benchmark exercise library and general knowledge. Badged: “AI-generated. Share results to help us validate this objective.”

## 5.2 The Validated Objectives Table

Each validated objective stores: canonical name and route, match aliases for fuzzy matching (so “Mont Blanc,” “Mont Blanc normal route,” and “Mont Blanc from Saint-Gervais” all match), type and difficulty, description, all four target scores with taglines, full relevance profiles, and specific benchmark exercise IDs with graduation targets.

Your team maintains this table. Adding a new validated objective takes 2–3 hours: verify scores, select benchmarks, set graduation targets, write relevance profiles, add aliases.

## 5.3 The Benchmark Exercises Table

A curated library of proven exercises: clear name, full instructions, primary dimension, tags (heavy-pack, gym-reproducible, altitude, eccentric), equipment required, difficulty scale (beginner through elite), and measurement type (reps, time, distance, pass/fail, self-rated).

The same exercise appears across many validated objectives with different graduation targets. “Timed Loaded Step-Ups” is used for Mont Blanc (700 reps @ 25lb), Exum Ridge (550 @ 35lb), Denali (600 @ 45lb), Half Dome (600 @ 25lb). One exercise description, reused everywhere.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Why this is a competitive moat</strong></p>
<p>A competitor could use the same AI. Without your curated benchmark library, validated objectives, and proven graduation targets, their plans are unanchored AI guesswork. Yours are grounded in tested prescriptions. The more validated objectives you add, the stronger the moat.</p></td>
</tr>
</tbody>
</table>

## 5.4 How the Library Grows

Start with 15 iconic objectives. Track which novel objectives users create most often. When a novel objective accumulates enough data and validator feedback, your team reviews, adjusts, and promotes it to validated. Target: 5–10 new validated objectives per quarter.

## 5.5 The Starter Library: 15 Validated Objectives

|**Category**            |**Objectives**                                                                                       |
|------------------------|-----------------------------------------------------------------------------------------------------|
|Day hikes & peak bags   |Half Dome (Mist Trail + Cables), Colorado 14er Class 1–2 (Quandary, Elbert), Mt. Whitney (Main Trail)|
|Multi-day mountaineering|Mont Blanc (Goûter Route), Mt. Rainier (Disappointment Cleaver), Denali (West Buttress)              |
|Alpine rock             |Grand Teton (Upper Exum Ridge), Cathedral Peak (SE Buttress)                                         |
|Trail running           |Trail Half Marathon (~4,000ft gain), 50K Mountain Ultra (~8,000ft gain)                              |
|Scrambles & backpacking |Colorado 14er Class 3–4 (Capitol, Longs), Enchantments Traverse, John Muir Trail                     |
|International           |Kilimanjaro (Machame Route), Tour du Mont Blanc                                                      |

Each is fully documented with target scores, taglines, relevance profiles, and graduation benchmarks in the companion Validated Objectives Library document. Estimated effort to validate all 15: 30–45 hours.

# 6. Relevance Profiles & Validator Feedback

## 6.1 Relevance Profiles: The Intelligence Layer

Each objective has a relevance profile per dimension defining which training activities matter and which don’t:

- **Key components (7–10 items):** Activities that directly contribute to readiness. Practical, coach-level descriptions with broad surface area. E.g., “Hip flexor length for high stepping on steep terrain.”
- **Irrelevant components (7–10 items):** Activities within this dimension that would NOT help. E.g., “Neck and cervical mobility” under flexibility for Mont Blanc.

Relevance profiles serve two purposes. During regular weeks, they’re the AI’s guide for estimating how much a non-benchmark workout moved the score (neck stretches for Mont Blanc? Score stays flat. Hip openers? Nudges up). During plan generation, they ensure workouts target key components (hip mobility for Mont Blanc, not generic yoga).

## 6.2 The Validator Feedback System

A closed community of paid validators (experienced mountaineers, coaches, guides) can see and interact with relevance profiles. They upvote, downvote, or add missing components. Regular users never see this interface.

Feedback is stored with objective-type tags. When the AI generates profiles for a new objective, the prompt includes aggregated feedback from similar objectives. The AI improves through prompt-based learning: the model doesn’t change, but the context gets richer over time.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to say to Claude Code</strong></p>
<p>Add is_validator boolean to profiles, default false. Create component_feedback table: id, user_id, objective_id, dimension, component_text, component_type (key / irrelevant / user_added), vote (up / down), objective_type, objective_tags (jsonb). On objective detail page, if is_validator, show components with upvote/downvote and “Add missing” input. Regular users never see this.</p></td>
</tr>
</tbody>
</table>

# 7. Your Data Model

Describe your data clearly so Claude Code creates the right tables.

|**Table**           |**What It Stores**                     |**Key Fields**                                                                                                                                                                              |
|--------------------|---------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|profiles            |Basic user info                        |Name, location, training days/week, equipment, is_validator                                                                                                                                 |
|validated_objectives|Gold-standard curated objectives       |Name, route, match_aliases, type, difficulty, target scores, taglines, relevance_profiles, graduation_benchmarks (refs benchmark_exercises), tags, status                                   |
|benchmark_exercises |Curated exercise library               |Name, description, dimension, tags, equipment, is_gym_reproducible, difficulty_scale, measurement_type/unit, status                                                                         |
|objectives          |User’s goals with scores               |Name, target_date, type, target + current scores, taglines (jsonb), relevance_profiles (jsonb), graduation_benchmarks (jsonb), matched_validated_id (nullable FK), tier (gold/silver/bronze)|
|assessments         |Quick self-assessment snapshots        |Date, 4 dimension scores (estimated), raw_data (jsonb)                                                                                                                                      |
|score_history       |Weekly score changes per objective     |User, objective_id, week_ending, 4 scores, change_reason, is_test_week (boolean), confidence (high/low)                                                                                     |
|training_plans      |AI-generated plan for an objective     |Objective_id, assessment_id, plan_data (jsonb), graduation_workouts (jsonb), status                                                                                                         |
|weekly_targets      |One week’s goals within a plan         |Plan_id, week_number, week_start, week_type (test/recovery/regular/taper), total_hours, expected_scores (jsonb), sessions (jsonb)                                                           |
|workout_logs        |Individual workouts                    |Date, dimension, duration, details (jsonb), benchmark_results (jsonb, nullable), completed_as_prescribed (boolean), notes                                                                   |
|component_feedback  |Validator votes on relevance components|User_id, objective_id, dimension, component_text, type, vote, objective_tags (jsonb)                                                                                                        |

## 7.1 How They Connect

When a user creates an objective, the app checks validated_objectives for a fuzzy match. Gold match: copies everything directly. Silver/Bronze: AI generates using benchmark_exercises library and validated anchors.

The training plan includes graduation workouts (finish line) and weekly sessions progressing toward them. Each week has a week_type: test, recovery, regular, or taper. Test weeks store benchmark results in workout_logs.benchmark_results. Score_history records both test-week (high confidence) and regular-week (low confidence) updates.

Workout logs have a completed_as_prescribed boolean for the quick-log “Mark Complete” flow. If true, the session details come from the plan. If false, the user describes what they actually did.

In V2, workout logs are evaluated against multiple objectives’ relevance profiles independently.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to say to Claude Code</strong></p>
<p>Create Supabase schema with these tables: [paste]. Objectives has nullable FK to validated_objectives and a tier column. Weekly_targets has week_type enum (test/recovery/regular/taper). Score_history has is_test_week boolean and confidence column. Workout_logs has completed_as_prescribed boolean and nullable benchmark_results jsonb. Add RLS. Seed validated_objectives with 15 starters and benchmark_exercises with the curated library.</p></td>
</tr>
</tbody>
</table>

# 8. The AI Coaching Prompts

Five prompts power the app. This section includes the full tested prompt text, JSON output schemas, and example outputs for Prompts 1 and 2, which were developed and validated through extensive testing with Mont Blanc (Goûter Route) and Grand Teton (Upper Exum Ridge) during the design phase.

## 8.1 Prompt 1: Target Score Estimation, Taglines, Graduation Benchmarks & Relevance Profiles

**Fires when:** User creates an objective that doesn’t match a validated objective (Silver or Bronze tier).

**Input:** Objective details, the benchmark_exercises library (full list), the closest validated objectives as calibration anchors (if any), and aggregated validator feedback for similar objective tags.

**Output:** Four target scores, four taglines, four relevance profiles, and graduation benchmarks selected from the benchmark_exercises library with objective-specific graduation targets.

**Tested System Prompt

*“You are an expert mountain athletics coach who assesses the physical demands of mountaineering, alpine climbing, and trail running objectives. Given an objective’s details, you evaluate the fitness required across four fixed dimensions and define what each dimension specifically means for this objective.*

*The four training dimensions are fixed: Cardio, Strength, Climbing/Technical, and Flexibility. For each dimension, generate:*

*1. A target score (0–100). Scoring scale: 0 = no capacity, 25 = beginner, 50 = intermediate recreational athlete, 75 = strong amateur, 100 = elite/professional. Target scores should reflect ‘ready to do this safely and enjoyably,’ not bare minimum survival.*

*2. A tagline of 4–7 words: vivid coach shorthand for what this dimension means for this objective.*

*3. A relevance profile with keyComponents (7–10 items) and irrelevantComponents (7–10 items). Components should be at a practical level — the kind of thing a coach writes on a whiteboard. Broad surface area across the dimension, not drilling deep into one sub-area. Each component should be distinct enough that a coach could look at a training log and say ‘yes, this trained that component’ or ‘no, it didn’t.’*

*4. Graduation benchmarks: 2–4 benchmark exercises per dimension selected from the provided benchmark exercise library. For each, set an objective-specific graduation target. The graduation workout represents the exact performance level needed to complete this objective safely and comfortably. Cardio: 1–2 benchmarks. Strength: 2–4. Climbing/Technical: 1–3. Flexibility: 1–3. The exact count depends on the objective’s demands.*

*[If validated feedback exists:] Experienced validators have confirmed these components for similar objectives: [insert aggregated feedback]. Use this to refine your assessment.*

*[If calibration anchors exist:] Here are calibrated profiles for similar validated objectives: [insert closest matches with their full profiles]. Use these as anchors to calibrate your assessment relative to known standards.*

*Select benchmark exercises ONLY from the provided library. Do not invent new exercises.*

*Return only valid JSON matching the schema below.”*

**Output JSON Schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p>{</p>
<p>"dimensions": {</p>
<p>"cardio": { "tagline": "string (4-7 words)", "targetScore": number },</p>
<p>"strength": { "tagline": "string", "targetScore": number },</p>
<p>"climbing_technical": { "tagline": "string", "targetScore": number },</p>
<p>"flexibility": { "tagline": "string", "targetScore": number }</p>
<p>},</p>
<p>"relevanceProfiles": {</p>
<p>"cardio": {</p>
<p>"summary": "string (2-3 sentences)",</p>
<p>"keyComponents": ["string", ...7-10 items],</p>
<p>"irrelevantComponents": ["string", ...7-10 items]</p>
<p>},</p>
<p>// ...same for strength, climbing_technical, flexibility</p>
<p>},</p>
<p>"graduationBenchmarks": {</p>
<p>"cardio": [{</p>
<p>"exerciseId": "string (from benchmark library)",</p>
<p>"exerciseName": "string",</p>
<p>"graduationTarget": "string (specific number or criteria)",</p>
<p>"whyThisTarget": "string (1 sentence)"</p>
<p>}],</p>
<p>// ...same for each dimension</p>
<p>}</p>
<p>}</p></td>
</tr>
</tbody>
</table>

**Tested Example Output: Mont Blanc, Goûter Route

This output was generated and validated during prompt development. Target scores, taglines, and relevance profiles were reviewed and approved.

|**Dimension**     |**Target Score & Tagline**            |
|------------------|--------------------------------------|
|Cardio            |78 — “Sustained effort in thin air”   |
|Strength          |58 — “Loaded uphill endurance”        |
|Climbing/Technical|12 — “Crampons and glacier competence”|
|Flexibility       |45 — “Lower body mobility under load” |

Key Cardio components (validated): Zone 2 endurance for 6–10 hour efforts, uphill hiking under load on steep grades, altitude tolerance above 3,500m, recovery between back-to-back days, long slow distance base, vert-specific fitness for 1,000m+ pushes, breathing rhythm on steep terrain.

Irrelevant Cardio components (validated): sprint speed, flat road running pace, cycling/swimming cardio, VO2max bursts, treadmill without incline.

Graduation benchmarks: (A) Timed loaded step-ups @ 25lb, 30 min — target 700+ reps. (B) Hilly trail 6mi / 2,000ft — target under 2:15 at Zone 2.

**Tested Example Output: Grand Teton, Upper Exum Ridge

A very different profile demonstrating how the same prompt produces objective-specific results.

|**Dimension**     |**Target Score & Tagline**                       |
|------------------|-------------------------------------------------|
|Cardio            |62 — “Heavy pack uphill to high camp”            |
|Strength          |55 — “Legs for approach, grip for ridge”         |
|Climbing/Technical|68 — “Multi-pitch trad at altitude with exposure”|
|Flexibility       |42 — “Hips and shoulders for sustained climbing” |

Key Climbing/Technical components (validated): Multi-pitch trad efficiency at moderate grades, route-finding on complex terrain, climbing with a light pack and boots, rappel and anchor-building speed, sustained exposure comfort, simul-climbing communication, speed on 5.4–5.5 terrain, climbing at altitude with cold hands.

Graduation benchmarks: (A) 5 pitches of 5.5–5.6 trad with pack — under 3 hours car-to-car. (B) 500ft of 5.2–5.4 unroped in approach shoes — fluid, confident. (C) Altitude climbing comfort self-rating — 4/5.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Notice the profile difference</strong></p>
<p>Mont Blanc: Climbing/Technical target is 12 (basic crampon competence). Grand Teton: Climbing/Technical target is 68 (the highest dimension). Same prompt, completely different output because the objective’s demands are fundamentally different. The strength profile also shifted: Mont Blanc focuses on quad endurance for sustained hiking; Exum Ridge includes grip endurance (dead hang 90 sec) because you’re climbing all day.</p></td>
</tr>
</tbody>
</table>

## 8.2 Prompt 2: Plan Generation

**Fires when:** User clicks “Generate Plan.”

**Input:** Current scores, target scores, graduation benchmarks, objective details, relevance profiles, weeks available, user preferences (days/week, equipment, location).

**Output:** A full periodized plan with named sessions in the style of Mountain Tactical Institute.

**Tested System Prompt

*“You are an expert mountain athletics coach who designs periodized training plans for mountaineering, alpine climbing, and trail running objectives. You create detailed, session-level programming in the style of Mountain Tactical Institute — sport-specific, no-fluff, focused on exercises that directly build the fitness demands of the objective.*

*You will receive: the athlete’s current dimension scores (0–100), the objective’s target scores, graduation benchmarks for each dimension, the objective details, relevance profiles (key and irrelevant components per dimension), the number of weeks available, and user preferences (training days per week, equipment access, location).*

*Design a plan that progresses each dimension’s score from current to target over the available weeks. The weekly sessions are scaled-down versions of the graduation workouts, progressively getting closer. Week 1’s step-up count is a fraction of the graduation target; the final pre-taper week is at or near the graduation target.*

*Periodization rules: increase total volume by no more than 10% per week. Schedule 5 sessions per week (default; adjust if user specifies fewer). Three non-overlapping week types: test weeks (benchmark sessions, ~75–80% volume), recovery weeks (50% volume, no benchmarks, no scoring), and regular training weeks (full volume). Include a 2-week taper before the objective (volume drops 40%, intensity stays, no scoring). The last test week must fall before the taper.*

*For each week, provide named training sessions (not assigned to specific days). Each session must include: a short objective line with estimated duration, a warm-up block with specific exercises and reps, a numbered training block with exact reps/sets/weight/distance/duration/pace as appropriate, intensity descriptors in plain language (“Moderate = comfortable but not easy”, “Zone 2 = conversational pace, nose-breathing”, “Threshold = fastest sustainable pace”), and foam rolling or recovery notes where appropriate.*

*Every prescribed exercise must directly train a key component from the relevance profiles. Never prescribe exercises that target irrelevant components. If a dimension’s target score is very low (under 15), limit that dimension to one session per week focused on basic competence.*

*Exercise names should be approachable and generic — “single-leg box step-downs” not “Scotty Bobs.” No proprietary exercise names. Each exercise should be clear enough to follow without a coach.*

*On test weeks, three of five sessions must contain benchmark exercises from the graduation workout. Mark these clearly. The user will follow them exactly and report results.*

*On regular weeks, include a “completed_as_prescribed” flag for each session. If the user did the session as written, they tap ‘Mark Complete’ for one-tap logging.*

*Include expected scores per week as a linear interpolation from current scores to target scores, so the app can track whether the user is on pace.*

*Return valid JSON matching the schema below.”*

**Output JSON Schema

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p>{</p>
<p>"planSummary": {</p>
<p>"philosophy": "string",</p>
<p>"weeklyStructure": "string",</p>
<p>"equipmentNeeded": ["string"],</p>
<p>"keyExercises": ["string"]</p>
<p>},</p>
<p>"weeks": [{</p>
<p>"weekNumber": number,</p>
<p>"weekStartDate": "YYYY-MM-DD",</p>
<p>"weekType": "test | recovery | regular | taper",</p>
<p>"totalHoursTarget": number,</p>
<p>"expectedScores": {</p>
<p>"cardio": number,</p>
<p>"strength": number,</p>
<p>"climbing_technical": number,</p>
<p>"flexibility": number</p>
<p>},</p>
<p>"sessions": [{</p>
<p>"name": "string",</p>
<p>"objective": "string (with duration)",</p>
<p>"estimatedMinutes": number,</p>
<p>"dimension": "string (primary)",</p>
<p>"isBenchmarkSession": boolean,</p>
<p>"warmUp": {</p>
<p>"rounds": number,</p>
<p>"exercises": [{"name":"string","reps":"string"}]</p>
<p>},</p>
<p>"training": [{</p>
<p>"exerciseNumber": number,</p>
<p>"description": "string",</p>
<p>"details": "string",</p>
<p>"isBenchmark": boolean,</p>
<p>"graduationTarget": "string | null",</p>
<p>"intensityNote": "string | null"</p>
<p>}],</p>
<p>"cooldown": "string | null"</p>
<p>}]</p>
<p>}]</p>
<p>}</p></td>
</tr>
</tbody>
</table>

**What a Generated Session Looks Like

Here is a representative session from the tested Week 1 output for Mont Blanc, showing the level of detail and format the prompt produces:

**Session 1: Uphill Endurance A

Objective: Build loaded uphill capacity • ~50 min

**Warm-up (3 rounds):** 5 walking lunges each leg, 20 step-ups (no weight), 5 push-ups, hip flexor stretch 20 sec each side.

**(1)** Weighted step-ups @ 25lb pack, 16-inch box. 200 reps at moderate pace. Every 50 reps, pause for 5 deep breaths. Focus on driving through the whole foot.

*Moderate = comfortable but not easy. You could hold a short conversation but wouldn’t want to.*

**(2)** Easy jog or brisk walk. 400 meters. Shake out the legs.

**(3)** Weighted step-ups @ 25lb pack. 200 reps at moderate pace.

**(4)** Foam roll legs and lower back. 5 minutes.

This format — objective line, structured warm-up, numbered training block with exact reps/weight/pace, intensity definitions, foam rolling — is modeled on Mountain Tactical Institute’s programming. Every exercise is approachable (no proprietary names) and specific enough to follow without a coach.

**What a Benchmark Session Looks Like (Test Week)

Here is a benchmark session from the tested Week 5 output:

**Session 1: Cardio Benchmark

**★ BENCHMARK SESSION — Follow exactly. Report exact results.

Objective: Measure loaded uphill capacity • ~45 min

**(1) ★ BENCHMARK:** Timed weighted step-ups @ 25lb pack. Set timer for 30 minutes. As many reps as possible at steady, sustainable pace. Record exact total.

**→ Graduation target: 700+ reps in 30 minutes

*Steady and sustainable. The goal is max total reps, not max speed.*

**(2)** Foam roll legs and lower back. 10 minutes.

The benchmark session shows the graduation target inline so the user sees exactly what they’re measuring against. Results are stored in workout_logs.benchmark_results and used for the precise scoring formula.

**Progressive Overload Between Weeks

The plan builds toward the graduation workout with consistent, measurable progression. Here is how the loaded step-up benchmark scales across a 16-week Mont Blanc plan:

|**Week**                    |**Step-Up Volume (Total Reps Per Session)**     |
|----------------------------|------------------------------------------------|
|Week 1 (regular)            |400 reps (200 + 200) @ 25lb                     |
|Week 2 (optional early test)|Benchmark: 30-min max test @ 25lb               |
|Week 5 (test)               |Benchmark: 30-min max test @ 25lb               |
|Week 8 (regular, mid-plan)  |650 reps (325 + 325) @ 25lb                     |
|Week 13 (final test)        |Benchmark: 30-min max test @ 25lb (target: 700+)|
|Weeks 14–16 (taper)         |300 reps at moderate pace (maintenance)         |

The exercises are the same throughout — step-ups in Week 1 are the same step-ups in Week 13. Only the volume and pace increase. This consistency means the user watches themselves get measurably closer to the graduation target every week.

## 8.3 Prompt 3: Weekly Score Evaluation

**Fires when:** User marks a week as complete.

**On test weeks (pure math, no AI call for scoring):

Score = (average % of benchmarks completed) × target score per dimension. Cap each individual benchmark at 100% before averaging. Write to score_history with is_test_week = true, confidence = high. Then the AI evaluates whether scores are on the expected trajectory and triggers rebalancing if needed.

**On regular weeks (AI evaluation):

**Input:** Workout logs, relevance profiles, current scores, expected scores, graduation benchmarks.

**Output:** Score adjustments ±1–3 per dimension with brief reasoning.

The prompt instructs Claude to evaluate whether each logged workout trained key components (score nudges up) or irrelevant components (flat or down). Maximum adjustment: ±3 points per dimension per regular week. If any dimension is estimated 5+ points below trajectory, flag emergency rebalancing.

**Quick-log flow for compliant sessions

If the user taps “Mark Complete” (completed as prescribed), the AI can use the plan’s session data directly for evaluation rather than requiring the user to describe what they did. This dramatically reduces logging friction. The AI knows the session was designed around key components, so a completed-as-prescribed session always nudges scores in the right direction.

## 8.4 Prompt 4: Plan Rebalancing

**Fires when:** Test week reveals significant deviations, or regular week triggers emergency correction.

**Input:** Remaining plan, actual vs. expected scores, target scores, graduation benchmarks, relevance profiles.

**Output:** Regenerated weekly sessions with adjusted time allocation.

For Tier 1 (post-test): regenerate all remaining weeks. For Tier 2 (emergency): adjust next 1–2 weeks only. Ahead-of-schedule dimensions drop to maintenance (never below 60% of planned volume). Behind-schedule dimensions get the freed time. Total weekly hours stay constant. If behind in multiple dimensions, prioritize the highest target score.

## 8.5 Prompt 5: Route Recommendations

**Fires when:** User clicks “Find Routes” on a cardio target.

Uses Claude’s web search tool with the user’s location and weekly cardio targets (distance, elevation). Returns 3–5 local routes with name, stats, description, and source link.

# 9. The Build Sequence

Each phase is plain-language instructions for Claude Code. Timelines for evenings and weekends. Phases are ordered so you can test features as soon as they’re built.

**Phase 1: Project Setup (Weekend 1)

Goal: Deployed app with database and authentication.

|**What You Do**         |**What You Tell Claude Code**                                                                                             |
|------------------------|--------------------------------------------------------------------------------------------------------------------------|
|Create 4 accounts       |(In your browser, not Claude Code.)                                                                                       |
|Get Supabase credentials|“Create a new Next.js 14 project with App Router and Tailwind. Configure Supabase: [credentials]. Env variables securely.”|
|Auth                    |“Add Supabase Auth with email/password. Login and signup pages. Redirect to /dashboard after login.”                      |
|Deploy                  |“Initialize Git repo and commit.” Push via GitHub Desktop. Connect Vercel.                                                |

**Deliverable:** Live URL with signup, login, and dashboard.

### Phase 1 Final Step: Add CLAUDE.md and Product Guide to the Repo

After the app is deployed and auth is working, add the project’s specification and guide documents to the repository:

1. **CLAUDE.md** — The implementation spec. Goes at the project root. Claude Code reads this automatically at the start of every session. It contains the complete schema, all 5 prompts, every API route, scoring rules, and page specs. This is the “what to build” document.
1. **docs/PRODUCT_GUIDE.md** — This guide. Goes in a `docs/` folder. Contains the rationale, design history, and product context. This is the “why we’re building it this way” document. Claude Code can reference it when it needs deeper context.

With both files in the repo, Claude Code has everything it needs to build any feature without you re-explaining the app. When you open a new Claude Code session, it reads CLAUDE.md automatically and knows the entire system. If it needs to understand *why* a decision was made (e.g., “why are scores per-objective instead of global?”), it can check the product guide.

This is the most important step for the Claude Code-first workflow. Without these files, every new session starts from scratch. With them, every session picks up where the last one left off.

**Phase 2: Objectives, Calendar, Validated Library & AI Scoring (Weekends 2–5)

Goal: Users can create objectives. Gold-tier objectives pull from the curated library. Silver/Bronze get AI-generated scores with validated anchors. Calendar shows everything.

|**What You Do**                   |**What You Tell Claude Code**                                                                                                                                                                                                                                                                                                                                                 |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Create all foundation tables      |“Create validated_objectives, benchmark_exercises, and objectives tables with all fields from Section 7. Seed validated_objectives with the 15 starter objectives and benchmark_exercises with the curated library.”                                                                                                                                                          |
|Build the calendar + creation flow|“Calendar at /calendar using react-big-calendar. Objectives as color-coded events. When creating an objective, call /api/match-objective for fuzzy matching against validated_objectives. Gold match: pre-fill everything. Silver/Bronze: call /api/estimate-scores using Prompt 1. Show target scores, taglines, graduation benchmarks as editable defaults. Badge the tier.”|
|Build matching logic              |“/api/match-objective checks match_aliases for fuzzy match. If found, Gold. If similar by type+tags, return as Silver anchors. If nothing, Bronze.”                                                                                                                                                                                                                           |
|Test thoroughly                   |Create Mont Blanc (Gold match), Exum Ridge (Gold), “Enchantments in winter” (Silver/Bronze). Verify tier badges and data quality.                                                                                                                                                                                                                                             |
|Build an admin page               |“Add /admin/objectives for viewing and editing validated objectives. Only accessible to is_validator users.”                                                                                                                                                                                                                                                                  |

**Deliverable:** Calendar with tiered objectives. Gold pulls from library. Silver/Bronze are AI-generated with anchors. Graduation benchmarks visible.

**Phase 3: Quick Assessment & Baseline Scores (Weekends 6–7)

Goal: Quick self-assessment for instant estimated scores. Users see the gap to objective targets and the graduation workouts as their finish line. Clear messaging that scores are estimates until the first benchmark test.

|**What You Do**                  |**What You Tell Claude Code**                                                                                                                                                                                                                                                    |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Define quick assessment questions|Short self-report: longest zone 2 run (distance + duration), push-up reps, climbing experience (dropdown), flexibility self-rating. Keep it under 5 minutes.                                                                                                                     |
|Build the wizard                 |“Assessment wizard at /assessment. 4 quick steps. Calculate 0–100 per dimension. Store in assessments. Update current scores on active objective. Write to score_history with is_test_week = false, confidence = low.”                                                           |
|Show gap + graduation workouts   |“Summary screen: each score as a gauge with target. Below each gauge show graduation benchmarks. E.g., Cardio 35/78 — ‘By the end of this plan: 700 step-ups in 30 min + 6-mile trail in 2:15.’ Banner at top: ‘Estimated scores — take your first benchmark test to calibrate.’”|

**Deliverable:** Quick assessment with instant estimates. Graduation workouts visible as concrete finish line. Clear ‘estimated’ labeling.

**Phase 4: AI Plan Generation with Test Weeks (Weekends 8–10)

Goal: Generate plans with MTI-level session detail, three non-overlapping week types, graduation workout progression, and an optional early test in Week 2.

|**What You Do**                |**What You Tell Claude Code**                                                                                                                                                                                                                                   |
|-------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Develop Prompt 2 in Claude chat|(Use the tested prompt from Section 8.2. Verify sessions have warm-ups, numbered exercises, intensity notes. Verify test/recovery/regular/taper weeks never overlap.)                                                                                           |
|Build the API                  |“Create /api/generate-plan. Pass graduation benchmarks (from validated library or AI). Generate the full plan. Week 1 is regular. Week 2 is an optional early test (highlighted in the UI). Schedule test/recovery/regular/taper per the rules in Section 4.5.” |
|Build the plan view            |“/plan shows score trajectory chart (4 lines + dashed targets), graduation workouts pinned as ‘finish line,’ weekly listings. Test weeks: blue banner. Recovery weeks: green ‘rest’ banner. Taper weeks: amber banner. Each session has ‘Mark Complete’ button.”|
|Build generate button          |“Dashboard: if objective + assessment but no plan, show Generate button with loading screen.”                                                                                                                                                                   |

**Deliverable:** MTI-level plans with three non-overlapping week types, graduation progression, and optional early test.

**Phase 5: Logging, Scoring & Adaptation (Weekends 11–14)

Goal: Users log workouts via quick-log or free entry. Test weeks produce precise scores. Regular weeks get AI estimates. Plans rebalance dynamically.

|**What You Do**                  |**What You Tell Claude Code**                                                                                                                                                                                                                                                                                                                                  |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Build the log form with quick-log|“/log: on each session card in the plan view, add a ‘Mark Complete’ button. One tap logs the session as completed-as-prescribed. For deviations, tap ‘Log Different’ to enter free-form details. On test weeks, benchmark sessions require structured result fields (exact reps, time, pass/fail). Store in workout_logs with completed_as_prescribed boolean.”|
|Build test week scoring          |“/api/complete-week: if week_type = test, calculate scores: avg % of benchmarks (capped at 100% each) × target score per dimension. Write score_history with is_test_week = true, confidence = high. Update current scores on objective.”                                                                                                                      |
|Build regular week scoring       |“If week_type = regular, call Claude with Prompt 3. For completed-as-prescribed sessions, pass the plan’s session data. For deviations, pass what the user described. Get ±1–3 adjustments per dimension. Write score_history with is_test_week = false, confidence = low.”                                                                                    |
|Build rebalancing                |“After test week scoring, compare actual vs expected. If any dimension 3+ points off, call Prompt 4 for full rebalance of remaining weeks. On regular weeks, if 5+ points behind, adjust next 1–2 weeks. Never rebalance during recovery or taper weeks.”                                                                                                      |
|Build readiness dashboard        |“/dashboard: 4 progress arcs (current vs target), graduation benchmarks with latest test results, weeks remaining, on-pace indicator. Score chart: solid dots for test weeks, dashed line for estimates.”                                                                                                                                                      |
|Build score history              |“/progress: line chart over time. Solid points (test) vs lighter points (regular). Dashed lines for targets.”                                                                                                                                                                                                                                                  |

**Deliverable:** Full loop: quick-log + benchmark scoring + AI estimates + dynamic rebalancing + readiness dashboard.

**Phase 6: Feedback, Routes & Polish (Weekends 15–17)

Goal: Validator feedback, route recommendations, tier badging, polished UX.

|**What You Do**           |**What You Tell Claude Code**                                                                                                                                                      |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Validator overlay         |“Component_feedback table. If is_validator, show relevance components with upvote/downvote and ‘Add missing.’”                                                                     |
|Wire feedback into prompts|“In /api/estimate-scores, query top-voted feedback for matching tags. Include in prompt.”                                                                                          |
|Route recommendations     |“Cardio card ‘Find Routes’ button. Claude with web search. Clickable result cards.”                                                                                                |
|Tier badging              |“Objective detail page: Gold (‘Calibrated by our team’), Silver (‘AI-generated, anchored’), Bronze (‘AI-generated’).”                                                              |
|Empty states + onboarding |“New user guided flow: quick assess → add objective → generate plan. Show example graduation workouts with placeholder data. Highlight the optional Week 2 test.”                  |
|Mobile polish             |“Stack score arcs vertically. Large touch targets. ‘Mark Complete’ buttons prominent. Calendar to list view on small screens. Test week benchmark forms optimized for phone entry.”|

**Deliverable:** Polished app with validator feedback, tier badging, routes, and mobile-ready UI.

# 10. Common Pitfalls

**Claude Code produces something that doesn’t work

Open browser console. Copy-paste the error to Claude Code.

**App works locally but breaks on Vercel

Most likely missing environment variables. Tell Claude Code to check Vercel’s settings.

**Plans prescribe irrelevant workouts

Prompt problem. Add: “Every exercise must train a key component from the relevance profiles. Never prescribe exercises that target irrelevant components.”

**Test week scores don’t match expectations

Check the formula: score = (avg % of benchmarks, each capped at 100%) × target score. Common bugs: using raw percentage instead of multiplying by target, not capping exceeded benchmarks at 100%, averaging incorrectly.

**Self-assessment scores jump wildly after first test week

This is expected and by design. The self-assessment is intentionally rough — the UI warns users that scores are estimates until the first test. If the jump is too large, refine the self-assessment questions to better correlate with benchmark performance.

**Graduation benchmarks feel wrong

For Gold-tier: adjust in validated_objectives directly. For Silver/Bronze: iterate on Prompt 1. Add more validated objectives as anchors to improve calibration.

**Recovery weeks accidentally contain benchmarks or scoring

Check the week_type field. Recovery weeks must have week_type = ‘recovery.’ The scoring and rebalancing logic should skip recovery and taper weeks entirely.

**Regular week estimates drift far from test week actuals

Tighten Prompt 3: “Max ±3 points per dimension per regular week. Never adjust more without test data.” The self-correcting design means drift is temporary.

**Rebalancing feels too aggressive or too subtle

Adjust thresholds: full rebalance if 3+ points off after test week, emergency if 5+ off during regular weeks. The 60% maintenance floor prevents over-correction.

**The project feels overwhelming

The core loop (quick assessment → plan with graduation workouts → Mark Complete logging → test week scoring → adapt) is all that matters for V1. Get it working for your own training first.

**Claude Code breaks something

Commit after every working feature. Revert via Claude Code or GitHub Desktop.

# 11. Conceptual Reference

Just enough to direct Claude Code. Skim now, refer back later.

## 11.1 Next.js Structure

The “app” folder maps to URLs. app/dashboard/page.tsx → /dashboard. app/api/generate-plan/route.ts → API endpoint. layout.tsx wraps pages with shared elements.

## 11.2 Supabase

PostgreSQL with visual dashboard. Create tables and query in the browser. JS library for app connections. Row Level Security ensures data isolation.

## 11.3 Claude API

Send system prompt (coaching instructions) + user message (athlete data + graduation benchmarks + relevance profiles). Receive structured JSON. API key is server-side only.

## 11.4 Deployment

Vercel watches GitHub. Push = auto-deploy in ~60 seconds. Build errors go to Claude Code.

## 11.5 Server vs. Client

API keys: server-side only. User interactions: client-side. Claude Code knows the difference.

# 12. Resources

|**Purpose**                  |**Resource**                                                    |
|-----------------------------|----------------------------------------------------------------|
|Next.js (skim only)          |nextjs.org/docs — Project Structure and Routing                 |
|Supabase visually            |Supabase YouTube — Getting Started and RLS videos               |
|Prompt engineering (critical)|docs.anthropic.com/en/docs/build-with-claude/prompt-engineering |
|Git basics                   |GitHub Desktop docs: docs.github.com/en/desktop                 |
|Session format reference     |Mountain Tactical Institute (mtntactical.com) — Peak Bagger plan|
|Training philosophy          |Steve House, “Training for the New Alpinism”                    |

# 13. Timeline Summary

|**Timeframe** |**What You’ll Have**                                                                                                            |
|--------------|--------------------------------------------------------------------------------------------------------------------------------|
|Weekend 1     |Deployed app with authentication.                                                                                               |
|Weekends 2–5  |Calendar with tiered objectives. Validated library (15 objectives). AI scoring for Silver/Bronze. Graduation benchmarks visible.|
|Weekends 6–7  |Quick assessment with instant estimated scores. Gap to objective visible. Graduation workouts as finish line.                   |
|Weekends 8–10 |MTI-level plans with three non-overlapping week types, optional early test, and graduation progression.                         |
|Weekends 11–14|Quick-log ‘Mark Complete,’ benchmark-grounded test weeks, AI-estimated regular weeks, dynamic rebalancing, readiness dashboard. |
|Weekends 15–17|Validator feedback, tier badging, route recommendations, polished mobile-ready dashboard.                                       |

**What Makes This App Special

Most training apps give you abstract fitness numbers. Summit Planner gives you a concrete finish line: by the end of this plan, you will do 700 loaded step-ups in 30 minutes and hike 6 miles with 2,000 feet of gain in under 2:15. That’s your Cardio graduation workout for Mont Blanc. Every week, the same exercises get a little harder, and you watch yourself approach that target.

The scoring is grounded in real performance: test weeks measure you against graduation benchmarks with precise math. Regular weeks use AI to estimate progress with the flexibility to handle whatever you actually do. Quick-log means one tap on good days; detailed entry when you deviate. Dynamic rebalancing shifts your time to where it matters most, and the next test week always snaps everything back to reality.

The validated objectives library means the most popular objectives have curated, proven benchmarks — not AI guesswork. The relevance profiles make sure your training counts: hip openers move your Mont Blanc flexibility score; neck stretches don’t. And the three non-overlapping week types (test, recovery, regular) mean every week has one clear purpose.

This isn’t a spreadsheet with formulas. It’s a coach with a plan, a scoreboard, and the intelligence to adapt when life gets in the way.

Start this weekend. Create your four accounts. Open Claude Code. Say “Create a new Next.js project with Tailwind and Supabase.” The summit is closer than you think.
