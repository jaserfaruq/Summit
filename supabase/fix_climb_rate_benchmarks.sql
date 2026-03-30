-- Fix impossible climb rate targets in validated_objectives graduation benchmarks
-- (Uphill Hike with Pack measures hourly climb rate, not total route elevation)
-- Run this in Supabase SQL Editor

-- Rainier: 11,700 ft/hr → 2,500 ft/hr (cardio index 0)
UPDATE validated_objectives
SET graduation_benchmarks = jsonb_set(
  graduation_benchmarks,
  '{cardio,0}',
  '{"exerciseId": "b1000000-0000-0000-0000-000000000003", "exerciseName": "Uphill Hike with Pack", "graduationTarget": "2500 ft gain in 60 min @ 45lb pack", "whyThisTarget": "Rainier''s steep sections demand ~2,000 ft/hr with heavy pack; overshoot to 2,500 ft/hr for comfort margin."}'
)
WHERE name = 'Mt. Rainier (Disappointment Cleaver)';

-- Colorado 14er Class 1-2: 4,550 ft/hr → 2,000 ft/hr (cardio index 1)
UPDATE validated_objectives
SET graduation_benchmarks = jsonb_set(
  graduation_benchmarks,
  '{cardio,1}',
  '{"exerciseId": "b1000000-0000-0000-0000-000000000003", "exerciseName": "Uphill Hike with Pack", "graduationTarget": "2000 ft gain in 60 minutes with 25lb pack", "whyThisTarget": "Standard 14er pace is ~1,500 ft/hr; overshoot to 2,000 ft/hr ensures comfortable sustained climbing at altitude."}'
)
WHERE name = 'Colorado 14er Class 1-2';

-- Cathedral Peak: 3,650 ft/hr → 2,500 ft/hr (cardio index 1)
UPDATE validated_objectives
SET graduation_benchmarks = jsonb_set(
  graduation_benchmarks,
  '{cardio,1}',
  '{"exerciseId": "b1000000-0000-0000-0000-000000000003", "exerciseName": "Uphill Hike with Pack", "graduationTarget": "2500 ft gain in 60 minutes with 15lb pack", "whyThisTarget": "Cathedral''s approach demands steady uphill pace; 2,500 ft/hr with light pack ensures comfortable movement to the base."}'
)
WHERE name = 'Cathedral Peak (SE Buttress)';

-- Trail Half Marathon: 5,200 ft/hr → 2,500 ft/hr (cardio index 1)
UPDATE validated_objectives
SET graduation_benchmarks = jsonb_set(
  graduation_benchmarks,
  '{cardio,1}',
  '{"exerciseId": "b1000000-0000-0000-0000-000000000003", "exerciseName": "Uphill Hike with Pack", "graduationTarget": "2500 ft gain in 60 minutes unloaded", "whyThisTarget": "Trail runners power-hike uphills at ~2,000 ft/hr; 2,500 ft/hr unloaded ensures strong climbing legs on race day."}'
)
WHERE name = 'Trail Half Marathon';

-- 50K Ultra: 3,000+ ft/hr → 2,500 ft/hr (cardio index 1)
UPDATE validated_objectives
SET graduation_benchmarks = jsonb_set(
  graduation_benchmarks,
  '{cardio,1}',
  '{"exerciseId": "b1000000-0000-0000-0000-000000000003", "exerciseName": "Uphill Hike with Pack", "graduationTarget": "2500 ft gain in 60 minutes unloaded", "whyThisTarget": "Ultra runners need sustained uphill capacity; 2,500 ft/hr unloaded builds power-hiking fitness for 12,000+ ft of race climbing."}'
)
WHERE name = '50K Mountain Ultra';
