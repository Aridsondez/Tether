# DATA-2: Decide shared-data-on-disconnect/deletion policy

**Epic:** [Data Export & Deletion](../epic.md)

## Description

This is a product decision, not just an engineering task, and needs to be made explicitly and documented before DATA-3/DATA-4 are implemented against it.

## Requirements

- Decide, per shared entity (calendar events, places, timelines/goals): does it survive for the remaining partner after disconnect, get archived, or get deleted?
- Decide: does deleting one partner's account force-disconnect the relationship, and what does the remaining partner see afterward?

## Acceptance Criteria

- [ ] A documented policy exists and is referenced directly by DATA-3 and DATA-4's implementation.
- [ ] The policy is surfaced to users in-product — confirmation copy in DATA-5 explains the actual consequence, not generic "this can't be undone" boilerplate.
