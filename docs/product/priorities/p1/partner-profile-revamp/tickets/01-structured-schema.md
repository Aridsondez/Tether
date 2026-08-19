# PROFILE-1: Structured schema design

**Epic:** [Partner Profile Revamp](../epic.md)

## Description

Design the structured categories/fields to replace flat `label` + `note`. Everything else in this epic, and [AI-2](../../ai-assistant/tickets/02-nl-preference-capture.md), depends on this landing first.

## Requirements

- Cover at minimum: sizes (clothing/shoe/ring), love language, important dates (beyond birthday), allergies/dietary, plus the existing like/dislike/gift-idea categories — reshaped to have structured fields where it makes sense (e.g. a size entry has a `garment_type` + `size_value`, not just free text).
- New migration(s) under `apps/api/migrations/`.
- Keep it extensible — adding a new category later shouldn't require a new table each time. Consider a category + fields-as-JSONB approach vs. a rigid table-per-category; decide during implementation.

## Acceptance Criteria

- [ ] Schema supports every category listed above with real structured fields, not just text.
- [ ] Schema is extensible enough to add a new category without a full redesign.
- [ ] RLS/visibility rules from the existing `preferences`/`partner_notes` tables are preserved in the new schema.
