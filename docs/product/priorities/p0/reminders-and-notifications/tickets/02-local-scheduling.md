# NOTIF-2: Local scheduling for calendar event reminders

**Epic:** [Reminders & Notifications](../epic.md)

## Description

When an event has `reminder_minutes` set, schedule a local device notification for it — this is the ticket that actually makes the existing reminder picker do something.

## Requirements

- On event create/update/delete, schedule/reschedule/cancel the corresponding local notification via `expo-notifications`.
- If `reminder_minutes` implies a time already in the past at creation time, decide: don't schedule, or fire immediately — pick one and document it.
- Tapping the notification deep-links into the event (Calendar tab, event detail sheet).

## Acceptance Criteria

- [ ] Creating an event with a reminder schedules a notification for the correct time.
- [ ] Editing an event's time or reminder reschedules correctly — no duplicate or stale notifications left behind.
- [ ] Deleting an event cancels its scheduled notification.
- [ ] Tapping the notification opens the app to that event.
