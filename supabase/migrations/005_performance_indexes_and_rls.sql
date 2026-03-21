-- Migration 005: Performance indexes and RLS optimization
-- Addresses plan page latency by adding missing indexes and simplifying RLS policies

-- 1. COMPOSITE INDEXES for frequently queried patterns

-- training_plans: fetched by user_id + status on every /plan load
CREATE INDEX IF NOT EXISTS idx_training_plans_user_status
  ON training_plans (user_id, status);

-- weekly_targets: fetched by plan_id + ordered by week_number
CREATE INDEX IF NOT EXISTS idx_weekly_targets_plan_week
  ON weekly_targets (plan_id, week_number);

-- workout_logs: fetched by user_id + plan_id on /plan load
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_plan
  ON workout_logs (user_id, plan_id);

-- score_history: fetched by user_id + objective_id + change_reason
CREATE INDEX IF NOT EXISTS idx_score_history_user_objective
  ON score_history (user_id, objective_id, change_reason);

-- objectives: fetched by user_id (dashboard, calendar)
CREATE INDEX IF NOT EXISTS idx_objectives_user
  ON objectives (user_id);

-- 2. RLS OPTIMIZATION for weekly_targets
-- The existing policies use an expensive EXISTS subquery joining to training_plans
-- on every row. Replace with a direct user_id column + simple equality check.

-- Add user_id column to weekly_targets for direct RLS checks
ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Backfill user_id from the parent training_plans table
UPDATE weekly_targets
  SET user_id = training_plans.user_id
  FROM training_plans
  WHERE weekly_targets.plan_id = training_plans.id
    AND weekly_targets.user_id IS NULL;

-- Index for the new direct RLS check
CREATE INDEX IF NOT EXISTS idx_weekly_targets_user
  ON weekly_targets (user_id);

-- Drop old expensive RLS policies and replace with direct user_id check
DROP POLICY IF EXISTS "Users can read weekly targets via plan" ON weekly_targets;
DROP POLICY IF EXISTS "Users can manage weekly targets via plan" ON weekly_targets;

CREATE POLICY "Users own their weekly targets" ON weekly_targets
  FOR ALL TO authenticated USING (auth.uid() = user_id);
