-- Migration 008: Add suggested skill practice to weekly targets
-- Stores AI-generated skill practice suggestions (rock climbing drills, alpine/mountaineering skills)
-- as a JSONB array on each week. These are opportunistic practice items, not structured workout sessions.

ALTER TABLE weekly_targets
  ADD COLUMN IF NOT EXISTS suggested_skill_practice JSONB;
