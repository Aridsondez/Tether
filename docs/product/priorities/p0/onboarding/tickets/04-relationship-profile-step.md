# ONB-4: Relationship profile step

**Epic:** [Onboarding](../epic.md)

## Description

Once a relationship is active, collect relationship stage, `met_on`, and `anniversary_on` via the existing `/api/relationship-profile` endpoint.

## Requirements

- Only shown once `relationship.relationship_status === 'active'`.
- Reuse the `RELATIONSHIP_STAGES` constant from `apps/mobile/src/lib/api.ts`.
- Decide during implementation whether a user without an active relationship yet skips this step entirely and gets prompted later (e.g. on first Home visit after their partner accepts), or whether onboarding simply ends without it.

## Acceptance Criteria

- [ ] Step is skipped for users without an active relationship yet.
- [ ] Submitting persists via `tetherApi.updateRelationshipProfile`.
