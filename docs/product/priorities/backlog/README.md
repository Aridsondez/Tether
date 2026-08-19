# Backlog

Carried forward from the original audit pass, not touched in this reprioritization. Not written up as epics/tickets yet — pull from here when there's a concrete reason to scope one.

## Unbuilt product-doc feature areas

None of these have any schema, endpoints, or screens today:

- **Wishlists & shopping**
- **Memories & relationship history**
- **Tasks & responsibilities**
- **Relationship check-ins**
- **Shared decisions**

## Smaller, deferred without much cost

- **Finances**: no contribution/split tracking between partners, no savings-goal concept (e.g. a "trip fund").
- **Map**: no multi-stop routing, no travel-time display between saved places.
- **Timeline/Goals**: no photos or linked-expense fields on items (may get partially addressed opportunistically by the [Timeline → Goals](../p2/timeline-to-goals/epic.md) rework, but not a stated requirement of it).

## Remember, not urgent

- **Android Google Maps key**: `apps/mobile/app.json` has `android.config.googleMaps.apiKey` set to the literal placeholder `"REPLACE_WITH_ANDROID_GOOGLE_MAPS_SDK_KEY"`. The rest of the Android config (package id, adaptive icons) is already filled in. `react-native-maps` has no non-Google renderer on Android, so the Map tab will not render at all on Android until a real key is generated and restricted (via Google Cloud Console) to `com.tether.app` + the release signing fingerprint. Not a live bug today since Android isn't currently a build target — just don't forget it the day that changes.
