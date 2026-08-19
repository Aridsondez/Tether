# AI-2: Natural-language partner-preference capture

**Epic:** [AI Assistant](../epic.md)

## Description

Let a user type something like "she's allergic to shellfish and wears a size 8 shoe" and have it become structured preference/partner-note entries.

## Requirements

- Depends on [Partner Profile Revamp](../../partner-profile-revamp/epic.md)'s structured schema (PROFILE-1) — sequence after that ticket lands.
- Use AI-1's service to extract category + structured fields from free text.
- Show the user the extracted result for confirmation before saving — never silently write AI output to shared partner data.

## Acceptance Criteria

- [ ] Free-text input produces a structured proposal (category + fields) shown to the user before it's saved.
- [ ] The user can edit or reject the proposal before it's committed.
- [ ] Saved entries are indistinguishable in the data model from manually-entered ones (same tables/fields).
