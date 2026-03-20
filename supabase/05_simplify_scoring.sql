-- Migration: Simplify scoring system
-- Replace benchmark-based scoring with 1-5 self-rating per workout

-- Add rating column to workout_logs
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 1 AND rating <= 5);

-- Update all existing weekly_targets to have week_type = 'regular'
UPDATE weekly_targets SET week_type = 'regular' WHERE week_type != 'regular';
