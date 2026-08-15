# Neon + Railway Architecture Decision

**Status:** Accepted  
**Date:** August 14, 2026

## Decision

Tether will use **Neon Postgres** as its managed database and **Railway** to run its backend API, background jobs, and real-time gateway. The mobile app must access data through the backend API; it must not connect to Neon with a privileged database connection string.

This replaces the previous Supabase-first recommendation. Neon is the database host, not an all-in-one backend platform, so authentication, authorization, real-time delivery, and media storage are deliberately separate concerns.

## Service boundaries

| Concern | Decision | Responsibility |
|---|---|---|
| Database | Neon Postgres | Persistent relational data, backups, branching, and schema review |
| Backend | Railway | API, authorization, jobs, webhooks, and real-time gateway |
| Authentication | Clerk | Email, Apple, and Google sign-in; backend validates its JWTs |
| Authorization | Railway backend + Postgres RLS | The API checks relationship membership and visibility before every read/write; RLS is defense in depth |
| Real-time updates | Socket.IO or SSE from Railway | Emits only authorized calendar, budget, task, and location changes |
| Media | Cloudflare R2 | Private images/videos, served with short-lived signed URLs |
| Schema management | Drizzle ORM migrations in Git | Versioned, reviewed, repeatable database changes |

## Schema and bug-fix workflow

The database data does not live in the Git repository. The repository stores only the application code and database migration files.

```text
repository
├── backend/
├── db/
│   ├── schema/
│   └── migrations/
│       ├── 0001_initial_schema.sql
│       └── 0002_add_budget_visibility.sql
└── ...

Neon: production and isolated development/preview databases
Railway: deployed API, workers, and real-time service
```

For every schema change:

1. Change the Drizzle schema and generate a migration in `db/migrations/`.
2. Apply it to a Neon development or pull-request branch.
3. Test the feature and inspect Neon’s schema diff against the production branch.
4. Review the migration in Git along with the application change.
5. Run that same migration once against production as a controlled deploy step.

Never rely on a production-only `db push`, manual dashboard edits, or app startup to alter the schema. Those approaches make rollback and bug diagnosis much harder.

## Privacy model

`users`, `couples`, and `couple_members` form the access-control base. Every domain record is either owned by one user or belongs to a couple and has a visibility value. The Railway API obtains the authenticated user ID from Clerk, checks membership, and scopes every query accordingly. Postgres RLS policies mirror those rules for defense in depth.

## Why Neon

- Its Postgres branches are isolated, fast to create, and suitable for feature testing and bug reproduction.
- Schema diff makes a migration reviewable before production.
- Standard PostgreSQL and SQL migrations avoid database-vendor lock-in.
- Railway remains focused on running application code rather than owning the data layer.

Neon branches can be created for pull requests or test runs, and Neon supports schema-only branches when production data should not be copied. [Neon branching workflow](https://neon.com/docs/get-started-with-neon/workflow-primer) and [schema diff](https://neon.com/docs/guides/schema-diff) describe this workflow.
