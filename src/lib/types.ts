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
  climbing_role: 'lead' | 'follow' | null;
  matched_validated_id: string | null;
  tier: Tier;
  created_at: string;
}

export interface Assessment {
  id: string;
  user_id: string;
  objective_id: string | null;
  assessed_at: string;
  cardio_score: number;
  strength_score: number;
  climbing_score: number;
  flexibility_score: number;
  standard_answers: StandardAnswers | null;
  ai_questions: AIQuestion[] | null;
  ai_answers: Record<string, string | number> | null;
  freeform_text: string | null;
  ai_reasoning: AIReasoning | null;
  raw_data: AssessmentRawData | null;
}

export interface StandardAnswers {
  training_days_per_week: number;
  cardio_mode: 'uphill' | 'hike_run';
  // Uphill Push mode
  cardio_uphill_elevation_ft: number;
  cardio_uphill_duration_hours: number;
  cardio_uphill_pack_weight_lbs: number;  // 0 = no pack
  // Hike/Trail Run mode
  cardio_hike_distance_miles: number;
  cardio_hike_duration_hours: number;
  cardio_hike_elevation_ft: number;       // optional elevation context
  strength_training_frequency: string;
  strength_training_type: string;
  climbing_experience_level: string;
  climbing_highest_grade: string;
  climbing_skills: string[];
  flexibility_hip_tightness: number;
  flexibility_ankle_mobility: number;
  flexibility_regular_routine: boolean;
}

export interface AIQuestion {
  id: string;
  question: string;
  dimension: string;
  fieldType: 'text' | 'number' | 'dropdown' | 'scale';
  options?: string[];
}

export interface AIReasoning {
  cardio: { explanation: string; keyFactor: string };
  strength: { explanation: string; keyFactor: string };
  climbing_technical: { explanation: string; keyFactor: string };
  flexibility: { explanation: string; keyFactor: string };
}

export interface ProgrammingHints {
  cardio: { startingIntensity: string; sessionsPerWeek: number; keyAdaptation: string };
  strength: { startingIntensity: string; sessionsPerWeek: number; keyAdaptation: string };
  climbing_technical: { startingIntensity: string; sessionsPerWeek: number; keyAdaptation: string };
  flexibility: { startingIntensity: string; sessionsPerWeek: number; keyAdaptation: string };
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

export interface WeeklyReport {
  summary: string;
  scoreChanges: string;
  whereYouStand: string;
  nextWeekFocus: string;
  considerAdjusting: string | null;
  generatedAt: string;
  error?: boolean;
  message?: string;
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
  weekly_report: WeeklyReport | null;
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
  rating_comment: string | null; // required when rating != 3
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
  comment?: string;
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
  programmingHints?: ProgrammingHints | null;
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
  originalSession?: PlanSession;  // preserved original when alternative is active
  isAlternative?: boolean;        // true if this replaced the original
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

// ============================================
// Workout alternatives types
// ============================================

export interface GenerateAlternativesRequest {
  planId: string;
  weekNumber: number;
  sessionIndex: number;
}

export interface AlternativeSession extends PlanSession {
  durationDifference?: string;    // e.g., "+10 min" vs original
  alternativeRationale: string;   // 1-sentence why this alternative works
}

export interface GenerateAlternativesResponse {
  original: PlanSession;
  alternatives: AlternativeSession[];
}

export interface ReplaceSessionRequest {
  planId: string;
  weekNumber: number;
  sessionIndex: number;
  replacementSession: PlanSession;
}

// ============================================
// Training Partners types
// ============================================

export type PartnershipStatus = 'pending' | 'accepted' | 'declined';

export type SessionEnvironment = 'gym' | 'outdoor' | 'climbing_gym' | 'crag' | 'home';

export type MatchType = 'environment' | 'dimension' | 'both';

export interface Partnership {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: PartnershipStatus;
  requester_shares_scores: boolean;
  recipient_shares_scores: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerNotification {
  id: string;
  user_id: string;
  partner_id: string;
  partner_name: string;
  partnership_id: string;
  week_number: number;
  plan_id: string;
  partner_plan_id: string;
  match_type: MatchType;
  match_summary: string;
  matched_sessions: MatchResult[];
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface MatchResult {
  yourSessionIndex: number;
  yourSessionName: string;
  partnerSessionIndex: number;
  partnerSessionName: string;
  matchType: MatchType;
  matchReason: string;
}

export interface PartnerSession {
  name: string;
  dimension: Dimension;
  environment: SessionEnvironment;
  completed: boolean;
  sessionIndex: number;
  fullSession?: PlanSession;
}

export interface AcceptedPartner {
  partnershipId: string;
  partnerId: string;
  partnerName: string;
  objectiveName: string | null;
  weekLabel: string | null;
  scoresVisible: boolean;
  scores: DimensionScores | null;
  currentWeekSessions: PartnerSession[];
}

export interface PendingPartner {
  partnershipId: string;
  partnerName: string;
  direction: 'sent' | 'received';
}

export interface PartnerListResponse {
  accepted: AcceptedPartner[];
  pending: PendingPartner[];
}

export interface PartnerWeekResponse {
  partnerId: string;
  partnerName: string;
  objectiveName: string;
  weekNumber: number;
  totalWeeks: number;
  weekType: WeekType;
  sessions: PartnerSession[];
  scoresVisible: boolean;
  scores: DimensionScores | null;
  targetScores: DimensionScores | null;
  matches: MatchResult[];
}
