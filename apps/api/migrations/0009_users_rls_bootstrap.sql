-- Permit a signed-in Clerk subject to create exactly its own local user row.
--
-- The original policy's WITH CHECK used app_current_user_id(), which necessarily
-- returns NULL before the first users row exists. That made ensure_user() fail
-- for every new user once the least-privilege runtime role began enforcing RLS.

BEGIN;

DROP POLICY IF EXISTS users_self ON users;

CREATE POLICY users_self ON users
  USING (id = app_current_user_id())
  WITH CHECK (clerk_user_id = current_setting('app.user_id', true));

COMMENT ON POLICY users_self ON users IS 'Users may read/update only their own local row; a first-time Clerk subject may insert only a row whose clerk_user_id matches the transaction-local app.user_id.';

COMMIT;
