# AI-3: Goal breakdown assistance

**Epic:** [AI Assistant](../epic.md)

## Description

Given a goal description, suggest milestones/steps for the reworked Goals feature.

## Requirements

- Depends on [Timeline → Goals](../../../p2/timeline-to-goals/epic.md)'s data model (GOALS-1) — sequence after that ticket lands.
- Input: free-text goal description plus optional target date. Output: suggested ordered steps with optional target dates, shown for the user to accept/edit before creating anything.
- Use GOALS-4's batch-creation endpoint to commit accepted suggestions.

## Acceptance Criteria

- [ ] A user describing a goal in free text gets a suggested breakdown into steps.
- [ ] Suggestions are editable and require explicit user acceptance before becoming real goal items.
