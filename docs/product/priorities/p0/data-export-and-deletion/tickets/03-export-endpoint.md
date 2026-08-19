# DATA-3: Export endpoint

**Epic:** [Data Export & Deletion](../epic.md)

## Description

Backend endpoint(s) producing a full data export for the signed-in user.

## Requirements

- New authenticated endpoint (e.g. `GET /api/me/export`) returning a structured JSON payload covering every table from DATA-1 marked export-relevant.
- Reasonable performance/pagination approach if data volume grows (not a concern at current scale, but don't load unbounded finance transaction history without at least deciding that's acceptable).

## Acceptance Criteria

- [ ] Endpoint returns the user's full data per the DATA-1 inventory.
- [ ] Shared data is included only from the requesting user's permitted view — respects existing RLS/visibility rules (e.g. a `hidden_until` event masked from a partner must not leak into that partner's export).
