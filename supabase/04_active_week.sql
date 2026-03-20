-- Add active week tracking to training_plans
-- Decouples "current week" from calendar dates so users can progress at their own pace
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS current_week_number INT DEFAULT 1;

-- Associate workout logs with a specific plan week instead of relying on date ranges
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS week_number INT;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES training_plans(id);
