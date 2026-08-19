-- Tether calendar schema
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'date_night', 'anniversary', 'appointment', 'travel', 'family_friends',
    'household', 'work', 'health', 'milestone', 'reminder', 'other'
  )),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  visibility visibility NOT NULL DEFAULT 'shared',
  hidden_until TIMESTAMPTZ,
  recurrence_freq TEXT NOT NULL DEFAULT 'none' CHECK (recurrence_freq IN (
    'none', 'daily', 'weekly', 'monthly', 'yearly'
  )),
  recurrence_until DATE,
  reminder_minutes SMALLINT CHECK (reminder_minutes >= 0),
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_end_after_start_check CHECK (end_at >= start_at),
  CONSTRAINT calendar_events_hidden_until_check CHECK (visibility <> 'hidden_until' OR hidden_until IS NOT NULL),
  CONSTRAINT calendar_events_recurrence_until_check CHECK (recurrence_until IS NULL OR recurrence_freq <> 'none')
);
CREATE INDEX calendar_events_couple_range_idx ON calendar_events(couple_id, start_at, end_at);

CREATE TABLE calendar_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'other' CHECK (provider IN ('google', 'apple', 'outlook', 'other')),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6C8CFF',
  feed_url TEXT NOT NULL,
  raw_ics TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'ok', 'error')),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX calendar_feeds_couple_idx ON calendar_feeds(couple_id);

-- Looked up directly by the unauthenticated ICS export endpoint (the same
-- "secret address" model Google/Apple/Outlook use for their own iCal feeds),
-- so the raw token, not a hash, must be stored here.
ALTER TABLE couples ADD COLUMN calendar_export_token TEXT UNIQUE;

CREATE TRIGGER calendar_events_touch_updated_at BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER calendar_feeds_touch_updated_at BEFORE UPDATE ON calendar_feeds
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;

-- Row-level policy only enforces couple membership; per-viewer masking of
-- 'private' / 'summary_only' / not-yet-revealed 'hidden_until' event content
-- happens in the API's SELECT (see event_detail in main.py), the same way
-- place_detail computes viewer-relative fields.
CREATE POLICY calendar_events_members ON calendar_events
  USING (app_is_couple_member(couple_id)) WITH CHECK (app_is_couple_member(couple_id));

CREATE POLICY calendar_feeds_members ON calendar_feeds
  USING (app_is_couple_member(couple_id)) WITH CHECK (app_is_couple_member(couple_id));

COMMENT ON TABLE calendar_events IS 'Shared, couple-scoped calendar events (Tether-native). Recurrence is expanded at read time, not materialized.';
COMMENT ON TABLE calendar_feeds IS 'Read-only external calendar subscriptions (Google/Apple/Outlook/other) added by pasting a private ICS URL; raw_ics is a cached copy refreshed on sync.';
COMMENT ON COLUMN couples.calendar_export_token IS 'Secret token for the public /api/calendar/export.ics feed, letting partners subscribe to Tether events from an external calendar app.';

COMMIT;
