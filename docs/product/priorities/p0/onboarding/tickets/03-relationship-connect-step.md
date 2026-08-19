# ONB-3: Relationship connect step

**Epic:** [Onboarding](../epic.md)

## Description

If the user has no active or pending relationship, let them create one and invite a partner, or accept a pending invitation, inside the onboarding flow instead of only on Home.

## Requirements

- Reuse the existing `/api/relationships` and `/api/relationships/invitations` endpoints and logic already implemented in `apps/mobile/src/app/(tabs)/index.tsx` (`createRelationship`, `createInvitation`, `acceptInvitation`, `acceptPendingInvitation`) — extract shared logic into a hook/module rather than duplicating it.
- This step must be skippable — a user may want to finish their own profile before inviting a partner.
- If skipped, `onboarding_complete` (per ONB-1's definition) should not require a relationship to exist.

## Acceptance Criteria

- [ ] A user with no relationship can create one and send an invite from within onboarding.
- [ ] A user with a pending invitation can accept it from within onboarding.
- [ ] This step can be skipped without blocking completion of the rest of onboarding.
