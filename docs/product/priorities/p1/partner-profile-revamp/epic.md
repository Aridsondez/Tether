# Epic: Partner Profile Revamp (About Us / About Partner / Preferences)

**Priority:** P1
**Status:** Not started

## Why

The current partner-facing features (partner notes, preferences) are flat `label` + `note` text strings in a list — functional but not impactful. The product's vision is a rich, structured partner profile. This epic makes that real so it (a) reads as more meaningful to users on its own, and (b) becomes something the AI Assistant epic can actually extract into and reason over — structured fields work far better than free text for that.

## Scope

- A structured schema for partner profile data (categories like sizes, love language, important dates, allergies, etc.) replacing/extending the current flat preference/partner-note model.
- A visual (not list-based) presentation for "About Us" (relationship-level: milestones, time-together stats, shared info) and "About [Partner]" (individual: their structured profile).
- A rework of the Preferences UI (likes/dislikes/gift ideas) to feel like a real profile rather than a notes list.

## Out of scope

- The full visual redesign — separate, later workstream. This epic ships a data model plus a reasonably better visual layer now, understanding the eventual full redesign may revisit the surface again.
- AI-driven capture itself (that's [AI-2](../ai-assistant/tickets/02-nl-preference-capture.md)) — this epic just needs to produce a schema AI-2 can target.

## Acceptance Criteria

- [ ] Partner-facing data (preferences + partner notes) supports structured fields per category, not just free-text label/note.
- [ ] "About Us" presents relationship info visually (timeline of milestones, days-together stat, shared facts) rather than as a plain text list.
- [ ] "About [Partner]" presents their structured profile visually, grouped by category.
- [ ] Preferences screen groups/displays likes/dislikes/gift-ideas in a way that reads as a profile, not a running notes list.
- [ ] Existing preference/partner-note data migrates cleanly into the new structure — no data loss.

## Tickets

- [PROFILE-1: Structured schema design](./tickets/01-structured-schema.md)
- [PROFILE-2: Data migration](./tickets/02-data-migration.md)
- [PROFILE-3: "About Us" visual rework](./tickets/03-about-us-rework.md)
- [PROFILE-4: "About [Partner]" visual rework](./tickets/04-about-partner-rework.md)
- [PROFILE-5: Preferences visual rework](./tickets/05-preferences-rework.md)
