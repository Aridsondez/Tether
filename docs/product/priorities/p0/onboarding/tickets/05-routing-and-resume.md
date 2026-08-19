# ONB-5: Routing & resume logic

**Epic:** [Onboarding](../epic.md)

## Description

Wire the app's root navigation so `onboarding_complete: false` reliably routes into the flow, and a partially-completed flow resumes instead of restarting.

## Requirements

- Hook into the existing sign-in gating in `apps/mobile/src/app/_layout.tsx` / `apps/mobile/src/app/(tabs)/index.tsx`.
- Persist in-progress step locally (not solely server state) so a killed app doesn't force a full restart of the flow.
- Server-side `onboarding_complete` remains the source of truth for whether the flow shows at all (survives reinstall); local progress is just a resume convenience.

## Acceptance Criteria

- [ ] Closing and reopening the app mid-onboarding resumes at or near the same step.
- [ ] Once complete, the flow is never shown again for that user, including after reinstall.
