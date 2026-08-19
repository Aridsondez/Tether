# NOTIF-5: Notification settings screen

**Epic:** [Reminders & Notifications](../epic.md)

## Description

A settings surface (likely under More) to control notification categories.

## Requirements

- At minimum: a master on/off toggle honoring OS-level permission state, and a separate toggle for calendar reminders vs. relationship notifications.

## Acceptance Criteria

- [ ] Users can disable calendar reminders without disabling relationship notifications, and vice versa.
- [ ] Settings reflect actual OS permission state (e.g. shows "enable in system settings" if permission was denied at the OS level).
