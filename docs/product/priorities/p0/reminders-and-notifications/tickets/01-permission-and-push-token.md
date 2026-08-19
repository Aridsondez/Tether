# NOTIF-1: Permission & push token registration

**Epic:** [Reminders & Notifications](../epic.md)

## Description

Add the notification plumbing the rest of this epic depends on: request permission at the right moment, and register/store a push token per user/device.

## Requirements

- Add `expo-notifications` (and `expo-device` if needed) as a dependency.
- Request permission contextually — e.g. the first time a user sets a reminder or opens Calendar — not on cold app launch.
- On grant, register the Expo push token and send it to a new backend table (e.g. `user_push_tokens`, new migration) keyed by user + device.
- Handle token refresh/re-registration on subsequent launches.

## Acceptance Criteria

- [ ] Permission prompt appears at a contextual trigger point, not app launch.
- [ ] Granted tokens are persisted server-side, associated with the signed-in user.
- [ ] Denied/revoked permission is handled without crashing and doesn't block the rest of the app.
