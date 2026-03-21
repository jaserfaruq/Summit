-- Migration: Weekly Report
-- Adds weekly_report JSONB column to weekly_targets for AI-generated reports

ALTER TABLE weekly_targets ADD COLUMN IF NOT EXISTS weekly_report JSONB;
