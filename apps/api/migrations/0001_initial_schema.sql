-- Tether initial schema
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE relationship_status AS ENUM ('pending', 'active', 'paused', 'disconnected');
CREATE TYPE member_role AS ENUM ('owner', 'partner');
CREATE TYPE membership_status AS ENUM ('invited', 'active', 'left', 'removed');
CREATE TYPE visibility AS ENUM ('private', 'shared', 'summary_only', 'hidden_until');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT,
  avatar_key TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status relationship_status NOT NULL DEFAULT 'pending',
  relationship_started_on DATE,
  connected_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT couples_lifecycle_check CHECK (
    (status <> 'active' OR connected_at IS NOT NULL)
    AND (status <> 'paused' OR paused_at IS NOT NULL)
    AND (status <> 'disconnected' OR disconnected_at IS NOT NULL)
  )
);

CREATE TABLE couple_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role member_role NOT NULL DEFAULT 'partner',
  status membership_status NOT NULL DEFAULT 'invited',
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (couple_id, user_id),
  CONSTRAINT couple_members_active_dates_check CHECK (
    (status <> 'active' OR joined_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX couple_members_one_active_relationship_per_user
  ON couple_members(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX couple_members_one_owner_per_couple
  ON couple_members(couple_id) WHERE role = 'owner' AND status <> 'removed';

CREATE TABLE relationship_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_email TEXT,
  invitee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invitation_target_check CHECK (invitee_email IS NOT NULL OR invitee_id IS NOT NULL)
);
CREATE UNIQUE INDEX relationship_invitations_one_pending_per_couple
  ON relationship_invitations(couple_id) WHERE status = 'pending';

CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  bio TEXT,
  birthday DATE,
  pronouns TEXT,
  default_visibility visibility NOT NULL DEFAULT 'shared',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE relationship_profiles (
  couple_id UUID PRIMARY KEY REFERENCES couples(id) ON DELETE CASCADE,
  display_name TEXT,
  anniversary_on DATE,
  favorite_activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  date_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  travel_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  communication_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  boundaries JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per preference keeps field-level visibility, source, and AI review explicit.
CREATE TABLE profile_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  value JSONB NOT NULL,
  visibility visibility NOT NULL DEFAULT 'shared',
  source TEXT NOT NULL DEFAULT 'manual',
  reviewed_at TIMESTAMPTZ,
  hidden_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT preference_hidden_until_check CHECK (visibility <> 'hidden_until' OR hidden_until IS NOT NULL)
);
CREATE INDEX profile_preferences_user_category_idx ON profile_preferences(user_id, category);

-- RLS context is set per API transaction: SET LOCAL app.user_id = '<Clerk user id>';
CREATE FUNCTION app_current_user_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM users WHERE clerk_user_id = current_setting('app.user_id', true) LIMIT 1
$$;

CREATE FUNCTION app_is_couple_member(target_couple_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM couple_members
    WHERE couple_id = target_couple_id
      AND user_id = app_current_user_id()
      AND status = 'active'
  )
$$;

CREATE FUNCTION app_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION app_limit_active_couple_members() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'active' AND (
    TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active'
  ) AND (
    SELECT count(*) FROM couple_members
    WHERE couple_id = NEW.couple_id AND status = 'active'
  ) >= 2 THEN
    RAISE EXCEPTION 'A relationship can have at most two active members';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER couple_members_limit_active_members
  BEFORE INSERT OR UPDATE OF status, couple_id ON couple_members
  FOR EACH ROW EXECUTE FUNCTION app_limit_active_couple_members();

CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER couples_touch_updated_at BEFORE UPDATE ON couples
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER couple_members_touch_updated_at BEFORE UPDATE ON couple_members
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER user_profiles_touch_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER relationship_profiles_touch_updated_at BEFORE UPDATE ON relationship_profiles
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER profile_preferences_touch_updated_at BEFORE UPDATE ON profile_preferences
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users
  USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());
CREATE POLICY couples_members ON couples
  USING (app_is_couple_member(id)) WITH CHECK (app_is_couple_member(id));
CREATE POLICY couple_members_members ON couple_members
  USING (user_id = app_current_user_id() OR app_is_couple_member(couple_id))
  WITH CHECK (user_id = app_current_user_id() OR app_is_couple_member(couple_id));
CREATE POLICY invitations_participants ON relationship_invitations
  USING (inviter_id = app_current_user_id() OR invitee_id = app_current_user_id())
  WITH CHECK (inviter_id = app_current_user_id() OR invitee_id = app_current_user_id());
CREATE POLICY user_profiles_access ON user_profiles
  USING (
    user_id = app_current_user_id() OR EXISTS (
      SELECT 1 FROM couple_members self
      JOIN couple_members partner ON partner.couple_id = self.couple_id
      WHERE self.user_id = app_current_user_id() AND self.status = 'active'
        AND partner.user_id = user_profiles.user_id AND partner.status = 'active'
    )
  ) WITH CHECK (user_id = app_current_user_id());
CREATE POLICY relationship_profiles_members ON relationship_profiles
  USING (app_is_couple_member(couple_id)) WITH CHECK (app_is_couple_member(couple_id));
CREATE POLICY profile_preferences_access ON profile_preferences
  USING (
    user_id = app_current_user_id() OR (
      visibility IN ('shared', 'summary_only')
      AND (hidden_until IS NULL OR hidden_until <= now())
      AND EXISTS (
        SELECT 1 FROM couple_members self
        JOIN couple_members partner ON partner.couple_id = self.couple_id
        WHERE self.user_id = app_current_user_id() AND self.status = 'active'
          AND partner.user_id = profile_preferences.user_id AND partner.status = 'active'
      )
    )
  ) WITH CHECK (user_id = app_current_user_id());

COMMENT ON FUNCTION app_current_user_id() IS 'Resolves the Clerk subject placed in app.user_id by the Railway API.';
COMMENT ON TABLE profile_preferences IS 'Field-level personal preferences; private and surprise-sensitive values are protected with RLS.';

COMMIT;
