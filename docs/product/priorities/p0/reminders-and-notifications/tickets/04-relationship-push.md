# NOTIF-4: Relationship/invite push notifications

**Epic:** [Reminders & Notifications](../epic.md)

## Description

Server-triggered push notifications for cross-device events the receiving device can't know about on its own — at minimum, a partner sending or accepting an invite.

## Requirements

- Backend sends a push via Expo's push service when a relevant event happens: invite created, invite accepted.
- Uses the token registered in NOTIF-1.

## Acceptance Criteria

- [ ] Inviting a partner or accepting an invite triggers a push to the other party's registered device(s).
- [ ] Tapping the notification opens the app to Home.
