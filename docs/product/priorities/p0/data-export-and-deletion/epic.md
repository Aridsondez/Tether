# Epic: Data Export & Deletion

**Priority:** P0
**Status:** Not started

## Why

There is currently no way for a user to export their data or delete their account, and no defined behavior for what happens to shared data (calendar events, places, timelines, finances, notes) when a relationship disconnects. This has to cover every feature area in the app — profile, relationship, calendar (events + feeds), places, timelines, finances (including revoking Plaid access), preferences, and partner notes — not just one table. This is both a trust issue for a relationship app handling sensitive shared data, and, depending on where users are located, a likely compliance requirement (GDPR/CCPA-style right to export/delete).

## Scope

- A backend export endpoint that aggregates everything the signed-in user owns or has access to (their own rows across all tables, plus their permitted view of shared rows) into a downloadable format.
- A backend deletion endpoint that removes/anonymizes a user's data across every table, including revoking any Plaid item via Plaid's API before deleting local finance data.
- Explicit, decided behavior for shared/couple data when (a) one partner deletes their account while the relationship is active, and (b) a couple disconnects without deleting accounts.
- A Settings UI entry point for both actions, with confirmation friction appropriate to deletion's destructiveness.

## Out of scope

- Data portability into a specific external format beyond a reasonable machine-readable export (JSON is sufficient; no requirement to match a competitor's import format).

## Acceptance Criteria

- [ ] A signed-in user can request an export and receive a complete, accurate snapshot of their data across every feature area.
- [ ] A signed-in user can delete their account, and this removes/anonymizes their data across every table involved (profile, relationship, calendar, places, timelines, finances, preferences, partner notes).
- [ ] Deleting an account with an active Plaid connection revokes the Plaid item via Plaid's API, not just deletes local rows.
- [ ] The product has a written, implemented decision for what happens to shared data on disconnect/deletion.
- [ ] Both actions are reachable from Settings with confirmation steps appropriate to their destructiveness.

## Tickets

- [DATA-1: Inventory every table/feature area touching user or couple data](./tickets/01-data-inventory.md)
- [DATA-2: Decide shared-data-on-disconnect/deletion policy](./tickets/02-shared-data-policy.md)
- [DATA-3: Export endpoint](./tickets/03-export-endpoint.md)
- [DATA-4: Deletion endpoint (incl. Plaid revocation)](./tickets/04-deletion-endpoint.md)
- [DATA-5: Settings UI](./tickets/05-settings-ui.md)
