-- Let a user read their active partner's row on `users`, not just their own.
--
-- 0010_users_rls_command_policies.sql made `users` SELECT strictly self-only
-- (id = app_current_user_id()). That silently broke every cross-partner join
-- against `users` under RLS enforcement (e.g. `/api/me`'s partner_display_name
-- subquery) -- the join simply returns no row for the partner, so the field
-- reads back as NULL instead of erroring, which is why this went unnoticed.
-- Mirrors the existing user_profiles_access policy's partner-visibility shape.
--
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

CREATE POLICY users_select_partner ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM couple_members self
      JOIN couple_members partner ON partner.couple_id = self.couple_id
      WHERE self.user_id = app_current_user_id() AND self.status = 'active'
        AND partner.user_id = users.id AND partner.status = 'active'
    )
  );

COMMENT ON POLICY users_select_partner ON users IS 'Additional permissive SELECT policy, combined with users_select_self via OR: lets a user also read their active partners row, e.g. for partner_display_name in /api/me.';

COMMIT;
