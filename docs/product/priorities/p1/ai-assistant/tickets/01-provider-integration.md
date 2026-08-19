# AI-1: Provider & backend service integration

**Epic:** [AI Assistant](../epic.md)

## Description

Stand up the actual AI plumbing referenced by the existing research doc — nothing downstream in this epic can start without it.

## Requirements

- Pick a provider/gateway per `docs/ai/llm-integration-research.md` findings (revisit if stale).
- Add backend config (API keys via `.env`, following the existing `.env.example` pattern), a thin service module, and error handling consistent with `main.py`'s style (or its post-split module structure — coordinate with whoever owns the `main.py` split).
- Add basic rate limiting / cost guardrails given this is a paid, per-call cost surface.

## Acceptance Criteria

- [ ] A backend function exists that takes a prompt/context and returns a structured or free-text completion, callable from other backend code.
- [ ] Secrets are configured via `.env`/`.env.example`, never hardcoded.
- [ ] Basic guardrails exist (timeout, rate limit, or usage cap) so a bug can't produce an unbounded bill.
