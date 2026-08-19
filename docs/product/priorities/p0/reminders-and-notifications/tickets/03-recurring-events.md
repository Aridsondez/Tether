# NOTIF-3: Recurring event reminder handling

**Epic:** [Reminders & Notifications](../epic.md)

## Description

Recurring events (`recurrence_freq`) need a reminder per occurrence, not just once. Per the audit, recurrence is expanded on read, not materialized into rows — so this needs a deliberate scheduling strategy, not just "schedule the notification" like a one-off event.

## Requirements

- Decide a scheduling window (e.g. only locally schedule the next N upcoming occurrences, refreshed on each app foreground) since local notifications can't represent an infinite recurring rule.
- Document the chosen approach — this is a real design decision, not just an implementation detail, and whoever builds NOTIF-2 needs it settled first.

## Acceptance Criteria

- [ ] A recurring event with a reminder fires a notification for each upcoming occurrence within the scheduling window.
- [ ] The scheduling window refreshes on a sensible cadence (e.g. app foreground) so occurrences don't silently stop getting reminders after the initial window passes.
