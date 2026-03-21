-- Migration: AI Relevance Evaluation + Max Hours Update
-- Adds rating_comment column to workout_logs

-- 1. Add rating_comment to workout_logs (required when rating != 3)
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating_comment TEXT;
