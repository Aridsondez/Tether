# Epic: Reminders & Notifications

**Priority:** P0
**Status:** Not started

## Why

Calendar events already store and expose `reminder_minutes` (`apps/api/app/main.py:1967`, `:2100`), and the event editor lets a user pick a reminder offset — but nothing schedules or fires a notification for it. There is no `expo-notifications`, no push token, no scheduling code anywhere in the repo. Right now this is a UI control that implies a working feature and silently does nothing. That's a trust problem, not just a missing feature, and needs to become real before more users hit it.

## Scope

- Local (device-scheduled) notifications for a user's own calendar events, driven by the existing `reminder_minutes` field.
- Push notification infrastructure (permission, token registration, server-side storage) so server-triggered notifications are possible for events the device can't know about on its own (partner invited/accepted).
- A notification settings surface so users can control what they get.

## Out of scope

- Rich notification content/deep-link polish beyond opening the right screen.
- Notifications for every feature area (finance alerts, etc.) — this epic covers calendar reminders + core relationship events; everything else is backlog.
- Android-specific notification config — not building for Android currently (see repo priorities index).

## Acceptance Criteria

- [ ] Setting a reminder on a calendar event results in an actual local notification firing at the chosen offset.
- [ ] The app requests notification permission at a contextual moment, not app cold-launch, and handles "denied" gracefully.
- [ ] A push token is registered and stored server-side once permission is granted.
- [ ] Users can turn reminders off entirely from settings.

## Tickets

- [NOTIF-1: Permission & push token registration](./tickets/01-permission-and-push-token.md)
- [NOTIF-2: Local scheduling for calendar event reminders](./tickets/02-local-scheduling.md)
- [NOTIF-3: Recurring event reminder handling](./tickets/03-recurring-events.md)
- [NOTIF-4: Relationship/invite push notifications](./tickets/04-relationship-push.md)
- [NOTIF-5: Notification settings screen](./tickets/05-settings-screen.md)
