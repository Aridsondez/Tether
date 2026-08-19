-- Command-specific user RLS policies.
--
-- PostgreSQL applies an ALL policy's visibility expression while processing a
-- first INSERT under this schema, even though the row cannot yet be resolved by
-- app_current_user_id(). Keep creation separate from self-only visibility.

BEGIN;

DROP POLICY IF EXISTS users_self ON users;

CREATE POLICY users_select_self ON users
  FOR SELECT USING (id = app_current_user_id());

CREATE POLICY users_insert_self ON users
  FOR INSERT WITH CHECK (clerk_user_id = current_setting('app.user_id', true));

CREATE POLICY users_update_self ON users
  FOR UPDATE
  USING (id = app_current_user_id())
  WITH CHECK (clerk_user_id = current_setting('app.user_id', true));

CREATE POLICY users_delete_self ON users
  FOR DELETE USING (id = app_current_user_id());

COMMENT ON TABLE users IS 'Local Clerk-user projection. RLS uses command-specific policies so a first authenticated subject can bootstrap only its own row without weakening self-only reads and mutations.';

COMMIT;
