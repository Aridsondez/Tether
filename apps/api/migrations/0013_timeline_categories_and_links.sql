-- Timeline categories + multi-parent (merge) support
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

ALTER TABLE timelines
  ADD COLUMN category TEXT NOT NULL DEFAULT 'other' CHECK (category IN (
    'school', 'work', 'finances', 'health', 'home', 'travel', 'relationship', 'personal', 'other'
  ));

CREATE TABLE timeline_links (
  parent_timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  child_timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_timeline_id, child_timeline_id),
  CONSTRAINT timeline_links_not_self CHECK (parent_timeline_id <> child_timeline_id)
);
CREATE INDEX timeline_links_child_idx ON timeline_links(child_timeline_id);

-- Backfill the old single-parent edges into the join table before dropping the column.
INSERT INTO timeline_links (parent_timeline_id, child_timeline_id)
SELECT parent_timeline_id, id FROM timelines WHERE parent_timeline_id IS NOT NULL;

DROP INDEX IF EXISTS timelines_parent_idx;
ALTER TABLE timelines DROP COLUMN parent_timeline_id;

ALTER TABLE timeline_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY timeline_links_members ON timeline_links
  USING (
    EXISTS (SELECT 1 FROM timelines t WHERE t.id = timeline_links.child_timeline_id AND app_is_couple_member(t.couple_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM timelines t WHERE t.id = timeline_links.child_timeline_id AND app_is_couple_member(t.couple_id))
  );

COMMENT ON TABLE timeline_links IS 'Join table letting a timeline branch off up to two parents (a merge node), replacing the old single parent_timeline_id column. The API enforces the 2-parent cap and acyclicity, not the schema.';
COMMENT ON COLUMN timelines.category IS 'Visual/filterable grouping (school, work, finances, ...); drives node shape and clustering in the timeline graph.';
COMMENT ON TABLE timelines IS 'Couple-scoped visual progress timelines; can branch off up to two parents via timeline_links and be personal ("mine") or shared.';

COMMIT;
