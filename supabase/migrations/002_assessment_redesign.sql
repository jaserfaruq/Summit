-- Migration: Assessment System Redesign
-- Adds climbing_role to objectives, adds objective_id and new fields to assessments

-- 1. Add climbing_role to objectives
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS climbing_role TEXT;

-- 2. Add objective_id to assessments (assessment is now per-objective)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS objective_id UUID REFERENCES objectives(id);

-- 3. Add new assessment fields for two-layer assessment
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS standard_answers JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS ai_questions JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS ai_answers JSONB;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS freeform_text TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS ai_reasoning JSONB;

-- 4. Create index on assessments.objective_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_assessments_objective_id ON assessments(objective_id);
