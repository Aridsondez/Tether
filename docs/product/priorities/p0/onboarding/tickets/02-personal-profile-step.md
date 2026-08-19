# ONB-2: First-run personal profile step

**Epic:** [Onboarding](../epic.md)

## Description

Build the screen(s) collecting display name, birthday, pronouns, and bio for a new user, as the first step of the onboarding flow.

## Requirements

- Reuse `tetherApi.updateProfile` (existing `/api/me/profile` PUT) — no new backend endpoint needed for this ticket.
- Validate before allowing "Next": display name required; birthday/pronouns/bio optional but encouraged.
- Match existing form patterns from `apps/mobile/src/components/edit-profile-sheet.tsx` rather than inventing new input components.

## Acceptance Criteria

- [ ] Screen collects display name (required), birthday, pronouns, bio.
- [ ] Submitting calls the existing profile-update API and advances the flow.
- [ ] Validation errors show inline, using the app's existing `ApiError` → user-message pattern.
