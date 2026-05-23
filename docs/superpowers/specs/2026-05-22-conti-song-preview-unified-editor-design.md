# Conti Song Preview And Unified Editor Design

Date: 2026-05-22
Status: Approved design for implementation planning

## Summary

Improve the desktop conti UX while preserving the current list-oriented feel. The selected direction keeps the calm `A`-style conti list, adds expandable per-conti song summaries as compact tables, and unifies conti-song editing with song-preset editing through one shared arrangement editor.

The implementation should use the recommended `R` approach: a shared editor UI and draft model with context-specific save adapters. This fixes the current feature-drift problem without changing the meaning of existing `conti_songs` overrides or `song_presets`.

## Context

The current desktop UX is clean but sparse. `/contis` shows date/title rows only, so users cannot inspect song choices without opening a conti. `/contis/[id]` shows song rows, but the detail experience and list experience do not share a preview pattern.

There is also a structural product problem: conti song editing and song preset editing use different outer components.

- `ContiSongEditor` handles conti overrides, preset loading, sheet music registration, preset PDF editing, and "save as preset" behavior.
- `PresetEditor` handles preset fields, sheet music selection, PDF metadata, YouTube reference, and default preset state.
- `OverrideEditorFields` is shared, but much of the user-facing editing shell is duplicated outside it.

Because new features often attach to one editor shell but not the other, the same song arrangement concept can drift across the conti and preset workflows.

## Goals

- Keep the current conti list's simple desktop feel.
- Let users expand a conti row to inspect its songs without navigating away.
- Use a compact mini-table, not large cards or a carousel, for expanded song information.
- Make the conti detail song list use the same table language as the expanded conti preview.
- Unify conti-song editing and song-preset editing around one shared editor UX.
- Preserve the current data model: conti song overrides remain independent after a preset is applied.
- Display YouTube references as usable links, not opaque video IDs or small `YT` badges only.
- Allow users to paste full YouTube URLs when editing preset-specific YouTube references.

## Non-Goals

- No database schema change in this phase.
- No migration to "preset as canonical source of truth" semantics.
- No automatic propagation of preset edits into existing contis.
- No redesign of the full PDF export workspace beyond preserving existing preset PDF metadata editing entry points.
- No new drag-and-drop reorder model in this phase.
- No mobile-first redesign; mobile should remain functional, but the primary target is desktop UX.

## Selected Approach

Use a shared arrangement editor with context adapters.

The shared editor owns the editing draft and UI sections. Adapters own loading, saving, revalidation, and context-specific actions.

This keeps `conti_songs` and `song_presets` behavior stable while preventing future UI features from being implemented in only one place.

The larger alternative, making `song_presets` the canonical source and storing only per-conti diffs in `conti_songs`, is intentionally out of scope. That model would require broader DB, query, export, import, and deletion behavior decisions.

## UX

### Conti List

`/contis` remains a list of conti rows. Each row shows:

- Date
- Title
- Description or empty-state copy
- Song count
- Key summary
- Preparation summary such as sheet music or PDF availability when cheaply available
- A "곡 보기" expand control
- An "열기" navigation affordance

When expanded, the row reveals a compact song preview table:

- Order
- Song name
- Key
- BPM
- Section summary
- Preset state or preset name

The expanded table is read-oriented. It should avoid heavy controls and should not load expensive media thumbnails. Clicking "열기" still navigates to the conti detail page.

### Conti Detail

`/contis/[id]` uses the same song table language, but with more actions enabled:

- Edit song arrangement
- Move up/down or existing reorder action
- Remove from conti
- Add song
- Import from YouTube

The table should be stable and dense enough for desktop scanning. It can still use existing icon actions, but the information columns should match the list preview where possible.

### Unified Arrangement Editor

Conti-song editing and preset editing should feel like the same tool. The editor title and save copy differ by context, but the internal layout is shared.

Editor sections:

- Basic: name or context label, key, tempo, YouTube link, default preset toggle when in preset context
- Sheet music: upload or select available sheet music depending on context capabilities
- Sections and lyrics: existing key/tempo, section order, lyrics pages, and section-lyrics mapping controls
- PDF: existing preset PDF metadata editing entry point
- Notes: arrangement notes

For conti-song context:

- Primary save means "이 콘티에만 저장".
- A separate action allows saving as a new preset or updating an existing preset.
- Loading a preset into the conti song should clearly warn that the current conti-song draft will be overwritten.

For preset context:

- Primary save creates or updates the preset.
- Default preset and preset name controls are visible.
- Sheet music selection, PDF metadata, and YouTube link save directly to the preset.

## YouTube Links

The UI should treat YouTube references as links.

Users may paste either a full YouTube URL or a video ID. The editor normalizes this input for storage while displaying a clickable URL in the UI.

Preset lists, preset pickers, and conti-song preset sections should show a usable YouTube link or a clear shortened URL, not only a `YT` badge. If space is limited, show a shortened display value such as `youtube.com/watch?v=...` while keeping the full `href`.

Existing `youtubeReference` storage can remain compatible with video IDs. Conversion helpers should centralize:

- Extracting a video ID from supported YouTube URL formats.
- Building a canonical watch URL for display.
- Validating that unsupported text is either rejected or shown with an explicit error.

## Architecture

### Shared Draft Model

Introduce a shared draft shape for song arrangement editing. It should cover the fields common to conti overrides and presets:

- `keys`
- `tempos`
- `sectionOrder`
- `lyrics`
- `sectionLyricsMap`
- `notes`
- `sheetMusicFileIds`
- `pdfMetadata`
- `youtubeReference` or a normalized YouTube field

Preset-only fields such as `name` and `isDefault` can live in the same editor draft as optional context fields.

### Shared Editor

Create a shared editor component, with a final name chosen during implementation, responsible for:

- Rendering the common tab or section layout.
- Owning draft state and dirty-state behavior.
- Rendering existing arrangement controls, including `OverrideEditorFields`.
- Rendering sheet music controls through existing upload, selector, and gallery components.
- Rendering the YouTube link field consistently.
- Opening the existing preset PDF editor where applicable.
- Calling adapter callbacks for save, close, preset load, and preset update actions.

`ContiSongEditor` and `PresetEditor` should become thin wrappers around this shared editor instead of separate full editing surfaces.

### Context Adapters

The conti-song adapter should:

- Convert `ContiSongWithSong.overrides` into the shared draft.
- Lazy-load presets and sheet music as needed.
- Save the draft through `updateContiSong`.
- Provide the "save as preset" and "update preset" actions through existing preset actions.
- Revalidate conti routes after save.

The preset adapter should:

- Convert `SongPresetWithSheetMusic` into the shared draft.
- Save through `createSongPreset` or `updateSongPreset`.
- Preserve default preset behavior.
- Revalidate song routes after save.

### Summary Tables

Create a reusable conti song summary table component for read and action modes.

Read mode is used inside expanded `/contis` rows. Action mode is used in `/contis/[id]` and edit-related conti screens. Both modes share column formatting, empty handling, key/BPM badges, section truncation, and preset display.

## Data Flow

### Conti List Preview

1. `/contis` fetches contis with enough song summary data to render expanded previews.
2. Each conti row owns its expanded/collapsed UI state client-side.
3. Expanded content renders the shared summary table in read mode.
4. Navigation to detail remains explicit through the row link or "열기" affordance.

If fetching all song details for all contis is too expensive, implementation may start with the current list payload plus lazy-loaded song summaries per expanded row. The user-facing behavior should remain the same.

### Conti Song Edit

1. The conti song wrapper converts overrides to a shared draft.
2. The shared editor manages edits and dirty state.
3. Primary save calls the conti-song adapter.
4. Save success resets dirty state and refreshes the relevant route.
5. Preset save/update actions convert the same draft into preset payloads.

### Preset Edit

1. The preset wrapper converts preset data and sheet music IDs into a shared draft.
2. The shared editor manages edits and dirty state.
3. Primary save calls the preset adapter.
4. Save success resets dirty state and refreshes the song detail route.

## Error Handling

- Save failures show existing toast errors and keep the draft open.
- Dirty close confirmation is shared.
- Preset load confirmation must be explicit because it overwrites the current draft.
- YouTube URL parsing errors should be field-level errors or blocking toast messages before save.
- Missing sheet music should show an upload or empty state, not hide the sheet music section.
- PDF metadata editing should remain unavailable only when there is no usable sheet music context, and the UI should explain that state.

## Testing And Verification

Automated and command verification:

- `pnpm lint`
- `pnpm build`

Manual browser checks:

- `/contis` shows expandable rows with compact song preview tables.
- Expanding and collapsing conti rows does not shift the page awkwardly.
- `/contis/[id]` uses the same song table pattern and still supports edit/remove/reorder actions.
- Conti-song editing opens the shared editor and saves conti-only changes.
- Preset editing opens the same shared editor and saves preset changes.
- A feature visible in the shared editor, such as the YouTube link field, appears in both contexts.
- Full YouTube URLs and video IDs both save and display as clickable YouTube links.
- Preset loading into a conti song warns before overwriting current draft.
- Sheet music selection and preset PDF metadata editing still work in both supported contexts.

Visual checks:

- Desktop tables fit without text overlap at common widths.
- Long Korean song names truncate cleanly.
- YouTube links do not overflow their containers.
- Mobile remains usable even if the expanded preview table stacks or scrolls horizontally.

## Implementation Boundaries

Likely touched areas:

- `app/(authenticated)/contis/page.tsx`
- `app/(authenticated)/contis/[id]/page.tsx`
- `components/contis/conti-list.tsx`
- `components/contis/conti-card.tsx`
- `components/contis/conti-detail.tsx`
- `components/contis/conti-song-item.tsx`
- `components/contis/conti-song-editor.tsx`
- `components/songs/preset-editor.tsx`
- `components/songs/preset-list.tsx`
- shared editor components under `components/shared/` or a new focused subfolder
- YouTube helper utilities under `lib/utils/`
- conti/song query helpers if expanded previews require additional summary data

Avoid schema changes and unrelated visual redesigns in this phase.
