# GOALS-2: Visual progress UI

**Epic:** [Timeline → Goals Rework](../epic.md)

## Description

Replace the current timeline list rendering with a visual progress representation.

## Requirements

- At minimum: a progress bar or ring per goal, and a way to see step-by-step status at a glance.
- Reuse the existing `apps/mobile/src/components/timeline/timeline-space.tsx` and `timeline-detail-sheet.tsx` structure where possible, restyling/extending rather than rewriting from scratch.

## Acceptance Criteria

- [ ] Each goal shows a visual progress indicator reflecting GOALS-1's completion calculation.
- [ ] Step/item completion is toggleable from this view, same as today.
