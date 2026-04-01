// Exercise demo data layer for Summit Planner
// Provides curated YouTube demo videos and fallback search URLs for exercises

// ============================================
// Types
// ============================================

export interface ExerciseDemo {
  youtubeId: string;
  title: string;
  channelName: string;
}

export interface ExerciseDemoResult {
  curated: ExerciseDemo | null;
  searchQuery: string;
  youtubeSearchUrl: string;
  googleSearchUrl: string;
}

// ============================================
// normalizeExerciseName
// ============================================

/**
 * Strips modifiers from AI-generated exercise names so they match the curated map.
 * Handles weight annotations, parenthetical content, rep/set patterns,
 * timing patterns, common prefixes, and verbose descriptors.
 */
export function normalizeExerciseName(name: string): string {
  let normalized = name.toLowerCase();

  // Remove parenthetical content: (slow eccentric), (7s on/3s off, half crimp)
  normalized = normalized.replace(/\([^)]*\)/g, '');

  // Remove weight patterns: @ 35lb, @35lb, 25kg, 10 lbs, 35 lb, 50lb
  normalized = normalized.replace(/@\s*\d+\s*(lb|lbs|kg|pounds?|kilos?)\b/gi, '');
  normalized = normalized.replace(/\b\d+\s*(lb|lbs|kg|pounds?|kilos?)\b/gi, '');

  // Remove rep/set patterns: 3x10, 3 sets, 20 reps, 5 x 8
  normalized = normalized.replace(/\b\d+\s*x\s*\d+\b/gi, '');
  normalized = normalized.replace(/\b\d+\s*(sets?|reps?)\b/gi, '');

  // Remove timing patterns: 7s on, 30 sec, 60s, 30 seconds
  normalized = normalized.replace(/\b\d+\s*s(ec|econds?)?\b/gi, '');
  normalized = normalized.replace(/\b\d+\s*min(utes?)?\b/gi, '');

  // Remove distance patterns: 5 miles, 2.5 mi, 400m, 800 meters
  normalized = normalized.replace(/\b\d+\.?\d*\s*(miles?|mi|meters?|m|km|kilometers?|ft|feet)\b/gi, '');

  // Remove common prefixes (as whole words)
  const prefixes = [
    'loaded',
    'weighted',
    'banded',
    'single-arm',
    'single-leg',
    'single arm',
    'single leg',
    'alternating',
    'bodyweight',
    'barbell',
    'dumbbell',
    'kettlebell',
    'cable',
    'resistance band',
  ];
  for (const prefix of prefixes) {
    normalized = normalized.replace(new RegExp(`\\b${prefix}\\b`, 'gi'), '');
  }

  // Remove "with {equipment}" patterns: with dumbbells, with a band, with pack
  normalized = normalized.replace(/\bwith\s+(a\s+)?(dumbbells?|barbell|kettlebells?|band|pack|backpack|weight|medicine ball|cable|plates?|chains?)\b/gi, '');
  // Clean up orphaned "with" left after weight stripping (e.g. "squats with 25lb" → weight stripped → "squats with")
  normalized = normalized.replace(/\bwith\s*$/gi, '');

  // Remove trailing descriptive phrases: "at your comfortable depth", "on each side",
  // "with good form", "at moderate pace", "for time", "each way", etc.
  normalized = normalized.replace(/\b(at\s+(your\s+)?(comfortable|moderate|easy|hard|max|full)\b.*)/gi, '');
  normalized = normalized.replace(/\b(on\s+each\s+side|each\s+(side|way|leg|arm)|per\s+(side|leg|arm))\b.*/gi, '');
  normalized = normalized.replace(/\b(with\s+(good|proper|strict|controlled)\s+form)\b.*/gi, '');
  normalized = normalized.replace(/\b(for\s+(time|distance|reps|max))\b.*/gi, '');

  // Collapse whitespace and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove leading/trailing hyphens or dashes left over
  normalized = normalized.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();

  return normalized;
}

// ============================================
// EXERCISE_DEMO_MAP — curated YouTube demos
// ============================================

/**
 * Curated map of normalized exercise names to YouTube demo videos.
 * ~108 entries with verified YouTube video IDs. Additional exercises
 * use the fallback search URLs when no curated match is found.
 *
 * Video IDs sourced via YouTube Data API v3 (April 2026).
 * Run `npx tsx scripts/search-youtube-retry.ts` to fill remaining entries.
 */
export const EXERCISE_DEMO_MAP: Record<string, ExerciseDemo> = {

  // ── Cardio ──
  'trail running': {
    youtubeId: 'l9K1nx7_FH8',
    title: '6 Off-Road Run Skills To Master | Trail Running Tips',
    channelName: 'Global Triathlon Network',
  },
  'zone 2 run': {
    youtubeId: 'uxRdWFSrPWg',
    title: 'Zone 2 Running: The Surprising Benefits of Low Heart Rate Training',
    channelName: 'Fitnessdy',
  },
  'rucking': {
    youtubeId: '9wV58My4WKY',
    title: 'Rucking 101: Intro to Weighted Walking',
    channelName: 'Jared Veldheer',
  },
  'uphill hike with pack': {
    youtubeId: 'KbguX9bQq4E',
    title: 'Do These 3 Things to Hike 20 Miles EASY // Training Tips for Hiking & Backpacking',
    channelName: 'Justin Outdoors',
  },
  'stair climbing': {
    youtubeId: '1hiWQ7pehjQ',
    title: 'Wellness Wednesday: Build your stair climbing power with step-ups',
    channelName: 'Mayo Clinic',
  },
  'stairmaster': {
    youtubeId: 'K0SWH1yMLhA',
    title: 'Here\'s Why You Need To Do The Stairmaster Every Day',
    channelName: 'Korin Sutton',
  },
  'incline treadmill walk': {
    youtubeId: 'NAsObfFJXvE',
    title: 'How To: Incline Treadmill Walk (12-3-30 Workout)',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'assault bike': {
    youtubeId: '6OMfabFyVFI',
    title: 'The Best Follow-Along Beginner Assault Bike Workout For Weight Loss',
    channelName: 'FrankWallFitness',
  },
  'rowing': {
    youtubeId: '4zWu1yuJ0_g',
    title: 'Correct Rowing Machine Technique, Improve Your Rowing | Concept2',
    channelName: 'concept2usa',
  },
  'hill sprints': {
    youtubeId: 'VzHQUh5jzsI',
    title: 'Hill Sprints Tutorial',
    channelName: 'TaylorMade Coaching & Events',
  },
  'jump rope': {
    youtubeId: 'vEJ7XbbAMAg',
    title: 'JUMP ROPE LIKE A PRO IN 2 MINUTES | LEARN HOW TO SKIP',
    channelName: 'Dayan Kole',
  },
  'ruck march': {
    youtubeId: '0Ce05sN3nfI',
    title: 'Tips to Crush your 12-Mile Ruck March',
    channelName: 'Gritty Soldier',
  },
  'trail hike': {
    youtubeId: '4EPRWNKSLv4',
    title: 'Hiking Prep Exercises for the Best Hike of Your Life',
    channelName: 'VENTfitness',
  },
  'zone 2 trail run': {
    youtubeId: 'zXETuMcPZ1c',
    title: 'How long it takes to benefit from zone 2 running',
    channelName: 'Shred Athletics',
  },
  'sustained zone 2 run': {
    youtubeId: 'uxRdWFSrPWg',
    title: 'Zone 2 Running: The Surprising Benefits of Low Heart Rate Training',
    channelName: 'Fitnessdy',
  },
  'uphill intervals': {
    youtubeId: 'MSEHaRHJnRU',
    title: 'How to run uphill properly',
    channelName: 'Mr.UltraRunner',
  },
  'stair intervals': {
    youtubeId: '2OwzD_UPL30',
    title: 'How To Do STAIRS HIIT SPRINTS | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'downhill running': {
    youtubeId: '_aMs6ebam5E',
    title: 'How To Run Downhill | Downhill Running Technique Explained',
    channelName: 'Global Triathlon Network',
  },
  'hiking with pack': {
    youtubeId: '0AiHNeIpuDc',
    title: 'How Hiking TRANSFORMS Your Body',
    channelName: 'Greenbelly',
  },
  'continuous run': {
    youtubeId: 'l9K1nx7_FH8',
    title: '6 Off-Road Run Skills To Master | Trail Running Tips',
    channelName: 'Global Triathlon Network',
  },

  // ── Lower Body Strength ──
  'step-ups': {
    youtubeId: 'WRqHvOWkWbU',
    title: 'Step Ups – Full Video Tutorial & Exercise Guide',
    channelName: 'Fit Father Project',
  },
  'loaded step-ups': {
    youtubeId: 'WRqHvOWkWbU',
    title: 'Step Ups \u2013 Full Video Tutorial & Exercise Guide',
    channelName: 'Fit Father Project',
  },
  'box step-ups': {
    youtubeId: 'YBJpnB7R_SE',
    title: 'Is Your Step-Up Box Too High? -- Full video in description',
    channelName: 'Mike Robertson',
  },
  'lunges': {
    youtubeId: 'QOVaHwm-Q6U',
    title: 'How to Do a Forward Lunge | Exercise Tutorial',
    channelName: 'Bowflex',
  },
  'walking lunges': {
    youtubeId: 'Pbmj6xPo-Hw',
    title: 'Walking Lunges Exercise Tutorial | Build Legendary Legs & Cardio',
    channelName: 'Buff Dudes Workouts',
  },
  'reverse lunges': {
    youtubeId: 'q0XgDzjvDMA',
    title: 'HOW TO REVERSE LUNGE for the booty',
    channelName: 'WORKOUT WITH GINA',
  },
  'forward lunges': {
    youtubeId: 'MxfTNXSFiYI',
    title: 'Forward Lunges Exercise Demonstration',
    channelName: 'MedStar Health',
  },
  'lateral lunges': {
    youtubeId: 'vwK7vZNQwUI',
    title: 'Lateral lunge - how to do it right.',
    channelName: 'Revival Performance Physical Therapy',
  },
  'bulgarian split squats': {
    youtubeId: 'hiLF_pF3EJM',
    title: 'Stop F*cking Up Bulgarian Split Squats (PROPER FORM!)',
    channelName: 'ATHLEAN-X',
  },
  'split squats': {
    youtubeId: 'o7yFuIR9XVU',
    title: 'Bulgarian Split Squats Made Easy (FORM FIX)',
    channelName: 'ATHLEAN-X',
  },
  'goblet squats': {
    youtubeId: '7-80HiXX1K8',
    title: 'Goblet Squat [How To]',
    channelName: 'Le Sweat',
  },
  'squats': {
    youtubeId: 'zJBLDJMJiDE',
    title: 'Deep Bodyweight Squat Tutorial - Form, Progressions, and Mobility',
    channelName: 'GMB Fitness',
  },
  'air squats': {
    youtubeId: 'gr0dj-5mfDU',
    title: 'How To Do Air Squats | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'deep squat': {
    youtubeId: 'IHApHfNA2Ag',
    title: 'How to Do a Deep Squat According to Physical Therapists',
    channelName: 'Hinge Health',
  },
  'deep squat hold': {
    youtubeId: 'zJBLDJMJiDE',
    title: 'Deep Bodyweight Squat Tutorial - Form, Progressions, and Mobility',
    channelName: 'GMB Fitness',
  },
  'deadlifts': {
    youtubeId: 'op9kVnSso6Q',
    title: 'How To Deadlift: Starting Strength 5 Step Deadlift',
    channelName: 'Alan Thrall',
  },
  'romanian deadlifts': {
    youtubeId: 'ZEnWV4kguKc',
    title: 'How to do romanian deadlifts safely',
    channelName: 'Jack Hanrahan Fitness',
  },
  'leg blasters': {
    youtubeId: 'e8BxRX4Prks',
    title: 'Leg Blaster: Exercise Demo',
    channelName: 'Mountain Tactical Institute',
  },
  'box step-downs': {
    youtubeId: 'elhu-WC1qk4',
    title: 'Proper Step Ups/Downs',
    channelName: '[P]rehab',
  },
  'step-downs': {
    youtubeId: 'z87nPg4ac0o',
    title: 'Do you know HOW to do STEP DOWNS properly? | Knee Strengthening',
    channelName: 'PhysioCore and Sports Rehab',
  },
  'calf raises': {
    youtubeId: 'CtyIVeJH6lI',
    title: 'You\'re Doing Calf Raises WRONG | The Correct Way Taught By Physical Therapist',
    channelName: 'Rehab and Revive',
  },
  'glute bridges': {
    youtubeId: 'X_IGw8U_e38',
    title: 'How to do Glute Bridges with Perfect Form',
    channelName: 'WeShape',
  },
  'hip thrusts': {
    youtubeId: '4z_2oHvIvkA',
    title: 'How To Perform Hip Thrusts | An Advanced Glute Bridge Progression',
    channelName: 'Dr. Carl Baird',
  },
  'wall sits': {
    youtubeId: 'mDdLC-yKudY',
    title: 'How to do a wall sit',
    channelName: 'YOGABODY',
  },
  'cossack squats': {
    youtubeId: 'tpczTeSkHz0',
    title: 'How to Cossack Squat Mobility Exercise: Tutorial & Progressions',
    channelName: 'FitnessFAQs',
  },
  'pack squats': {
    youtubeId: 'zJBLDJMJiDE',
    title: 'Deep Bodyweight Squat Tutorial - Form, Progressions, and Mobility',
    channelName: 'GMB Fitness',
  },
  'lunge matrix': {
    youtubeId: 'Rb037Z4-6bc',
    title: 'THIS WORKOUT IS INSANE!! The Ultimate Lunge Matrix | Ed Paget',
    channelName: 'Ed Paget',
  },
  'spider-man lunges': {
    youtubeId: 'ckXVmoFDTWY',
    title: 'How to Spider-Man Lunge',
    channelName: 'BearCub PE',
  },
  'step-through lunges': {
    youtubeId: '6vlFqoFHzq0',
    title: 'Step-through Lunge',
    channelName: 'BCI Sports Performance and Fitness',
  },
  'lateral step-downs': {
    youtubeId: 'p9gk09YZRL0',
    title: 'Lateral Step Down | Conquer Movement Physical Therapy',
    channelName: 'Conquer Movement PT',
  },
  'monster walks': {
    youtubeId: 'Iw0qNhH95SU',
    title: 'How to Perform: Monster Walks & Squats',
    channelName: 'Orthopedic Institute',
  },

  // ── Upper Body Strength ──
  'pull-ups': {
    youtubeId: 'eGo4IYlbE5g',
    title: 'The Perfect Pull Up - Do It Right!',
    channelName: 'Calisthenicmovement',
  },
  'weighted pull-ups': {
    youtubeId: 'c11yAY7r3io',
    title: 'Get strong w/ Weighted Pull-ups',
    channelName: 'Mark Moser',
  },
  'band-assisted pull-ups': {
    youtubeId: 'KqS6SFZCrjY',
    title: 'How To Do A RESISTANCE BAND ASSISTED PULL UP | Exercise Demonstration',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'scapular pull-ups': {
    youtubeId: 'K3NHuFdO5Zs',
    title: 'Scapular Pull-Ups',
    channelName: '802 CrossFit',
  },
  'push-ups': {
    youtubeId: 'IODxDxX7oi4',
    title: 'The Perfect Push Up - Do It Right!',
    channelName: 'Calisthenicmovement',
  },
  'rows': {
    youtubeId: 'gfUg6qWohTk',
    title: 'STOP F*cking Up Dumbbell Rows (PROPER FORM!)',
    channelName: 'ATHLEAN-X',
  },
  'overhead press': {
    youtubeId: 'zoN5EH50Dro',
    title: 'Perfect Overhead Press Form (DO THIS!)',
    channelName: 'Andrew Kwong (DeltaBolic)',
  },
  'shoulder press': {
    youtubeId: 'B-aVuyhvLHU',
    title: 'How to Do a Dumbbell Shoulder Press',
    channelName: 'LIVESTRONG',
  },
  'farmer carries': {
    youtubeId: 'wXAEzVknXP4',
    title: 'Farmer Carry Demonstration',
    channelName: 'Jonathan Jordan Fitness',
  },
  'farmer carry': {
    youtubeId: 'z7E_YU9P1jU',
    title: 'How to Perform the Farmer\'s Carry',
    channelName: 'Dr. Carl Baird',
  },
  'suitcase carries': {
    youtubeId: 'v8O0kNuvp_k',
    title: 'The most underrated core / ab exercise - How to suitcase carry',
    channelName: 'Rosati Strength Systems',
  },
  'turkish get-ups': {
    youtubeId: '0bWRPC49-KI',
    title: 'Kettlebell Turkish Get Up Tutorial',
    channelName: 'Mark Wildman',
  },
  'push-up max set': {
    youtubeId: 'f9sxuHGQARc',
    title: 'How to MAX your Push-ups | SFAS, APFT, ACFT, Ranger School',
    channelName: 'Gritty Soldier',
  },
  'dips': {
    youtubeId: 'yN6Q1UI_xkE',
    title: 'How To Do Dips For A Bigger Chest and Shoulders (Fix Mistakes!)',
    channelName: 'Jeff Nippard',
  },
  'inverted rows': {
    youtubeId: 'iPbAldlORHE',
    title: 'Know the difference australian pull up / Bodyweight Row / inverted rows',
    channelName: 'Ninja Fit',
  },
  'loaded carry': {
    youtubeId: 'tu-J4lMT0ms',
    title: '4 Loaded Carry Variations for Beginners - Exercise Tutorial',
    channelName: 'Chloe Hamard',
  },
  'pack carry': {
    youtubeId: 'tu-J4lMT0ms',
    title: '4 Loaded Carry Variations for Beginners - Exercise Tutorial',
    channelName: 'Chloe Hamard',
  },
  'negatives': {
    youtubeId: 'Sjm8vKAgVI8',
    title: 'How To Do PULL UP NEGATIVES | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'pull-up progression': {
    youtubeId: 'mTJHClMQPM8',
    title: 'How to One Arm Pull-Up Tutorial (BEST PROGRESSIONS)',
    channelName: 'FitnessFAQs',
  },
  'dead hangs': {
    youtubeId: 'tBfMpPFzCls',
    title: 'Dead Hang - Benefits, How To, Progressions',
    channelName: 'Hybrid Calisthenics',
  },
  'lateral band walks': {
    youtubeId: '6eoK_yxY8Ak',
    title: 'Lateral band walks | Ohio State Sports Medicine',
    channelName: 'Ohio State Wexner Medical Center',
  },

  // ── Core ──
  'planks': {
    youtubeId: 'ASdvN_XEl_c',
    title: 'How To Plank Properly - Form, Mistakes, and Progressions',
    channelName: 'Jeff Nippard',
  },
  'side planks': {
    youtubeId: 'sKMD_pbNm7w',
    title: 'How not to side plank and how to do the side plank!',
    channelName: 'brockashby',
  },
  'plank with shoulder taps': {
    youtubeId: 'gKA5LBy7WAI',
    title: 'How To Properly Do a Plank with Shoulder Taps',
    channelName: 'Wellen',
  },
  'hollow body holds': {
    youtubeId: 'Xk-JcNj6lfY',
    title: 'How To: Hollow Body Hold',
    channelName: 'Forty Steps',
  },
  'hollow hold': {
    youtubeId: 'Mjeur54Z0wI',
    title: 'The Hollow Hold: Extremely effective for building iron core strength',
    channelName: 'Brent Lee Hill',
  },
  'hanging leg raises': {
    youtubeId: 'Pr1ieGZ5atk',
    title: 'Hanging Leg Raise | HOW-TO',
    channelName: 'ATHLEAN-X',
  },
  'hanging knee raises': {
    youtubeId: 'dPwg1E_ygjc',
    title: 'How To Do HANGING KNEE RAISES | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'ab wheel rollouts': {
    youtubeId: 'vncVOEtMhpk',
    title: 'How to do an Ab Wheel Rollout Correctly | DOs and DON\'Ts',
    channelName: 'Criticalbench',
  },
  'l-sit holds': {
    youtubeId: 'PG8Z--JgcHc',
    title: 'L-Sit TUTORIAL',
    channelName: 'Vitaly Pavlenko',
  },
  'toe-to-bar': {
    youtubeId: 'v6dgseykbLI',
    title: 'How To Toes To Bar',
    channelName: 'THENX',
  },
  'windshield wipers': {
    youtubeId: 'iMCPilvoNYw',
    title: 'How to do Windshield Wipers or build your Core',
    channelName: 'Brandon Scott Partin',
  },
  'dead bugs': {
    youtubeId: 'fzVzaIWOZUQ',
    title: 'How to do deadbugs properly (Fix that pelvic tilt)',
    channelName: 'Aizah Fit',
  },
  'bird-dogs': {
    youtubeId: '_1j_HWknGLg',
    title: 'How to Do a Proper Bird Dog',
    channelName: 'AARP Answers',
  },
  'superman holds': {
    youtubeId: 'LZoWdePF1NQ',
    title: 'How To Do A SUPERMAN HOLD | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'mountain climbers': {
    youtubeId: 'hZb6jTbCLeE',
    title: 'How to Do Mountain Climbers - Fitness Fridays',
    channelName: 'Duke Health',
  },
  'front lever progressions': {
    youtubeId: 'AGhb8V8M758',
    title: 'Front Lever for Beginners (ALL PROGRESSIONS)',
    channelName: 'FitnessFAQs',
  },
  'prone extension': {
    youtubeId: 'LZoWdePF1NQ',
    title: 'How To Do A SUPERMAN HOLD | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'russian twists': {
    youtubeId: '-BzNffL_6YE',
    title: 'STOP Doing Russian Twists Like This! (SAVE A FRIEND)',
    channelName: 'ATHLEAN-X',
  },
  'v-ups': {
    youtubeId: 'zDkDAET3GUA',
    title: 'V-Ups: How to do them and how not to do them',
    channelName: 'Brent Lee Hill',
  },
  'pallof press': {
    youtubeId: 'HXrLaqNIkTs',
    title: 'How To Do A Pallof Press',
    channelName: 'PureGym',
  },

  // ── Prehab & Antagonist ──
  'face pulls': {
    youtubeId: '8686PLZB_1Q',
    title: 'STOP Doing Face Pulls Like This! (I\'M BEGGING YOU)',
    channelName: 'ATHLEAN-X',
  },
  'band pull-aparts': {
    youtubeId: 'stwYTTPXubo',
    title: 'How To Do Banded Pull-Aparts',
    channelName: 'Tangelo - Seattle Chiropractor + Rehab',
  },
  'rotator cuff band work': {
    youtubeId: 'uWrzNoHkzO8',
    title: 'Strengthen your Rotator Cuff properly with these banded exercises',
    channelName: 'The Physio Bros',
  },
  'reverse wrist curls': {
    youtubeId: 'krZ6pWGZ8xo',
    title: 'How to Do Dumbbell Reverse Wrist Curls',
    channelName: 'LIVESTRONG',
  },
  'rice bucket forearm work': {
    youtubeId: 'aS8wwOc0MI8',
    title: 'Rice bucket grip training is awesome',
    channelName: 'Hybrid Calisthenics',
  },
  'shoulder i/y/t band': {
    youtubeId: 'tNI6K4SbL8M',
    title: 'Shoulder IYTs - Resistance Band Exercise Tutorials',
    channelName: 'Simple Simon\'s Education',
  },
  'band shoulder dislocates': {
    youtubeId: 'a9rqTzZaI7s',
    title: 'Band Shoulder Dislocates',
    channelName: 'STRONG ATHLETE',
  },
  'band external rotations': {
    youtubeId: 'dS9ORQCnWsE',
    title: 'Shoulder External Rotation with Resistance Band',
    channelName: 'Gear Up Physical Therapy and Wellness',
  },
  'wrist curls': {
    youtubeId: '7ac_qmBjkFI',
    title: 'How to Do Dumbbell Wrist Curls',
    channelName: 'LIVESTRONG',
  },
  'forearm roller': {
    youtubeId: '6RdDG3VluQw',
    title: 'Windlass Wrist and Forearm Roller - Exercise Demo',
    channelName: 'Pike Fitness',
  },
  'shoulder circles': {
    youtubeId: 'KmherMbhPco',
    title: 'Wall Shoulder Circles',
    channelName: 'IKON Fitness',
  },
  'side-lying hip abductions': {
    youtubeId: 'g9FtnmsIYgI',
    title: 'Side Lying Hip Abduction',
    channelName: 'Baptist Health',
  },

  // ── Climbing — Gym ──
  'limit bouldering': {
    youtubeId: 'h17ETPScOWw',
    title: 'How to LIMIT BOULDER to get STRONGER at Climbing',
    channelName: 'Bouldering Bobat',
  },
  'volume bouldering': {
    youtubeId: 'KBN9MrzXu0U',
    title: 'How To Avoid The \'Intermediate Climber\' Plateau',
    channelName: 'Lattice Training',
  },
  'campus board laddering': {
    youtubeId: 'bLz0xp1PEm4',
    title: 'Improved your Climbing with This Exercise? Campus Training Explained',
    channelName: 'Lattice Training',
  },
  'hangboard repeaters': {
    youtubeId: 'S498uFV0Hg0',
    title: 'Hangboarding vs. Lifting for FINGER strength?',
    channelName: 'Lattice Training',
  },
  'hangboard dead hangs': {
    youtubeId: 'dOCQjaasbGs',
    title: 'How To Dead Hang Correctly',
    channelName: 'FitnessFAQs',
  },
  'lock-offs': {
    youtubeId: '01JeDiovfTs',
    title: 'Lock Offs 3 Versions | Climbing Technique & Strength Training',
    channelName: 'Mercedes Pollmeier of Modus Athletica',
  },
  'one-arm hang progressions': {
    youtubeId: '15svY4rDixQ',
    title: 'POV: The Complete Tutorial on How To Single Arm Dead Hang (4 Drills)',
    channelName: 'Major Calisthenics',
  },
  'linked boulder circuits': {
    youtubeId: 'Y6BxtLXfAFI',
    title: 'Try this Exercise! Power Endurance Training for Climbing',
    channelName: 'Lattice Training',
  },
  'top-rope climbing': {
    youtubeId: 'w5ZT9M9m_2Y',
    title: 'How to Use Proper Top-Rope Belay Method | Rock Climbing',
    channelName: 'Howcast',
  },

  // ── Climbing — Outdoor & Trad ──
  'crack climbing technique': {
    youtubeId: 'B3xHMkcOAVc',
    title: 'Crack Climbing Training: How To Train With No Cracks!',
    channelName: 'Lattice Training',
  },
  'hand crack climbing': {
    youtubeId: 'B3xHMkcOAVc',
    title: 'Crack Climbing Training: How To Train With No Cracks!',
    channelName: 'Lattice Training',
  },
  'finger crack climbing': {
    youtubeId: 'B3xHMkcOAVc',
    title: 'Crack Climbing Training: How To Train With No Cracks!',
    channelName: 'Lattice Training',
  },
  'fist crack climbing': {
    youtubeId: 'NH6V7jWknaM',
    title: 'HOW TO CRACK CLIMB - WIDE BOYZ | #152',
    channelName: 'Magnus Midtb\u00f8',
  },
  'off-width climbing': {
    youtubeId: 'rv_CnoIdo_s',
    title: 'Crack Climbing: Intro To Offwidth Technique',
    channelName: 'VIDEORACLES',
  },
  'anchor building': {
    youtubeId: 'bZ5FNPH8dj4',
    title: 'Multi Pitch Rock Anchor Building Exercise',
    channelName: 'Smile Mountain Guides',
  },
  'route reading': {
    youtubeId: 'XnScNp24xEU',
    title: 'Route Reading 101 || How to with Louis Parkinson',
    channelName: 'Catalyst Climbing',
  },
  'mock leading on top rope': {
    youtubeId: 'wW5sB-vEqX4',
    title: 'How to Pass Your Lead Climbing Test',
    channelName: 'Summit Seekers Experience',
  },
  'outdoor sport lead volume': {
    youtubeId: 's9xFZ1epi2U',
    title: 'Climbing\'s Most MISUNDERSTOOD Training Method',
    channelName: 'Lattice Training',
  },

  // ── Alpine & Mountaineering Skills ──
  'ice axe self-arrest': {
    youtubeId: 'VeTRjTx2CLw',
    title: 'How Do You Master Ice Axe Self-arrest Technique? - The Hiker\'s Advice',
    channelName: 'The Hiker\'s Advice',
  },
  'self-arrest practice': {
    youtubeId: 'VeTRjTx2CLw',
    title: 'How Do You Master Ice Axe Self-arrest Technique? - The Hiker\'s Advice',
    channelName: 'The Hiker\'s Advice',
  },
  'crampon walking flat-footing': {
    youtubeId: '-PINlvXRTLU',
    title: 'Technical Mountaineering Boots & Crampons',
    channelName: 'Ethan Heinrichs',
  },
  'crevasse rescue hauling systems': {
    youtubeId: 'bDcUnocXhpw',
    title: 'How to Transfer a Fallen Climber\'s Weight to a Snow Anchor for Crevasse Rescue',
    channelName: 'Outdoor Research',
  },
  'rope team travel': {
    youtubeId: 'QwBOLjin67U',
    title: 'How to Rope Up for Glacier Travel',
    channelName: 'Outdoor Research',
  },

  // ── Flexibility & Mobility ──
  'hip flexor stretches': {
    youtubeId: 'UGEpQ1BRx-4',
    title: 'The Best Hip Flexor Stretch You Are Not Doing',
    channelName: 'Tom Merrick',
  },
  'pigeon pose': {
    youtubeId: 'FVaJSCuYiNM',
    title: 'Pigeon Pose - Yoga With Adriene',
    channelName: 'Yoga With Adriene',
  },
  'deep lunge holds': {
    youtubeId: 'o5V0vL1sN9s',
    title: 'Exercise Tutorial - How to - Mobility Workout - Hip Stretch - Deep Lunge Hold',
    channelName: 'Conan Sandberg - Sandbox Fitness',
  },
  'hamstring stretches': {
    youtubeId: 'ymqO4VpxlUk',
    title: 'Fix Your Tight Hamstrings - 10 Minute Hamstring Stretches!',
    channelName: 'Jessica Valant',
  },
  'thoracic spine rotation': {
    youtubeId: 'l3Ze_9iXL-M',
    title: 'All-4s Thoracic Spine Rotations',
    channelName: 'Daily Workout Builder',
  },
  'ankle dorsiflexion wall test': {
    youtubeId: 'Clutk_VsgUY',
    title: 'How To Do The KNEE TO WALL ANKLE DORSIFLEXION TEST | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'ankle circles': {
    youtubeId: '9tFDZqo-X3o',
    title: 'Exercise of the Day: Ankle Circles',
    channelName: 'Feel Good Life with Coach Todd',
  },
  'ankle mobility drills': {
    youtubeId: 'apCIhoPmHW8',
    title: 'Exercises for Ankle Mobility and Foot Strength (Part 1)',
    channelName: 'GMB Fitness / Praxis',
  },
  'yoga flows': {
    youtubeId: 'lMWOrDH694c',
    title: 'Yoga For Weight Loss | Healthy Energy Flow | Yoga With Adriene',
    channelName: 'Yoga With Adriene',
  },
  'foam rolling': {
    youtubeId: 'y9CDXyjjFNI',
    title: 'Full-Body Foam Rolling Exercises | A Complete Guide',
    channelName: 'PT Time with Tim',
  },
  'worlds greatest stretch': {
    youtubeId: '-CiWQ2IvY34',
    title: 'The World\'s Greatest Stretch (Mobility Exercise) by Squat University',
    channelName: 'Squat University',
  },
  'cat-cow stretch': {
    youtubeId: 'fcnv4gyMzf8',
    title: 'How to perform a cat cow stretch for back pain',
    channelName: 'London Back Pain Clinic',
  },
  'inchworms': {
    youtubeId: 'PWX8tVMI87I',
    title: 'How to do Inchworms - Inferno Hot Pilates Exercise Tutorial',
    channelName: 'Hometown Sweat',
  },
  'leg swings': {
    youtubeId: '3l31E2cMGMk',
    title: 'Leg Swings - Dynamic Warm Up',
    channelName: 'Sports Rehab Expert',
  },
  'hip circles': {
    youtubeId: 'PZFKu9583Ms',
    title: 'Hip Circles',
    channelName: 'JSWFitness Personal Training',
  },
  'hip openers': {
    youtubeId: 'GffXQl3zvUI',
    title: 'Hip Mobility - Open Your Hips - 13 Min Yoga Practice',
    channelName: 'Yoga With Adriene',
  },
  'quadruped rockbacks': {
    youtubeId: 'z5gBP2gg3ik',
    title: 'How To Improve Knee Mobility | Quadruped Rockback',
    channelName: 'Barbell Physical Therapy and Performance',
  },
  'thread the needle': {
    youtubeId: 'oAQ_qycUj5o',
    title: 'How To Do THREAD THE NEEDLE | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'figure-4 stretch': {
    youtubeId: 'ckHZyA99Das',
    title: 'Figure-4 Stretch',
    channelName: 'Daily Workout Builder',
  },
  'lunge with twist': {
    youtubeId: 'ljwP0CevKRQ',
    title: 'Lunge with Twist - Dynamic Warm Up',
    channelName: 'Spire Injury Clinic',
  },
  'standing toe touch': {
    youtubeId: 'rUnF05SC60A',
    title: 'Tips on conquering the standing toe touch',
    channelName: 'Pivotal Physiotherapy',
  },
  'hip airplanes': {
    youtubeId: 'zTPIvMcNcVg',
    title: 'Standing Hip Mobility: How to do Hip Airplanes',
    channelName: 'Flexible Strength',
  },
  'knee hugs': {
    youtubeId: 'ovgnoeaaZRI',
    title: 'How To Do STANDING KNEE HUGS | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'calf stretch': {
    youtubeId: '7SO6QzfBRaE',
    title: 'Standing Calf Stretch Technique #shorts',
    channelName: 'Doctor O\'Donovan',
  },
  'it band foam rolling': {
    youtubeId: 'Sr9RWVMzyi8',
    title: 'IT Band Foam Rolling Exercises',
    channelName: 'Knewtson Health Group',
  },

  // ── Warm-Up Drills ──
  'high knees': {
    youtubeId: 'd9kQK5Ds0wo',
    title: 'How To Do The High Knees Drill For Runners #running #tips #shorts',
    channelName: 'Chari Hawkins',
  },
  'butt kicks': {
    youtubeId: 'sCqwutevC7o',
    title: 'How to do butt kicks the correct way! #shorts',
    channelName: 'Chari Hawkins',
  },
  'arm swings': {
    youtubeId: 'XTbPqeswd-Y',
    title: 'Warm Up - Arm Swings',
    channelName: 'The Strength Effect',
  },
  'jumping jacks': {
    youtubeId: '6zi5Olw5BYQ',
    title: 'How To Do JUMPING JACKS | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'a-skips': {
    youtubeId: '0fz4tO3IDzU',
    title: 'How To A Skip | Chari Hawkins',
    channelName: 'Chari Hawkins',
  },
  'strides': {
    youtubeId: '1i2ZPpXtuOk',
    title: 'How To Run Strides And How They Make You Faster',
    channelName: 'The Run Experience',
  },
  'dynamic warm-up': {
    youtubeId: 'xf1oAmqugkk',
    title: 'Simple Dynamic Warm-Up (10 Exercises)',
    channelName: 'Upper 90 Football',
  },
  'walking knee lifts': {
    youtubeId: 's2emWIC58bI',
    title: 'How To Do WALKING KNEE HUGS | Exercise Demonstration Video and Guide',
    channelName: 'Live Lean TV Daily Exercises',
  },
  'heel walks': {
    youtubeId: 'h4V7X5ZDnU0',
    title: 'Heel Walks',
    channelName: 'Therapeutic Associates Physical Therapy',
  },
  'toe walks': {
    youtubeId: '2djYTirXUj4',
    title: 'Toe Walk',
    channelName: 'Hope Physical Therapy and Aquatics',
  },
  'inchworm walkouts': {
    youtubeId: 'oSTTiPblENY',
    title: 'Inchworm Walkout',
    channelName: 'Todd Norman',
  },
  'lateral shuffles': {
    youtubeId: 'mziPKITnPeQ',
    title: 'How To Do a Lateral Shuffle',
    channelName: 'Get Healthy U - with Chris Freytag',
  },
};

// ============================================
// lookupExerciseDemo
// ============================================

/**
 * Looks up a curated exercise demo video by name, with fuzzy matching.
 * Always returns search URLs as fallbacks even if no curated match is found.
 */
export function lookupExerciseDemo(exerciseName: string): ExerciseDemoResult {
  const normalized = normalizeExerciseName(exerciseName);
  const mapKeys = Object.keys(EXERCISE_DEMO_MAP);

  let curated: ExerciseDemo | null = null;

  // 1. Exact match
  if (EXERCISE_DEMO_MAP[normalized]) {
    curated = EXERCISE_DEMO_MAP[normalized];
  }

  // 2. Starts-with match (either direction)
  if (!curated) {
    for (const key of mapKeys) {
      if (key.startsWith(normalized) || normalized.startsWith(key)) {
        curated = EXERCISE_DEMO_MAP[key];
        break;
      }
    }
  }

  // 3. Contains match (either direction)
  if (!curated) {
    for (const key of mapKeys) {
      if (key.includes(normalized) || normalized.includes(key)) {
        curated = EXERCISE_DEMO_MAP[key];
        break;
      }
    }
  }

  // Build fallback search URLs
  const searchQuery = `${exerciseName} exercise demonstration`;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
  const googleSearchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(searchQuery)}`;

  return {
    curated,
    searchQuery,
    youtubeSearchUrl,
    googleSearchUrl,
  };
}
