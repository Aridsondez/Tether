-- Tether timelines schema
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE TABLE timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_timeline_id UUID REFERENCES timelines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  ownership TEXT NOT NULL DEFAULT 'shared' CHECK (ownership IN ('mine', 'shared')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date DATE,
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timelines_not_self_parent CHECK (parent_timeline_id IS NULL OR parent_timeline_id <> id)
);
CREATE INDEX timelines_couple_idx ON timelines(couple_id);
CREATE INDEX timelines_parent_idx ON timelines(parent_timeline_id);

CREATE TABLE timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  notes TEXT,
  target_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX timeline_items_timeline_idx ON timeline_items(timeline_id);

CREATE TRIGGER timelines_touch_updated_at BEFORE UPDATE ON timelines
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER timeline_items_touch_updated_at BEFORE UPDATE ON timeline_items
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE timelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY timelines_members ON timelines
  USING (app_is_couple_member(couple_id)) WITH CHECK (app_is_couple_member(couple_id));

CREATE POLICY timeline_items_members ON timeline_items
  USING (
    EXISTS (SELECT 1 FROM timelines t WHERE t.id = timeline_items.timeline_id AND app_is_couple_member(t.couple_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM timelines t WHERE t.id = timeline_items.timeline_id AND app_is_couple_member(t.couple_id))
  );

COMMENT ON TABLE timelines IS 'Couple-scoped visual progress timelines; can branch off each other via parent_timeline_id and be personal ("mine") or shared.';
COMMENT ON TABLE timeline_items IS 'Milestones plotted along a timeline; each is either dated or manually approved via completed_at.';

COMMIT;
