# Epic: Timeline → Goals Rework

**Priority:** P2
**Status:** Not started

## Why

The current Timeline feature is a fairly plain list of dated items. The intent is to rework this into a "Goals" concept — things a couple is actively working toward, with a visual representation of progress, not just a dated checklist. This should also be something the AI Assistant epic can plug into for goal breakdown ([AI-3](../../p1/ai-assistant/tickets/03-goal-breakdown.md)).

## Scope

- Data model changes to support progress (not just completed/not-completed items — an overall goal progress concept).
- A visual progress representation (progress bar/ring/roadmap-style UI) replacing the current plain list rendering.
- Reframe in the UI from "Timeline" to "Goals" (confirm final naming during implementation — could keep "Timeline" as the umbrella data concept and "Goals" as the user-facing framing).
- A hook point for AI-3 (goal breakdown suggestions).

## Out of scope

- Final visual polish — depends on the eventual full redesign. This epic ships a functional, clearly-better-than-a-list visual, not the final polished version.
- Timeline photos / linked expenses (previously flagged as a smaller gap) — still deferred unless folded in opportunistically.

## Acceptance Criteria

- [ ] Data model represents a goal's overall progress, derived from or explicit alongside its steps/items.
- [ ] The UI shows goals with a visual progress indicator, not just a list of dated items.
- [ ] Existing timeline data migrates cleanly into the new model.
- [ ] [AI-3](../../p1/ai-assistant/tickets/03-goal-breakdown.md) can create steps against this model via GOALS-4.

## Tickets

- [GOALS-1: Data model rework](./tickets/01-data-model.md)
- [GOALS-2: Visual progress UI](./tickets/02-visual-progress-ui.md)
- [GOALS-3: Migration of existing timeline data](./tickets/03-data-migration.md)
- [GOALS-4: AI goal-breakdown hook](./tickets/04-ai-hook.md)
