# Epic: TikTok Video → Location Save

**Priority:** P2
**Status:** EXPLORATORY — not committed. Do not begin implementation without an explicit go-ahead.

## Why

Considered as a swap-in for the earlier "plan a date" flow idea. The concept: saving a TikTok video pins a location to the map, and the video can be replayed from that place later — e.g. a couple saves restaurant/travel-spot videos they want to visit, tied to a map pin. This may or may not actually get built; it's here so the shape of it is written down, not because it's scheduled.

## Scope (if pursued)

- A way to get a TikTok link into the app (share-sheet target, or paste-a-link flow) and turn it into a `Place` with an attached video reference.
- Playback of the saved video from the place detail view.

## Known unknowns to resolve before committing

- TikTok has no public API for extracting a geographic location from an arbitrary video — location would almost certainly need to be manually pinned by the user (paste link → app opens map → user drops a pin), not auto-extracted. Confirm this UX is acceptable before committing to the idea at all.
- Embedding/playing TikTok video content in-app may require TikTok's oEmbed endpoint, or simply deep-linking out to the TikTok app. These have different build costs and different ToS/review considerations — decide which before building capture/playback.

## Tickets

- [TIKTOK-1: Feasibility spike](./tickets/01-feasibility-spike.md) — **do this first; it's a go/no-go gate for the rest of the epic.**
- [TIKTOK-2: Data model](./tickets/02-data-model.md)
- [TIKTOK-3: Capture flow](./tickets/03-capture-flow.md)
- [TIKTOK-4: Playback from place detail](./tickets/04-playback.md)
