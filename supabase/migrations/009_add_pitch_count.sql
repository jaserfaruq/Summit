-- Add pitch_count to objectives and validated_objectives
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS pitch_count INT;
ALTER TABLE validated_objectives ADD COLUMN IF NOT EXISTS pitch_count INT;

-- Populate pitch_count for validated objectives with known multi-pitch routes
UPDATE validated_objectives SET pitch_count = 5 WHERE name ILIKE '%Grand Teton%';
UPDATE validated_objectives SET pitch_count = 6 WHERE name ILIKE '%Cathedral Peak%';
UPDATE validated_objectives SET pitch_count = 0 WHERE pitch_count IS NULL;
