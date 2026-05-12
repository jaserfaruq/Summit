-- Migration: AI Relevance Evaluation + Max Hours Update
-- Adds columns that were present in production but missing from migration 001

-- 1. Add plan_id, week_number, and rating to workout_logs
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES training_plans(id);
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS week_number INT;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating INT;

-- 2. Add rating_comment to workout_logs (required when rating != 3)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating_comment TEXT;

-- 3. Add current_week_number to training_plans (tracks active week, advances on completion)
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS current_week_number INT DEFAULT 1;
