# Epic: AI Assistant

**Priority:** P1
**Status:** Not started

## Why

The product's stated vision centers on an AI system embedded contextually across the app; right now there is zero implementation despite an existing research doc (`docs/ai/llm-integration-research.md`). This is the single largest vision-vs-reality gap in the codebase. Scope it narrow and useful rather than "AI everywhere at once" — and wire it explicitly to power the two other reworked features (Partner Profile Revamp, Timeline → Goals) rather than shipping as a standalone chat toy.

## Scope

- Backend AI service integration (provider/gateway choice, secrets, a single well-defined entry point other backend code can call).
- Natural-language capture into structured partner preferences/notes — feeds [Partner Profile Revamp](../partner-profile-revamp/epic.md).
- Goal breakdown assistance for [Timeline → Goals](../../p2/timeline-to-goals/epic.md).
- A visible assistant surface in the app (a simple chat entry point is enough for v1).
- Baseline data controls (what the AI can see, ability to opt out) — necessary given it reads relationship/partner data.

## Out of scope for v1

- AI on every single screen contextually, per the full original vision — that's the eventual goal, not this slice.
- Voice input.
- Proactive/unprompted suggestions — start with user-initiated interactions only.

## Dependencies

- AI-2 depends on [Partner Profile Revamp](../partner-profile-revamp/epic.md)'s structured schema (PROFILE-1) existing first.
- AI-3 depends on [Timeline → Goals](../../p2/timeline-to-goals/epic.md)'s data model (GOALS-1) existing first.

## Acceptance Criteria

- [ ] Backend has a working, secret-managed integration with a chosen LLM provider.
- [ ] A user can type a natural-language sentence describing a partner preference and have it land as a structured preference/partner-note without manual form-filling.
- [ ] A user can describe a goal in natural language and get a suggested breakdown of steps/milestones for the Goals feature.
- [ ] There's a documented, user-facing explanation of what data the assistant can access, and an opt-out.
- [ ] The assistant is reachable from a real, discoverable place in the app.

## Tickets

- [AI-1: Provider & backend service integration](./tickets/01-provider-integration.md)
- [AI-2: Natural-language partner-preference capture](./tickets/02-nl-preference-capture.md)
- [AI-3: Goal breakdown assistance](./tickets/03-goal-breakdown.md)
- [AI-4: Assistant chat surface](./tickets/04-assistant-surface.md)
- [AI-5: AI data controls & opt-out](./tickets/05-data-controls.md)
