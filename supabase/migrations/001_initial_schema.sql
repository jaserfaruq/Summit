-- Summit Planner: Complete Database Schema
-- Migration 001: Initial schema with all tables and RLS policies

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  location TEXT,
  training_days_per_week INT DEFAULT 5,
  equipment_access TEXT[],
  is_validator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VALIDATED_OBJECTIVES (reference data)
-- ============================================
CREATE TABLE validated_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route TEXT NOT NULL,
  match_aliases TEXT[] NOT NULL,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT,
  summit_elevation_ft INT,
  total_gain_ft INT,
  distance_miles FLOAT,
  duration_days INT,
  technical_grade TEXT,
  tags JSONB NOT NULL DEFAULT '[]',
  target_scores JSONB NOT NULL DEFAULT '{}',
  taglines JSONB NOT NULL DEFAULT '{}',
  relevance_profiles JSONB NOT NULL DEFAULT '{}',
  graduation_benchmarks JSONB NOT NULL DEFAULT '{}',
  recommended_weeks INT,
  created_by TEXT,
  last_reviewed DATE,
  status TEXT DEFAULT 'active'
);

ALTER TABLE validated_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read validated objectives" ON validated_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Validators can insert validated objectives" ON validated_objectives
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_validator = true)
  );

CREATE POLICY "Validators can update validated objectives" ON validated_objectives
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_validator = true)
  );

CREATE POLICY "Validators can delete validated objectives" ON validated_objectives
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_validator = true)
  );

-- ============================================
-- BENCHMARK_EXERCISES (reference data)
-- ============================================
CREATE TABLE benchmark_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  dimension TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  equipment_required TEXT[],
  is_gym_reproducible BOOLEAN DEFAULT TRUE,
  difficulty_scale JSONB,
  measurement_type TEXT NOT NULL,
  measurement_unit TEXT,
  created_by TEXT,
  status TEXT DEFAULT 'active'
);

ALTER TABLE benchmark_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmark exercises" ON benchmark_exercises
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Validators can manage benchmark exercises" ON benchmark_exercises
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_validator = true)
  );

-- ============================================
-- OBJECTIVES (user-specific)
-- ============================================
CREATE TABLE objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_date DATE NOT NULL,
  type TEXT NOT NULL,
  distance_miles FLOAT,
  elevation_gain_ft FLOAT,
  technical_grade TEXT,
  target_cardio_score INT NOT NULL,
  target_strength_score INT NOT NULL,
  target_climbing_score INT NOT NULL,
  target_flexibility_score INT NOT NULL,
  current_cardio_score INT DEFAULT 0,
  current_strength_score INT DEFAULT 0,
  current_climbing_score INT DEFAULT 0,
  current_flexibility_score INT DEFAULT 0,
  taglines JSONB NOT NULL DEFAULT '{}',
  relevance_profiles JSONB NOT NULL DEFAULT '{}',
  graduation_benchmarks JSONB NOT NULL DEFAULT '{}',
  matched_validated_id UUID REFERENCES validated_objectives(id),
  tier TEXT NOT NULL DEFAULT 'bronze',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own objectives" ON objectives
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own objectives" ON objectives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own objectives" ON objectives
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own objectives" ON objectives
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- ASSESSMENTS
-- ============================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ DEFAULT now(),
  cardio_score INT NOT NULL,
  strength_score INT NOT NULL,
  climbing_score INT NOT NULL,
  flexibility_score INT NOT NULL,
  raw_data JSONB
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their assessments" ON assessments
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SCORE_HISTORY
-- ============================================
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  week_ending DATE NOT NULL,
  cardio_score INT NOT NULL,
  strength_score INT NOT NULL,
  climbing_score INT NOT NULL,
  flexibility_score INT NOT NULL,
  change_reason TEXT NOT NULL,
  is_test_week BOOLEAN DEFAULT FALSE,
  confidence TEXT DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their score history" ON score_history
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRAINING_PLANS
-- ============================================
CREATE TABLE training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES assessments(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  plan_data JSONB NOT NULL DEFAULT '{}',
  graduation_workouts JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'active'
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their training plans" ON training_plans
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WEEKLY_TARGETS
-- ============================================
CREATE TABLE weekly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  week_start DATE NOT NULL,
  week_type TEXT NOT NULL,
  total_hours FLOAT,
  expected_scores JSONB NOT NULL DEFAULT '{}',
  sessions JSONB NOT NULL DEFAULT '[]'
);

ALTER TABLE weekly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read weekly targets via plan" ON weekly_targets
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM training_plans WHERE training_plans.id = weekly_targets.plan_id AND training_plans.user_id = auth.uid())
  );

CREATE POLICY "Users can manage weekly targets via plan" ON weekly_targets
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM training_plans WHERE training_plans.id = weekly_targets.plan_id AND training_plans.user_id = auth.uid())
  );

-- ============================================
-- WORKOUT_LOGS
-- ============================================
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL,
  dimension TEXT NOT NULL,
  duration_min INT,
  details JSONB,
  benchmark_results JSONB,
  completed_as_prescribed BOOLEAN DEFAULT FALSE,
  session_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their workout logs" ON workout_logs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- COMPONENT_FEEDBACK (validator only)
-- ============================================
CREATE TABLE component_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  component_text TEXT NOT NULL,
  component_type TEXT NOT NULL,
  vote TEXT NOT NULL,
  objective_type TEXT,
  objective_tags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE component_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Validators can manage component feedback" ON component_feedback
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_validator = true)
  );
