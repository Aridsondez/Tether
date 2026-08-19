-- Shared relationship facts displayed in the About us area.
BEGIN;

ALTER TABLE relationship_profiles
  ADD COLUMN IF NOT EXISTS relationship_stage TEXT NOT NULL DEFAULT 'partners',
  ADD COLUMN IF NOT EXISTS met_on DATE;

ALTER TABLE relationship_profiles
  ADD CONSTRAINT relationship_profiles_stage_check
  CHECK (relationship_stage IN ('friends', 'together', 'not_together', 'partners', 'engaged', 'married'));

COMMIT;
