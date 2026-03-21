# Summit Planner — Product Guide

> Version 7 (Post-Audit + Assessment Redesign) — March 2026 — Prepared for Jaser
> Companion spec: `CLAUDE.md` at project root.

-----

Prepared for Jaser

**1. The Mindset Shift: You Are the Product Director**

You are not learning to code this app. Claude Code codes it. Your job is to direct with clear, specific, plain-language instructions. This guide documents the architecture, the product decisions, and the rationale behind every design choice. The companion CLAUDE.md file in the repo is the implementation spec that Claude Code reads directly.

|**Your Job**                            |**Claude Code’s Job**                      |
|----------------------------------------|-------------------------------------------|
|Describe features, screen by screen     |Write React components, pages, styling     |
|Define data model and relationships     |Create tables, queries, migrations         |
|Write AI coaching prompts               |Build API routes, parse responses          |
|Curate validated objectives & benchmarks|Build database, matching, admin UI         |
|Define graduation workouts and targets  |Implement scoring engine and visualizations|
|Review, test, and refine                |Fix bugs, adjust layouts, refactor         |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>The 90/10 rule</strong></p>
<p>Claude Code writes ~90% of the code. Your 10%: prompts, curating the validated objectives library, defining graduation targets, managing validators, and testing by training with the app. That 10% is where all the product value lives.</p></td>
</tr>
</tbody>
</table>

**2. What Was Built (Current State of the App)**

The app was built by providing Claude Code with the implementation spec (CLAUDE.md) and asking it to build the entire app. Then it was iteratively refined through direct conversation with Claude Code. This section reflects the current state after the full-build experiment and subsequent refinements.

**2.1 Architecture**

Next.js 14 with App Router, Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Anthropic Claude API, deployed on Vercel with auto-deploy from GitHub.

The most significant architectural decision made during the build: plan generation was split from a single monolithic Claude API call into a two-phase approach. Phase 1 creates the plan structure (week schedule, expected scores, graduation workouts) without detailed sessions. Phase 2 generates sessions on-demand, one week at a time, when the user expands that week. This solved Vercel’s 60-second serverless timeout and actually produces a better user experience: the plan appears instantly, and sessions load as needed.

**2.2 What’s Working**

- Auth: signup, login, logout, protected routes
- 5-step assessment wizard producing baseline scores (being redesigned to AI-powered two-layer assessment)
- Calendar with objective creation and Gold/Silver/Bronze tier matching
- AI-powered search for objective suggestions (Prompt SEARCH)
- Target score estimation with taglines, relevance profiles, graduation benchmarks (Prompt 1)
- Plan generation with on-demand session creation (Prompt 2B)
- Weekly completion with 1–5 rating system
- Session alternatives (“Try Different” with Prompt 6)
- Difficulty adjustment (easier/harder with Prompt RESCALE)
- Math-only rebalancing with on-demand session regeneration
- Progress page with score history charts
- Admin page for validated objectives (validator-only)
- Delete plan and delete workout with score reversion
- Mountain hero images via Unsplash
- 15 validated objectives and 15 benchmark exercises seeded

**2.3 What’s Not Yet Built (Priority Order)**

1. AI relevance evaluation on non-3 ratings (Prompt 3B) — the core product differentiator
1. Assessment redesign — two-layer AI-powered assessment with objective-specific questions and AI scoring with reasoning
1. Validator overlay UI for relevance profile feedback
1. Route recommendations UI on cardio sessions
1. Score chart on the dashboard (exists on /progress only)
1. AI-powered rebalancing via Prompt 4 (currently math-only)

**3. The Scoring System**

The scoring system is the most important part of the app. It answers “Am I ready?” with concrete, measurable benchmarks.

**3.1 Four Fixed Dimensions**

Cardio, Strength, Climbing/Technical, and Flexibility. Names never change. Each gets an AI-generated tagline (4–7 words) per objective. When a dimension is irrelevant (e.g., Climbing/Technical for a road marathon), target score is 0 and the card is grayed out.

**3.2 Scores Are Per-Objective**

Scores are tied to a specific objective, not to the user globally. A Flexibility score of 60 for Mont Blanc means something different than 60 for a bouldering trip. V1 supports one active objective. The data model is V2-ready for multi-objective optimization.

**3.3 Graduation Workouts**

Each dimension has 2–4 benchmark exercises defining “ready.” These are concrete sessions the user works toward: “700+ loaded step-ups in 30 minutes” not an abstract number. The weekly plan sessions are scaled-down versions of the graduation workouts, progressively building toward them.

**Overshoot rule:** Graduation benchmarks are set at ~150% of actual objective requirements. If you can hit the graduation workout, you’re more than ready — not just barely ready. This is how good coaches think.

**3.4 Getting First Scores: Two-Layer AI Assessment**

The assessment happens AFTER creating the objective, so the AI knows what to score against. The flow is: create objective → take assessment → generate plan.

**Layer 1 — Standard questions (~2 minutes):** Same for everyone. Training days per week, longest cardio effort, strength training experience, climbing level and skills, flexibility self-rating. These give the AI a baseline.

**Layer 2 — AI-generated questions (3–5 questions):** The AI reads the objective’s graduation benchmarks and relevance profiles, then generates follow-up questions specific to this objective. Mont Blanc asks about loaded pack hiking and altitude exposure. The Exum Ridge asks about multi-pitch trad efficiency. A trail ultra asks about time on feet beyond 4 hours. Each assessment feels custom because it is.

**Lead vs. Follow (required for climbing objectives):** The AI’s first question for any objective with a Climbing/Technical target above 15 is: “Do you plan to lead or follow?” This single answer reshapes the entire climbing dimension. Following drops the target to ~60% and shifts benchmarks from trad lead skills to seconding, cleaning gear, and rappel confidence. Leading keeps the full target with gear placement, anchor building, and route-finding benchmarks.

**“Want a more precise assessment?” button:** Generates 2–3 additional questions based on gaps the AI identified in the first round.

**Free-form field:** “Anything else you think is relevant to your readiness for [objective name]?”

**AI scoring with reasoning:** Claude scores 0–100 per dimension with 2–3 sentences explaining each score and a key factor. “Strength: 32 — Your 405lb squat shows raw power but the graduation benchmark is 12 rounds of leg blasters, which tests endurance, not max load. Key factor: untested for muscular endurance.”

**Programming hints (new):** The AI also outputs specific guidance for the plan generator: starting intensity per dimension, recommended sessions per week, and key adaptations. These flow directly into Prompt 2B so the plan adapts to the athlete’s specific profile. A bodybuilder’s step-ups start at 25lb (not 35lb). A runner gets 2 cardio sessions (not 4) because their base is already strong. A CrossFit athlete’s climbing sessions focus on trad skills, not harder grades.

**Optional early test (Week 2):** The plan still offers an early benchmark test in Week 2 to calibrate with real performance data.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Assessment → Programming pipeline</strong></p>
<p>The assessment doesn’t just produce scores — it produces programming intelligence. A form that says “Cardio: 35” tells the plan generator nothing about HOW to train this athlete. The AI assessment says “Cardio: 35 — strong runner but no loaded hiking experience, start step-ups at 25lb not 35lb, needs 3 cardio sessions/week.” That’s the difference between a score and a coaching decision.</p></td>
</tr>
</tbody>
</table>

**3.5 Exercise Selection Guardrails**

The AI adapts emphasis, progression, and time allocation — not the exercise vocabulary. All prescribed exercises must be standard, well-known movements: step-ups, lunges, leg blasters, push-ups, pull-ups, dead hangs, farmer carries, planks, hip flexor stretches, climbing routes, rappels, and sport-specific movement drills. Graduation benchmark exercises anchor the test weeks. The AI never invents novel exercises. Three athletes training for the same objective get the same exercises at different intensities and allocations.

**3.5 Three Week Types (Never Overlap)**

|**Week Type**        |**Details**                                                                                              |
|---------------------|---------------------------------------------------------------------------------------------------------|
|Test (75–80% volume) |3 of 5 sessions have benchmarks. Precise calibration. Rating system with AI relevance evaluation applies.|
|Recovery (50% volume)|No benchmarks. No scoring changes. Pure deload. Scores carry in = scores carry out.                      |
|Regular (100% volume)|Standard training. Rating system with AI relevance applies. Emergency rebalance if 5+ pts behind.        |
|Taper (60% volume)   |Final 2 weeks before objective. Scores locked. No rebalancing. Last test week falls before taper.        |

**3.6 The Rating & Relevance System**

This is the product’s core innovation, combining speed for compliant users with AI intelligence for deviations.

**Rating 3 (“Just right”):** User did the prescribed session. One tap. Full credit (multiplier 1.0). No AI call. No comment needed. This is 80% of all interactions.

**Rating 1, 2, 4, or 5:** Something was different. App requires a comment: “Tell us what happened.” The AI reads the comment against the objective’s relevance profiles and adjusts the multiplier by ±0.25.

|**Rating**       |**Base → AI Range**|
|-----------------|-------------------|
|1 “Way too hard” |0 → 0–0.25         |
|2 “Struggled”    |0.5 → 0.25–0.75    |
|3 “Just right”   |1.0 (no AI call)   |
|4 “Slightly easy”|1.25 → 1.0–1.5     |
|5 “Way too easy” |1.5 → 1.25–1.75    |

The AI can never flip the meaning of a rating — a “struggled” can’t score better than “just right.” The bounds keep things sensible while letting relevance matter.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Why this works</strong></p>
<p>The plan already accounts for relevance when it’s generated — the AI prescribed hip openers, not neck stretches. If the user follows the plan (rating 3), relevance is already baked in. The AI relevance evaluation only fires when something is different — which is exactly when it’s needed. A user who rates 2 and says “struggled through all the step-ups” gets higher credit than one who says “gave up and went swimming.” Same rating, different relevance, different score.</p></td>
</tr>
</tbody>
</table>

**3.7 Other Scoring Rules**

- **Score formula:** newScore = currentScore + expectedWeeklyGain × multiplier
- **No-session regression:** -1 point per dimension per week with no logged sessions
- **Max weekly hours:** 20
- **Volume progression:** Progressive ramp factor 0.7 + (week/total × 0.3), not flat 10% jumps
- **Maintenance mode:** When current score ≥ 1.25× target, dimension drops to 60% volume, 1 session/week
- **Exceeded benchmarks:** Capped at 100% for scoring. Surfaced as “Your cardio exceeds requirements”
- **Expected scores:** Linear interpolation from current to target across plan duration
- **Rebalance threshold:** 5+ points off trajectory triggers math-only rebalancing
- **Week revert:** Deleting a workout from a completed week reverts scores

**3.8 Dynamic Rebalancing**

Currently math-only (no Claude call). Recalculates expected scores from current actuals, adjusts hours per dimension, and clears sessions for on-demand regeneration. Ahead-of-schedule dimensions drop to maintenance (min 60%). Behind-schedule dimensions get the freed time. Total hours stay constant.

**4. The Validated Objectives Library**

**4.1 Three Tiers**

- **Gold (exact match):** Pulls curated scores, taglines, profiles, and benchmarks directly. No AI. Badged “Calibrated by our training team.”
- **Silver (similar anchor):** AI generates using closest validated objectives as calibration anchors. Badged “AI-generated, anchored.”
- **Bronze (novel):** AI generates from scratch using benchmark library. Badged “AI-generated.”

The matching system includes a search mode (Prompt SEARCH) that generates 3 AI-powered suggestions when the user’s query doesn’t directly match, cross-referencing against the validated library.

**4.2 Starter Library (15 Objectives)**

|**Category**           |**Objectives**                                               |
|-----------------------|-------------------------------------------------------------|
|Day hikes              |Half Dome, Colorado 14er Class 1–2, Mt. Whitney              |
|Mountaineering         |Mont Blanc (Goûter), Mt. Rainier (DC), Denali (West Buttress)|
|Alpine rock            |Grand Teton (Upper Exum), Cathedral Peak (SE Buttress)       |
|Trail running          |Trail Half Marathon, 50K Mountain Ultra                      |
|Scrambles & backpacking|Colorado 14er Class 3–4, Enchantments, John Muir Trail       |
|International          |Kilimanjaro (Machame), Tour du Mont Blanc                    |

Full data for each (scores, taglines, relevance profiles, graduation benchmarks) is seeded in the database. See the companion Validated Objectives Library document for detailed breakdowns.

**4.3 Benchmark Exercises Library**

15 curated exercises (3 cardio, 5 strength, 3 climbing, 4 flexibility). Same exercise reused across objectives with different graduation targets. Your team maintains one description per exercise.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Competitive moat</strong></p>
<p>A competitor could use the same AI. Without your curated benchmarks, validated objectives, and proven targets, their plans are unanchored guesswork. The more objectives you validate, the stronger the moat.</p></td>
</tr>
</tbody>
</table>

**5. Relevance Profiles & Validator Feedback**

**5.1 How Relevance Profiles Work**

Each objective stores 7–10 key components and 7–10 irrelevant components per dimension. These profiles serve three purposes: they guide plan creation (the AI prescribes relevant exercises), they power the AI relevance evaluation when users rate non-3 (was the substitution helpful?), and they inform the validator feedback system.

**5.2 Validator Feedback (Not Yet Built)**

A closed community of paid experts sees the component lists and can upvote, downvote, or add missing components. Feedback is tagged by objective type and aggregated into future prompts. The component_feedback table exists; the UI overlay is Priority 2 on the build list.

**6. The AI Prompts**

Ten prompts power the app. Full prompt text is in CLAUDE.md. This section covers the design rationale.

|**Prompt**              |**Purpose & Status**                                                                                                                                           |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Prompt 1: Target Scores |Generates scores, taglines, relevance profiles, graduation benchmarks. Includes overshoot rule and MTI coaching style. Fully working.                          |
|Prompt 2B: Week Sessions|Generates one week’s sessions on demand. MTI-style detail. Uses Opus model. Includes maintenance mode, progress fractions, climbing grade rules. Active prompt.|
|Prompt 3B: AI Relevance |Evaluates user comments on non-3 ratings against relevance profiles. Returns adjusted multiplier ±0.25. NOT YET BUILT.                                         |
|Prompt 4: Rebalancing   |Defined but not called. Math-only rebalancing handles it for now.                                                                                              |
|Prompt 5: Routes        |Route recommendations. Works but missing web_search enablement.                                                                                                |
|Prompt 6: Alternatives  |Generates 2 alternative sessions per dimension. Fully working.                                                                                                 |
|Prompt RESCALE          |Adjusts graduation targets when difficulty changes. Fully working.                                                                                             |
|Prompt SEARCH           |AI-powered objective search with 3 suggestions. Fully working.                                                                                                 |
|Prompt ASSESS-Q         |Generates 3–5 objective-specific assessment questions based on graduation benchmarks. NOT YET BUILT.                                                           |
|Prompt ASSESS-SCORE     |Scores athlete 0–100 per dimension with reasoning, using all assessment data against graduation benchmarks. NOT YET BUILT.                                     |

Prompts 1 and 2B were extensively tested during design with Mont Blanc (Goûter Route) and Grand Teton (Upper Exum Ridge) as reference objectives. See the CLAUDE.md spec for complete prompt text.

**7. Pages & UI**

|**Page**                 |**What It Does**                                                                                                                                                                                       |
|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|/ (Landing)              |Mountain silhouette background, title, Login/Sign Up CTAs                                                                                                                                              |
|/login, /signup          |Supabase Auth, email/password, redirect to /dashboard                                                                                                                                                  |
|/dashboard               |Readiness arcs, this-week sessions, graduation benchmarks, countdown, delete/update buttons, onboarding CTAs for new users                                                                             |
|/calendar                |Monthly grid (desktop) / list (mobile). Objective CRUD with search mode. Tier badges. Color-coded by type.                                                                                             |
|/assessment/[objectiveId]|Two-layer AI assessment. Layer 1: standard fitness questions. Layer 2: 3–5 AI-generated questions specific to this objective + optional ‘ask more’ + free-form. AI scores with per-dimension reasoning.|
|/plan                    |Hero image. Difficulty selector. Graduation workouts pinned. Score trajectory chart. Week list with on-demand session loading. Mark Complete with 1–5 rating. Alternatives panel. Rebalance button.    |
|/log                     |Quick-log (rating 3) and full-log. Rating selector. Comment required for non-3. Dimension-specific fields. Benchmark entry on test weeks.                                                              |
|/progress                |Score line charts per dimension. Solid dots (test weeks) vs lighter (regular). Dashed target lines.                                                                                                    |
|/admin/objectives        |Validator-only CRUD for validated objectives.                                                                                                                                                          |

**8. Data Model Summary**

10 tables. Full SQL schemas are in CLAUDE.md. Key points:

- **Current scores live on objectives, not profiles.** V2-ready for multi-objective.
- **training_plans.current_week_number** tracks active week, decoupled from calendar.
- **workout_logs links to plan_id and week_number** directly, not by date range.
- **score_history.change_reason** uses assessment / weekly_rating / rebalance.
- **weekly_targets.week_type** enum: test / recovery / regular / taper. Never overlap.
- **workout_logs.rating + rating_comment** support the new relevance evaluation system.
- **component_feedback table exists** but validator UI is not yet built.

**9. What to Build Next**

The app is functional end-to-end. These are the remaining features, in priority order.

**Priority 1: AI Relevance Evaluation (Prompt 3B)**

The core product differentiator. When a user rates non-3, their required comment is evaluated by the AI against the objective’s relevance profiles. The AI adjusts the base multiplier by ±0.25. This is what makes Summit Planner intelligent — two users doing the same amount of work get different score credit based on whether they trained the right things.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to tell Claude Code</strong></p>
<p>“Implement Prompt 3B from CLAUDE.md. In the /api/complete-week route, for any dimension where the rating is not 3, call Claude with the user’s comment and the objective’s relevance profiles. The AI returns an adjusted multiplier (base ±0.25). Use that adjusted multiplier instead of the base multiplier for the score calculation. The comment field should already be required for non-3 ratings in the UI; if not, add that requirement.”</p></td>
</tr>
</tbody>
</table>

**Priority 2: Assessment Redesign**

Replace the current form-based assessment with a two-layer AI-powered assessment. Layer 1: standard fitness questions (same for everyone). Layer 2: 3–5 AI-generated questions tailored to the specific objective’s graduation benchmarks and relevance profiles. Optional “ask me more” for 2–3 additional questions. Free-form “anything else” field. AI scores with per-dimension reasoning shown to the user.

This also flips the onboarding flow: create objective first, then assess. The dashboard CTAs change from “Take assessment” → “Add objective” as the first step.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>What to tell Claude Code</strong></p>
<p>“Redesign the assessment flow per CLAUDE.md. Create /api/generate-assessment-questions (Prompt ASSESS-Q) and /api/score-assessment (Prompt ASSESS-SCORE). Change /assessment to /assessment/[objectiveId]. Layer 1: standard questions. After submission, call the AI to generate 3–5 objective-specific follow-up questions. Show a ‘Want a more precise assessment?’ button for 2–3 more. Add free-form field. AI scores with reasoning displayed per dimension. Update dashboard CTAs: objective first, then assess.”</p></td>
</tr>
</tbody>
</table>

**Priority 3: Validator Overlay UI**

The component_feedback table exists. Build the UI: on the objective detail page, if is_validator = true, show relevance profile components with upvote/downvote buttons and “Add missing component” input per dimension.

**Priority 4: Route Recommendations UI**

The /api/find-routes endpoint exists. Wire it into cardio session cards with a “Find Routes” button. Enable the web_search tool in the Claude API call so it returns real local routes instead of training-data guesses.

**Priority 5: Dashboard Score Chart**

The /progress page has score charts. Add a compact version to the /dashboard so users see their trajectory without navigating away.

**Priority 6: Max Hours Update**

Change the max weekly hours cap from 10 to 20 in the plan generation logic.

**10. Key Files in the Repo**

|**File**                                  |**Purpose**                                                                                                              |
|------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
|CLAUDE.md                                 |Implementation spec. Claude Code reads this every session. Contains full schemas, all prompts, API routes, scoring rules.|
|docs/PRODUCT_GUIDE.md                     |This guide in markdown form. Rationale, design history, product context.                                                 |
|supabase/migrations/001_initial_schema.sql|Database schema. Run in Supabase SQL Editor.                                                                             |
|supabase/seed.sql                         |Seed data: 15 validated objectives, 15 benchmark exercises.                                                              |
|src/lib/prompts.ts                        |All AI prompt text.                                                                                                      |
|src/lib/scoring.ts                        |Scoring engine: formulas, interpolation, rebalance triggers.                                                             |
|src/lib/claude.ts                         |Claude API client with JSON extraction and caching.                                                                      |

**What Makes This App Special**

Most training apps give you abstract fitness numbers. Summit Planner gives you a concrete finish line: by the end of this plan, you will do 700 loaded step-ups in 30 minutes and hike 6 miles with 2,000 feet of gain in under 2:15. Every week, the same exercises get harder as you approach that target.

The rating system is fast when you follow the plan (one tap) and intelligent when you deviate (AI evaluates relevance). The validated objectives library means popular routes have curated, proven benchmarks. The overshoot rule means if you hit the graduation workout, you’re more than ready. And the relevance profiles make sure your training counts: hip openers move your Mont Blanc flexibility score; neck stretches don’t.

This isn’t a spreadsheet. It’s a coach with a plan, a scoreboard, and the intelligence to adapt when life gets in the way.