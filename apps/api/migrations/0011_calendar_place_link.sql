-- Link calendar events to saved map places
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

ALTER TABLE calendar_events
  ADD COLUMN place_id UUID REFERENCES places(id) ON DELETE SET NULL;
CREATE INDEX calendar_events_place_idx ON calendar_events(place_id) WHERE place_id IS NOT NULL;

COMMENT ON COLUMN calendar_events.place_id IS
  'Optional link to a saved map place ("Add from saved places" in the event editor). The API must verify the place belongs to the same couple before linking it -- the FK alone does not enforce that.';

COMMIT;
