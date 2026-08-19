-- Tether places schema
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'restaurant', 'bar', 'coffee_shop', 'hotel', 'park', 'store',
    'activity', 'date_location', 'travel_destination', 'event_venue',
    'personal', 'other'
  )),
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  notes TEXT,
  price_range SMALLINT CHECK (price_range BETWEEN 1 AND 4),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  photo_reference TEXT,
  external_place_id TEXT,
  visited BOOLEAN NOT NULL DEFAULT false,
  visited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT places_visited_at_check CHECK (visited OR visited_at IS NULL)
);
CREATE INDEX places_couple_idx ON places(couple_id);
CREATE UNIQUE INDEX places_couple_external_place_unique
  ON places(couple_id, external_place_id) WHERE external_place_id IS NOT NULL;

CREATE TABLE place_likes (
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, user_id)
);

CREATE TRIGGER places_touch_updated_at BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY places_members ON places
  USING (app_is_couple_member(couple_id)) WITH CHECK (app_is_couple_member(couple_id));

CREATE POLICY place_likes_members ON place_likes
  USING (
    EXISTS (
      SELECT 1 FROM places p
      WHERE p.id = place_likes.place_id AND app_is_couple_member(p.couple_id)
    )
  )
  WITH CHECK (
    user_id = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM places p
      WHERE p.id = place_likes.place_id AND app_is_couple_member(p.couple_id)
    )
  );

COMMENT ON TABLE places IS 'Shared, couple-scoped saved locations for the map feature.';
COMMENT ON TABLE place_likes IS 'Per-user interest ("favorite") in a saved place; drives partner-colored map pins.';

COMMIT;
