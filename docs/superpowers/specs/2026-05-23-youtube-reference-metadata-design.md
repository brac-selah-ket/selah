# YouTube Reference Metadata Design

## Context

The unified arrangement editor now exposes a YouTube reference field for both song presets and conti song editing, but the visible behavior is still inconsistent.

- Song library preset cards show a `YT` badge and a YouTube link.
- Song preset edit drawers show the stored video ID instead of a full link.
- Conti detail rows do not show any YouTube reference.
- Conti song edit drawers start with an empty YouTube field even when the applied preset has a reference.

This creates confusion because users cannot tell whether a conti song already has a useful reference unless they open or save through a preset flow.

## Goals

- Show YouTube references consistently across the song library, song picker, conti detail, and shared editor drawer.
- Store enough metadata that users see a recognizable video title, not only a video ID or raw URL.
- Keep the UI compact: when metadata exists, show only the title, and make the title itself the hyperlink.
- Avoid adding a separate per-conti-song YouTube ownership model unless a future workflow clearly needs it.

## Non-Goals

- Do not embed video players.
- Do not show thumbnails in the first version.
- Do not store per-conti-song YouTube overrides.
- Do not make page rendering depend on live YouTube API calls.

## Data Model

Add a cached metadata field to song presets:

- `song_presets.youtube_title text`

The existing `song_presets.youtube_reference` remains the canonical stored video ID. The title is descriptive metadata for display only.

If `youtube_reference` is null, `youtube_title` is treated as null. If the title lookup fails, the app saves the video ID and displays the canonical fallback URL.

## Server Behavior

Create a helper that resolves a YouTube reference into:

- `videoId`
- `url`
- `displayUrl`
- `title | null`

The helper accepts either a full URL or a video ID. It uses the existing parser for validation and calls the YouTube Data API only when a valid video ID exists and a title lookup is needed.

Write paths:

- YouTube playlist import already receives item titles; save that title directly with the preset.
- Song preset create/update normalizes the submitted reference and stores `youtube_reference = videoId`, `youtube_title = resolved title`.
- Conti "save as preset" / "update preset" uses the same normalization and metadata write path.
- Clearing the field clears both reference and title.

Read paths:

- Song preset queries include `youtubeTitle`.
- Conti list/detail summary queries join the applied preset and expose `youtubeReference` plus `youtubeTitle`.
- Conti song editor initial state derives the display reference from the applied preset when the conti song does not own a separate value.

## UI Behavior

Use one shared display component named `YouTubeReferenceLink`.

Rules:

- If `youtubeTitle` exists, render only the title as a link.
- If `youtubeTitle` is missing but the reference is valid, render the canonical compact URL as a link.
- If the reference is invalid or empty, render nothing.
- The link opens the canonical watch URL in a new tab.

Surfaces:

- Song library preset cards: replace `YT` badge + `YouTube: <url>` with one linked title line.
- Song picker preset step: show the linked title below the preset name.
- Conti detail/action table: add a compact YouTube column, showing the linked title when the applied preset has a reference.
- Conti list expanded preview: use the same table behavior.
- Shared arrangement editor: show the input value as a full canonical URL when editing an existing video ID.

## Editor Flow

The editor draft continues using a single `youtubeReference` string, but initial drafts convert stored video IDs to full canonical watch URLs for readability.

On save:

- Validate and normalize the input.
- Store the video ID.
- Store the fetched or submitted title where available.

When a conti song loads a preset:

- The drawer updates the YouTube input to the preset's canonical URL.
- The saved conti override continues to store arrangement fields only.
- The preset metadata is updated only when the user explicitly saves/updates a preset.

## Error Handling

- Invalid YouTube input blocks save with the existing validation toast.
- API/title lookup failure does not block saving a valid video ID.
- If `YOUTUBE_API_KEY` is missing, save the video ID and leave title null.
- UI must gracefully fall back to compact URL display when title is unavailable.

## Testing

- Unit tests for metadata normalization and fallback behavior.
- Server action tests or focused coverage for clearing reference/title together.
- Browser smoke checks:
  - Song preset card shows a linked title only.
  - Preset edit drawer shows a full canonical URL in the input.
  - Conti detail and conti list expanded rows show the same linked title.
  - Song picker preset step shows the same linked title.
