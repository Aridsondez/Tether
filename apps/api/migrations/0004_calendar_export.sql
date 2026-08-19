-- Tether calendar public export feed
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

-- The export feed (/api/calendar/export.ics) has no Clerk session — external
-- calendar apps can't send bearer tokens — so it authorizes by an unguessable
-- per-couple token instead. These SECURITY DEFINER functions read past RLS
-- the same way app_current_user_id()/app_is_couple_member() already do
-- (owned by the migrating role, which RLS does not apply to by default).

CREATE FUNCTION app_couple_id_for_export_token(p_token TEXT) RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM couples WHERE calendar_export_token = p_token
$$;

CREATE FUNCTION app_calendar_export_events(p_token TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN,
  visibility visibility,
  hidden_until TIMESTAMPTZ,
  recurrence_freq TEXT,
  recurrence_until DATE
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ce.id, ce.title, ce.description, ce.location, ce.start_at, ce.end_at, ce.all_day,
    ce.visibility, ce.hidden_until, ce.recurrence_freq, ce.recurrence_until
  FROM calendar_events ce
  JOIN couples c ON c.id = ce.couple_id
  WHERE c.calendar_export_token = p_token
    AND ce.visibility IN ('shared', 'summary_only', 'hidden_until')
$$;

COMMENT ON FUNCTION app_couple_id_for_export_token(TEXT) IS 'Token-gated, RLS-bypassing couple lookup used only by the public /api/calendar/export.ics feed.';
COMMENT ON FUNCTION app_calendar_export_events(TEXT) IS 'Token-gated, RLS-bypassing event read used only by the public /api/calendar/export.ics feed. Private events are never included.';

COMMIT;
