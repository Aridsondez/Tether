-- Least-privilege application role, so RLS policies are actually enforced.
--
-- Neon's default connection role (neondb_owner) owns every table AND has
-- BYPASSRLS, so every RLS policy in this schema (including the strict
-- owner-only policies added in 0006_finances.sql for account balances,
-- access tokens, and transactions) has been silently inert since 0001: a
-- role with BYPASSRLS skips row-level security checks entirely, regardless
-- of how the policies are written. This role is the fix: the running API
-- should connect as tether_app (via DATABASE_URL) so RLS becomes a real
-- backstop, not just documentation. Migrations continue to run as
-- neondb_owner (via DATABASE_URL_UNPOOLED), since DDL needs owner privileges
-- that an intentionally-restricted runtime role should not have.
--
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tether_app') THEN
    CREATE ROLE tether_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO tether_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tether_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tether_app;
GRANT EXECUTE ON FUNCTION app_shared_finance_spend(UUID) TO tether_app;
GRANT EXECUTE ON FUNCTION app_shared_finance_budget_status(UUID) TO tether_app;

-- So tables created by future migrations (run as neondb_owner) are
-- automatically grantted to tether_app without a manual GRANT each time.
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tether_app;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tether_app;

COMMENT ON ROLE tether_app IS 'Runtime API connection role (DATABASE_URL). No table ownership, no BYPASSRLS, so RLS policies are enforced. Password is set out-of-band, never committed.';

COMMIT;
