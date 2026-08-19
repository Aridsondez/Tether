# TIKTOK-2: Data model

**Epic:** [TikTok Video → Location Save](../epic.md) (exploratory — only start if TIKTOK-1 is a "go")

## Description

Add optional video-source fields to `places`.

## Acceptance Criteria

- [ ] `places` (or a linked table) can store a source video URL/type without breaking existing place-creation flows that have no video.
