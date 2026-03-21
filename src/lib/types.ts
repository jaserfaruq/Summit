// Summit Planner — TypeScript types matching the database schema

export interface Profile {
  id: string;
  name: string | null;
  location: string | null;
  training_days_per_week: number;
  equipment_access: string[] | null;
  is_validator: boolean;
  created_at: string;
}

export interface ValidatedObjective {
  id: string;
  name: string;
  route: string;
  match_aliases: string[];
  type: ObjectiveType;
  difficulty: Difficulty;
  description: string | null;
  summit_elevation_ft: number | null;
  total_gain_ft: number | null;
  distance_miles: number | null;
  duration_days: number | null;
  technical_grade: string | null;
  tags: string[];
  target_scores: DimensionScores;
  taglines: DimensionTaglines;
  relevance_profiles: DimensionRelevanceProfiles;
  graduation_benchmarks: DimensionGraduationBenchmarks;
  recommended_weeks: number | null;
  created_by: string | null;
  last_reviewed: string | null;
  status: 'active' | 'draft' | 'retired';
}

export interface BenchmarkExercise {
  id: string;
  name: string;
  description: string;
  dimension: Dimension;
  tags: string[];
  equipment_required: string[] | null;
  is_gym_reproducible: boolean;
  difficulty_scale: Record<string, string> | null;
  measurement_type: MeasurementType;
  measurement_unit: string | null;
  created_by: string | null;
  status: 'active' | 'retired';
}

export interface Objective {
  id: string;
  user_id: string;
  name: string;
  target_date: string;
  type: ObjectiveType;
  distance_miles: number | null;
  elevation_gain_ft: number | null;
  technical_grade: string | null;
  target_cardio_score: number;
  target_strength_score: number;
  target_climbing_score: number;
  target_flexibility_score: number;
  current_cardio_score: number;
  current_strength_score: number;
  current_climbing_score: number;
  current_flexibility_score: number;
  taglines: DimensionTaglines;
  relevance_profiles: DimensionRelevanceProfiles;
  graduation_benchmarks: DimensionGraduationBenchmarks;
  matched_validated_id: string | null;
  tier: Tier;
  created_at: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  assessed_at: string;
  cardio_score: number;
  strength_score: number;
  climbing_score: number;
  flexibility_score: number;
  raw_data: AssessmentRawData | null;
}

export interface AssessmentRawData {
  cardio: {
    longest_zone2_distance_miles: number;
    longest_zone2_duration_min: number;
    weekly_cardio_hours: number;
  };
  strength: {
    pushup_reps: number;
    squat_reps_or_level: string;
  };
  climbing: {
    highest_grade: string;
    experience_level: string;
    exposure_comfort: number;
  };
  flexibility: {
    hip_tightness: number;
    ankle_mobility: number;
    regular_routine: boolean;
  };
}

export interface ScoreHistory {
  id: string;
  user_id: string;
  objective_id: string;
  week_ending: string;
  cardio_score: number;
  strength_score: number;
  climbing_score: number;
  flexibility_score: number;
  change_reason: ChangeReason;
  is_test_week: boolean;
  confidence: 'high' | 'low';
  created_at: string;
}

export interface TrainingPlan {
  id: string;
  user_id: string;
  objective_id: string;
  assessment_id: string | null;
  created_at: string;
  plan_data: PlanData;
  graduation_workouts: DimensionGraduationBenchmarks;
  status: 'active' | 'completed' | 'superseded';
  current_week_number: number;
}

export interface WeeklyTarget {
  id: string;
  plan_id: string;
  week_number: number;
  week_start: string;
  week_type: WeekType;
  total_hours: number | null;
  expected_scores: DimensionScores;
  sessions: PlanSession[];
}

export interface WorkoutLog {
  id: string;
  user_id: string;
  logged_date: string;
  dimension: Dimension;
  duration_min: number | null;
  details: Record<string, unknown> | null;
  benchmark_results: BenchmarkResult[] | null; // kept for backward compat, no longer used for scoring
  completed_as_prescribed: boolean;
  session_name: string | null;
  notes: string | null;
  week_number: number | null;
  plan_id: string | null;
  rating: WorkoutRating | null; // 1-5 self-rating
  created_at: string;
}

export interface ComponentFeedback {
  id: string;
  user_id: string;
  objective_id: string;
  dimension: Dimension;
  component_text: string;
  component_type: 'key' | 'irrelevant' | 'user_added';
  vote: 'up' | 'down';
  objective_type: string | null;
  objective_tags: string[] | null;
  created_at: string;
}

// ============================================
// Enums & shared types
// ============================================

export type Dimension = 'cardio' | 'strength' | 'climbing_technical' | 'flexibility';

export type ObjectiveType = 'hike' | 'trail_run' | 'alpine_climb' | 'rock_climb' | 'mountaineering' | 'scramble' | 'backpacking';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type MeasurementType = 'reps' | 'time' | 'distance' | 'pass_fail' | 'self_rated';

export type WeekType = 'regular';

export type Tier = 'gold' | 'silver' | 'bronze';

export type ChangeReason = 'assessment' | 'weekly_rating' | 'rebalance';

// 1-5 self-rating scale for workout difficulty
export type WorkoutRating = 1 | 2 | 3 | 4 | 5;

export interface SessionRating {
  sessionName: string;
  dimension: Dimension;
  rating: WorkoutRating;
}

// Rating multipliers: how much of expected weekly gain to apply
export const RATING_MULTIPLIERS: Record<WorkoutRating, number> = {
  1: 0,      // Way too hard — no progress
  2: 0.5,    // Struggled — half the expected gain
  3: 1.0,    // Just right — full expected gain
  4: 1.25,   // Slightly easy — 125% of expected gain
  5: 1.5,    // Way too easy — 150% of expected gain
};

export interface WeekCompletionFeedback {
  updatedScores: DimensionScores;
  expectedScores: DimensionScores;
  gaps: Record<Dimension, number>;
  summary: string;
  rebalanceRecommended: boolean;
}

export interface DimensionScores {
  cardio: number;
  strength: number;
  climbing_technical: number;
  flexibility: number;
}

export interface DimensionTaglines {
  cardio: string;
  strength: string;
  climbing_technical: string;
  flexibility: string;
}

export interface RelevanceProfile {
  summary: string;
  keyComponents: string[];
  irrelevantComponents: string[];
}

export interface DimensionRelevanceProfiles {
  cardio: RelevanceProfile;
  strength: RelevanceProfile;
  climbing_technical: RelevanceProfile;
  flexibility: RelevanceProfile;
}

export interface GraduationBenchmark {
  exerciseId: string;
  exerciseName: string;
  graduationTarget: string;
  whyThisTarget?: string;
}

export interface DimensionGraduationBenchmarks {
  cardio: GraduationBenchmark[];
  strength: GraduationBenchmark[];
  climbing_technical: GraduationBenchmark[];
  flexibility: GraduationBenchmark[];
}

export interface BenchmarkResult {
  exerciseId: string;
  result: number;
  graduationTarget: number;
  percentComplete: number;
}

// ============================================
// Plan data structures
// ============================================

export interface PlanData {
  planSummary: {
    philosophy: string;
    weeklyStructure: string;
    equipmentNeeded: string[];
    keyExercises: string[];
  };
  heroImageUrl?: string | null;
  weeks: PlanWeek[];
  difficultyAdjustments?: DifficultyAdjustment[];
}

export interface PlanWeek {
  weekNumber: number;
  weekStartDate: string;
  weekType: WeekType;
  totalHoursTarget: number;
  expectedScores: DimensionScores;
  sessions: PlanSession[];
}

export interface PlanSession {
  name: string;
  objective: string;
  estimatedMinutes: number;
  dimension: Dimension;
  isBenchmarkSession?: boolean; // deprecated, kept for backward compat
  warmUp: {
    rounds: number;
    warmUpMinutes?: number;
    exercises: { name: string; reps: string }[];
  };
  training: {
    exerciseNumber: number;
    description: string;
    details: string;
    durationMinutes?: number;
    isBenchmark?: boolean; // deprecated, kept for backward compat
    graduationTarget?: string | null; // deprecated, kept for backward compat
    intensityNote: string | null;
  }[];
  cooldown: string | null;
  cooldownMinutes?: number;
}

// ============================================
// API request/response types
// ============================================

export interface MatchObjectiveRequest {
  name: string;
  route?: string;
  type: ObjectiveType;
  details?: string;
}

export interface SuggestedObjective {
  name: string;
  route: string;
  type: ObjectiveType;
  description: string;
  difficulty: string;
  total_gain_ft: number | null;
  distance_miles: number | null;
  summit_elevation_ft: number | null;
  technical_grade: string | null;
}

export interface SearchMatch {
  validatedObjective?: ValidatedObjective;
  suggestedObjective?: SuggestedObjective;
  tier: 'gold' | 'silver';
  matchReason: string;
}

export interface MatchObjectiveResponse {
  tier: Tier;
  validatedObjective?: ValidatedObjective;
  anchors: ValidatedObjective[];
  matches?: SearchMatch[];
}

export interface EstimateScoresRequest {
  objectiveDetails: {
    name: string;
    route?: string;
    type: ObjectiveType;
    season?: string;
    duration?: string;
    elevation?: number;
    totalGain?: number;
    distance?: number;
    grade?: string;
    packWeight?: string;
    details?: string;
  };
  benchmarkExercises: BenchmarkExercise[];
  anchors: ValidatedObjective[];
  validatorFeedback?: ComponentFeedback[];
}

export interface EstimateScoresResponse {
  dimensions: {
    cardio: { tagline: string; targetScore: number };
    strength: { tagline: string; targetScore: number };
    climbing_technical: { tagline: string; targetScore: number };
    flexibility: { tagline: string; targetScore: number };
  };
  relevanceProfiles: DimensionRelevanceProfiles;
  graduationBenchmarks: DimensionGraduationBenchmarks;
}

export interface GeneratePlanRequest {
  userId: string;
  objectiveId: string;
  assessmentId: string;
}

export interface GeneratePlanResponse {
  planId: string;
  weekCount: number;
}

export interface CompleteWeekRequest {
  planId: string;
  weekNumber: number;
  ratings: SessionRating[];
}

export type CompleteWeekResponse = WeekCompletionFeedback;

export interface RebalanceRequest {
  planId: string;
  currentWeek: number;
}

// ============================================
// Difficulty adjustment types
// ============================================

export type DifficultyLevel = 'much_easier' | 'slightly_easier' | 'slightly_harder' | 'much_harder';

export const DIFFICULTY_SCALE_FACTORS: Record<DifficultyLevel, number> = {
  much_easier: 0.60,
  slightly_easier: 0.80,
  slightly_harder: 1.20,
  much_harder: 1.50,
};

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  much_easier: 'Much Easier',
  slightly_easier: 'Slightly Easier',
  slightly_harder: 'Slightly Harder',
  much_harder: 'Much Harder',
};

export interface AdjustDifficultyRequest {
  planId: string;
  level: DifficultyLevel;
}

export interface DifficultyAdjustment {
  timestamp: string;
  level: DifficultyLevel;
  scaleFactor: number;
  previousTargets: DimensionScores;
  newTargets: DimensionScores;
}

export interface FindRoutesRequest {
  location: string;
  targetDistance: number;
  targetElevation: number;
  preferences?: string;
}

export interface RouteRecommendation {
  name: string;
  location: string;
  distanceMiles: number;
  elevationGainFt: number;
  description: string;
  sourceUrl: string;
  whyItFits: string;
}
