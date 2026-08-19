# GOALS-4: AI goal-breakdown hook

**Epic:** [Timeline → Goals Rework](../epic.md)

## Description

The integration point [AI-3](../../../p1/ai-assistant/tickets/03-goal-breakdown.md) needs — accepting AI-suggested steps and creating them as real goal items pending user acceptance. The suggestion logic itself lives in AI-3; this ticket is the API-side landing spot.

## Requirements

- API can create multiple timeline/goal items for a goal in one call (batch creation), avoiding N round trips for an AI-suggested breakdown.

## Acceptance Criteria

- [ ] A single API call can create a batch of steps for one goal.
