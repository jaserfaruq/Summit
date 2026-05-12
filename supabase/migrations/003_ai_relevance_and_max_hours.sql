-- Migration: AI Relevance Evaluation + Max Hours Update
-- Adds plan_id, week_number, rating, and rating_comment columns to workout_logs

-- 1. Add plan_id, week_number, and rating to workout_logs (present in production, missing from migration 001)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES training_plans(id);
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS week_number INT;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating INT;

-- 2. Add rating_comment to workout_logs (required when rating != 3)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating_comment TEXT;
