# Summit Planner — Spec Compliance Audit

Comparison of the current codebase against the CLAUDE.md specification.

---

## 1. DATABASE SCHEMA

### Matching Spec
All 10 tables exist with correct column definitions: `profiles`, `validated_objectives`, `benchmark_exercises`, `objectives`, `assessments`, `score_history`, `training_plans`, `weekly_targets`, `workout_logs`, `component_feedback`.

### Deviations

| Change | Spec | Codebase |
|--------|------|----------|
| `training_plans.current_week_number` | Not in spec | **Added** (`INT DEFAULT 1`) — tracks active week, decouples from calendar |
| `workout_logs.week_number` | Not in spec | **Added** (`INT`) — links log to plan week |
| `workout_logs.plan_id` | Not in spec | **Added** (`UUID REFERENCES training_plans`) — links log to plan |
| `score_history.change_reason` values | `assessment \| test_week \| regular_week \| rebalance` | `assessment \| weekly_rating \| rebalance` — `test_week` and `regular_week` replaced by `weekly_rating` |

---

## 2. API ROUTES

### Spec Routes — Status

| Route | Status | Notes |
|-------|--------|-------|
| `POST /api/match-objective` | **Modified** | Added "search" mode with Claude-powered suggestions (Prompt SEARCH). Added seed data overlay. Legacy single-match field preserved. |
| `POST /api/estimate-scores` | **Matching** | Works as specified. |
| `POST /api/generate-plan` | **Modified** | No longer calls Claude for sessions. Creates plan structure with linear interpolation + empty sessions. Fetches Unsplash hero image. Sessions generated on-demand later. |
| `POST /api/complete-week` | **Matching** | Rating multiplier formula matches. Also advances `current_week_number`. |
| `POST /api/rebalance` | **Modified** | Does NOT call Claude (Prompt 4). Recalculates expected scores from current actuals, recalculates hours, clears sessions for on-demand regeneration. |
| `POST /api/find-routes` | **Modified** | Missing `web_search` tool enablement per spec. |

### New Routes (Not in Spec)

| Route | Purpose |
|-------|---------|
| `POST /api/generate-week-sessions` | On-demand single-week session generation via Claude (Prompt 2B) |
| `POST /api/generate-all-sessions` | Batch-generates all remaining weeks (up to 3 concurrent) |
| `POST /api/generate-alternatives` | Generates 2 alternative sessions via Claude (Prompt 6) |
| `POST /api/replace-session` | Swaps a session with an alternative, preserves originals |
| `POST /api/adjust-difficulty` | Rescales target scores + benchmarks (harder/easier) via Claude |
| `POST /api/delete-plan` | Cascading delete of plan + objective + weekly targets |
| `POST /api/delete-workout` | Deletes workout log, reverts scores if week was already completed |
| `GET /api/debug-claude` | Diagnostic endpoint for Claude API connectivity |

---

## 3. AI PROMPTS

### Prompt 1 (Target Score Estimation)
- **Added:** MTI reference plan URLs (spec only had these in Prompt 2)
- **Added:** "TRAINING OVERSHOOT RULE" — graduation benchmarks set above actual requirements (~150% cardio distance/elevation, +1/+2 climbing sub-grades)
- **Added:** "You think in the style of Mountain Tactical Institute"
- Validator feedback / calibration anchor sections match spec

### Prompt 2 (Plan Generation)
- **Split into 3 sub-prompts:** Prompt 2 (full, unused), Prompt 2A (summary-only, unused), Prompt 2B (single-week, active)
- **Prompt 2B** is the active prompt with major additions:
  - TRAINING OVERSHOOT rules
  - CLIMBING GRADE PRESCRIPTION RULES (relative descriptors, not raw grades)
  - MAINTENANCE MODE logic (current >= 1.25x target → 60% volume)
  - Per-dimension PROGRESS FRACTIONS system
  - Per-exercise `durationMinutes` field requirement
  - `warmUpMinutes` and `cooldownMinutes` fields
  - Duration required in cardio exercise `details` text
  - Removed `estimatedMinutes` from session objective line
- **Removed:** "Never exceed 12 hours per week for a recreational athlete" (code caps at 10hrs)
- **Removed:** `planSummary` from output schema (Prompt 2B generates sessions only)

### Prompt 3
- Spec says removed — confirmed absent from codebase.

### Prompt 4 (Rebalancing)
- Defined in `prompts.ts` but **NOT actively called** by `/api/rebalance`. Route does math-only rebalancing.
- **Added:** MAINTENANCE MODE rules

### Prompt 5 (Route Recommendations)
- Prompt text matches spec.
- **Missing:** `web_search` tool is NOT enabled (spec requires it).

### New Prompts (Not in Spec)

| Prompt | Purpose |
|--------|---------|
| **Prompt 6** (Alternatives) | Generates 2 alternative sessions per dimension with specific guidance (outdoor/gym cardio, bodyweight/equipment strength, bouldering/outdoor climbing, different flexibility modalities) |
| **Prompt RESCALE** (Difficulty) | Rescales graduation benchmark targets proportionally when difficulty is adjusted |
| **Prompt SEARCH** (Suggestions) | Claude-powered objective search returning 3 geographically relevant suggestions with validated library matching |

### Model Usage
- **Spec:** `claude-sonnet-4-20250514` only
- **Code:** `claude-sonnet-4-20250514` (default) **AND** `claude-opus-4-20250514` (for session generation via Prompt 2B)
- **Added:** Prompt caching via `callClaudeWithCache()` with ephemeral cache control

---

## 4. SCORING & BUSINESS LOGIC

### Matching Spec
- Rating multipliers: `{1: 0, 2: 0.5, 3: 1.0, 4: 1.25, 5: 1.5}` — exact match
- Score formula: `newScore = currentScore + expectedGain × multiplier` — exact match
- No-session regression: -1 point per dimension per week — matches spec
- Rebalance threshold: 5+ points off trajectory — matches spec
- Linear interpolation for expected scores — matches spec
- Taper: 40% volume reduction in final 2 weeks — matches spec (0.6 multiplier)

### Deviations & Additions

| Area | Spec | Codebase |
|------|------|----------|
| Score arc green | "within 10 of target" | `current >= target` OR gap ≤ 10 (added at-or-above-target case) |
| Score arc yellow | "10–25 away" | gap 11–24 (gap of exactly 25 = red, not yellow) |
| Max weekly hours | "Never exceed 12 hours" | Capped at 10 hours (`min(daysPerWeek * 1.2, 10)`) |
| Volume progression | "10% per week" | Progressive factor `0.7 + (week/total × 0.3)` — gradual ramp |

### New Business Logic (Not in Spec)

| Feature | Description |
|---------|-------------|
| **Maintenance mode** | `current >= 1.25 × target` → 60% volume, 1 session/week |
| **Progress fractions** | Three-tier system: maintenance (60%), at-target (80%→100%), below-target (max(50%, current/target)→100%) |
| **Difficulty adjustment** | Scale factors: much_easier=0.60, slightly_easier=0.80, slightly_harder=1.20, much_harder=1.50 applied to remaining gap |
| **Session minutes calc** | Sum of warmUp + training durationMinutes + cooldown, fallback to 45min |
| **Week revert on delete** | Deleting a workout from a completed week reverts scores and week number |

---

## 5. PAGES & UI

### Matching Spec
- `/login`, `/signup` — Standard Supabase auth, email/password
- `/dashboard` — Conditional CTAs, 4 score arcs, this-week sessions, graduation benchmarks, countdown
- `/calendar` — Monthly grid, mobile list view, color-coded objectives, tier badges, click-to-create
- `/assessment` — Multi-step wizard with cardio/strength/climbing/flexibility, summary gauges
- `/plan` — Header, score trajectory chart, graduation benchmarks, week list, session cards, rebalance button
- `/log` — Quick-log (rating 3) and full-log modes, 1–5 rating selector
- `/progress` — Line charts per dimension, target dashed lines
- `/admin/objectives` — Validator-only, CRUD for validated objectives

### Deviations

| Page | Spec | Codebase |
|------|------|----------|
| `/assessment` | 4-step wizard | **5-step wizard** (climbing skills expanded into checkboxes: indoor gym, outdoor sport, trad, multi-pitch, glacier, crevasse rescue) |
| `/log` rating labels | "Way too hard / couldn't complete", "Harder than expected", "Just right", "Easier than expected", "Way too easy" | "Way too hard", "Struggled", "Just right", "Slightly easy", "Way too easy" |
| `/plan` | No alternatives feature | **AlternativesPanel** with "Try Different" button per session |
| `/plan` | No difficulty adjustment | **Difficulty selector** (easier/harder/way easier/way harder) |
| `/plan` | No hero image | **Mountain silhouette SVG** fallback + Unsplash hero image |
| `/dashboard` | No delete/update buttons | **DeletePlanButton** and **UpdateAssessmentButton** components |
| Home page `/` | Not specified | **Landing page** with blurred background, title, login/signup CTAs |

### New Components (Not in Spec)

| Component | Purpose |
|-----------|---------|
| `AlternativesPanel` | Modal for generating and selecting alternative sessions |
| `DeletePlanButton` | Confirmation-gated plan deletion |
| `UpdateAssessmentButton` | Re-assessment with plan regeneration |
| `WeekBadge` | Deprecated (returns null), kept for compat |

---

## 6. FEATURES NOT YET BUILT

| Spec Feature | Status |
|--------------|--------|
| **Validator overlay** on objective detail page (upvote/downvote components, "add missing component" input) | **Not built** — `component_feedback` table exists but no UI |
| **Route recommendations UI** integration on cardio session cards | **Not built** — API exists but no UI integration |
| **`web_search` tool** for Prompt 5 (find-routes) | **Not enabled** |
| **Prompt 4 via Claude** for rebalancing (AI-regenerated sessions) | **Not called** — rebalance is math-only, sessions regenerate on-demand |
| **Score chart on dashboard** (line chart over time with dashed target lines) | **Not on dashboard** — exists on `/progress` page only |

---

## 7. INFRASTRUCTURE & CONFIG

| Area | Spec | Codebase |
|------|------|----------|
| Design colors | #1B4D3E, #D4782F, #F4F1EC, #8B9D83 | All implemented in Tailwind config + actively used |
| Next.js version | 14+ | 14.2.35 |
| Supabase | Auth + RLS | Implemented with SSR middleware |
| Claude model | `claude-sonnet-4-20250514` | Sonnet + **Opus** (`claude-opus-4-20250514`) |
| Seed data | 15 validated objectives | **15 objectives** — all match spec list exactly |
| Deployment | Vercel auto-deploy | No `vercel.json`; relies on auto-detection |
| Extra dependency | None specified | `@supabase/ssr` for server-side auth, Unsplash API for hero images |

---

## Summary

**Core architecture matches spec.** The major evolution is the shift from monolithic plan generation (one Claude call for all weeks) to **on-demand session generation** (structure first, then per-week Claude calls). This introduced Prompt 2B, the progress fractions system, and maintenance mode — none of which are in the spec.

The biggest **gaps** are the validator feedback overlay UI and the route recommendations UI integration. The biggest **additions** are session alternatives, difficulty adjustment, workout deletion with score reversion, and the search-mode objective matching.
