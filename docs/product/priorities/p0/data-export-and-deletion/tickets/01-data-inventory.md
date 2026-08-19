# DATA-1: Inventory every table/feature area touching user or couple data

**Epic:** [Data Export & Deletion](../epic.md)

## Description

Before building export/delete, produce a definitive list of every table and API surface that holds user or couple data — this spans nearly every migration in `apps/api/migrations/`.

## Requirements

- Walk all migrations (`0001` through `0016` as of this writing) and list every table, noting which are per-user, per-couple, or relationship-scoped.
- Note which tables reference external services that need their own cleanup step (Plaid items/access tokens, calendar feed URLs, cached Google Places photo refs if any).

## Acceptance Criteria

- [ ] A written table-by-table inventory exists (can live as an appendix here or a linked doc) covering at minimum: users, relationships/invitations, preferences, partner_notes, places + likes, timelines + items, calendar events + feeds, finance accounts/budgets/transactions/Plaid items, relationship_profile, user colors.
- [ ] Each table is marked export-relevant, delete-relevant, or both.
