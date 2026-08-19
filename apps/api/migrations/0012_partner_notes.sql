-- Private notes one partner keeps about the other (things they want, don't
-- want, like, dislike, or mentioned in passing) -- never visible to the
-- person the note is about.
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE TYPE partner_note_category AS ENUM ('want', 'dont_want', 'like', 'dislike', 'mentioned', 'note');

CREATE TABLE partner_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  about_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category partner_note_category NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partner_notes_not_about_self CHECK (author_id <> about_user_id)
);
CREATE INDEX partner_notes_author_about_idx ON partner_notes(author_id, about_user_id, category);

CREATE TRIGGER partner_notes_touch_updated_at BEFORE UPDATE ON partner_notes
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE partner_notes ENABLE ROW LEVEL SECURITY;

-- Private to the author only -- the partner a note is about never sees it.
CREATE POLICY partner_notes_author_only ON partner_notes
  USING (author_id = app_current_user_id())
  WITH CHECK (author_id = app_current_user_id() AND app_is_couple_member(couple_id));

COMMENT ON TABLE partner_notes IS 'Notes a user privately keeps about their partner (wants, dislikes, things mentioned). Never readable by the person the note is about.';

COMMIT;
