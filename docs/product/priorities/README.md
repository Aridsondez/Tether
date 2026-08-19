# Priorities

Epics and tickets, organized by priority folder. Source: full codebase audit against
[`../overview.md`](../overview.md) and [`../epics.md`](../epics.md), reprioritized 2026-08-18.

**Owned elsewhere — not tracked here:**
- Test coverage (zero tests exist; separate team)
- Dead code cleanup, incl. unused `placeholder-screen.tsx` (separate team)
- Splitting `apps/api/app/main.py` into modules (separate agent)
- Android build target — not in scope for now (see [`backlog/README.md`](./backlog/README.md) for the one thing to remember when it becomes one)
- Full UI/UX redesign — the single biggest known item overall, but deferred until there's capacity for a dedicated audit. Nothing below is a substitute for that; epics that touch visual presentation (Partner Profile Revamp, Goals) intentionally ship a "clearly better than today" pass, not a final design.

## P0 — do first

- [Onboarding](./p0/onboarding/epic.md)
- [Reminders & Notifications](./p0/reminders-and-notifications/epic.md)
- [Data Export & Deletion](./p0/data-export-and-deletion/epic.md)

## P1 — next

- [AI Assistant](./p1/ai-assistant/epic.md)
- [Partner Profile Revamp](./p1/partner-profile-revamp/epic.md) (About Us / About Partner / Preferences)

## P2 — after P1, one exploratory

- [Timeline → Goals Rework](./p2/timeline-to-goals/epic.md)
- [TikTok Video → Location Save](./p2/tiktok-location-save/epic.md) — **exploratory, not committed.** Replaces the earlier "plan a date" idea as a candidate, but may not get built. Read the epic before doing anything with it.

## Backlog — not yet scheduled

- [Backlog](./backlog/README.md) — carried forward from the original audit, not touched in this pass.

## Structure

Each epic folder has an `epic.md` (why, scope, epic-level acceptance criteria, ticket list) and a `tickets/` folder with one file per ticket (description, requirements, acceptance criteria). Cross-epic dependencies are called out explicitly in the ticket text where they exist (mainly: AI Assistant tickets depend on Partner Profile Revamp's schema and the Goals data model).
