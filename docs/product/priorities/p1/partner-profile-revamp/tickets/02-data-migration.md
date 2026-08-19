# PROFILE-2: Data migration

**Epic:** [Partner Profile Revamp](../epic.md)

## Description

Move existing preference/partner-note rows into the new structure from PROFILE-1 without data loss.

## Requirements

- Existing free-text entries map into the new schema's most general "note" category so nothing is dropped, even if not automatically re-categorized into specific structured fields.

## Acceptance Criteria

- [ ] Every existing preference/partner-note row has an equivalent row post-migration.
- [ ] No data loss, verified against a pre-migration row-count snapshot.
