# Epic: Onboarding

**Priority:** P0
**Status:** Not started

## Why

`/api/me` already computes `onboarding_complete` (`apps/api/app/main.py:292`), but no screen in the mobile app ever reads it. A new user lands on Home immediately after signing up or connecting and has to self-discover Profile → Edit to fill in name, birthday, pronouns, bio, and relationship stage. There is no guided setup. This directly undercuts everything downstream that depends on this data: partner profile display, birthday calendar sync, the Partner Profile Revamp epic, and eventually AI context.

## Scope

- A first-run flow triggered by `onboarding_complete: false` that walks the user through: display name, birthday, pronouns, bio.
- A relationship-setup step folded into the same flow if the user has no relationship yet — reusing existing `/api/relationships` and invitation endpoints.
- A relationship-profile step once connected (stage, met_on, anniversary) — reusing existing `/api/relationship-profile`.
- Persisting completion so the flow never shows again.

## Out of scope

- Redesigning the visual style beyond what's needed to feel like a real onboarding sequence — full redesign is a separate, later workstream.
- AI-assisted onboarding ("tell me about yourself" free text) — belongs to the AI Assistant epic (P1) and can layer on top of this once it exists.

## Acceptance Criteria

- [ ] A new or newly-connected user with `onboarding_complete: false` is routed into the onboarding flow before reaching the normal Home screen.
- [ ] The flow collects display name, birthday, pronouns, bio, and (if applicable) relationship stage/met_on/anniversary.
- [ ] A user can back out mid-flow and resume later without losing entered data.
- [ ] Completing the flow persists `onboarding_complete: true` server-side and the user never sees the flow again.
- [ ] A user who already has all required fields filled (e.g. existing accounts at rollout) is never shown the flow.

## Tickets

- [ONB-1: Define onboarding completion criteria](./tickets/01-completion-criteria.md)
- [ONB-2: First-run personal profile step](./tickets/02-personal-profile-step.md)
- [ONB-3: Relationship connect step](./tickets/03-relationship-connect-step.md)
- [ONB-4: Relationship profile step](./tickets/04-relationship-profile-step.md)
- [ONB-5: Routing & resume logic](./tickets/05-routing-and-resume.md)
