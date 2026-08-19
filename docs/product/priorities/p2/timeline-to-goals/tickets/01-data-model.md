# GOALS-1: Data model rework

**Epic:** [Timeline → Goals Rework](../epic.md)

## Description

Extend/adjust the `timelines`/`timeline_items` schema to represent progress explicitly. Everything else in this epic, and [AI-3](../../../p1/ai-assistant/tickets/03-goal-breakdown.md), depends on this landing first.

## Requirements

- Decide: is progress purely derived (completed items ÷ total items) or does a goal need its own explicit progress/status beyond that? Items already have `completed_at`, so derived is likely sufficient — confirm during implementation rather than over-building.
- Decide whether "Goals" needs a different category set than the current `TIMELINE_CATEGORIES`, or reuses it as-is.

## Acceptance Criteria

- [ ] A goal's completion percentage can be computed/served by the API.
- [ ] Existing `parent_timeline_ids` linking (used for the cycle-checked hierarchy) continues to work under the new framing.
