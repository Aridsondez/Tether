-- Keep a profile's birthday in sync with a shared, yearly-recurring calendar event
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN birthday_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_profiles.birthday_event_id IS
  'The recurring yearly calendar_events row kept in sync with this profile''s birthday (see sync_birthday_event in main.py). NULL if no birthday is set, or the user has no active relationship to attach the event to yet.';

COMMIT;
