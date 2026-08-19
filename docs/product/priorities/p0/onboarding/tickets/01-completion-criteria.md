# ONB-1: Define onboarding completion criteria

**Epic:** [Onboarding](../epic.md)

## Description

Confirm and, if needed, adjust what `onboarding_complete` actually checks server-side before building UI on top of it — it's currently computed but never consumed by anything, so its correctness has never mattered until now.

## Requirements

- Audit the `onboarding_complete` computation in `apps/api/app/main.py` (~line 292) and document which fields it currently checks.
- Decide the canonical "done" definition, e.g.: `display_name` + `birthday` + `pronouns` set, plus `relationship_profile.relationship_stage` set if the relationship is active.
- Adjust the computation if it doesn't match the agreed definition.
- The definition must be read live from current data (not a stored "did onboarding" boolean) so existing users with complete data are never forced through the flow.

## Acceptance Criteria

- [ ] Written definition of "onboarding complete" agreed and matches what `/api/me` returns.
- [ ] `onboarding_complete` flips to `true` only once all required fields are present.
- [ ] Existing users who already have these fields filled compute as `true` without any backfill/migration step.
