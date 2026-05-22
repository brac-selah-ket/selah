# Conti Edit Sheet And Preset PDF Design

## Context

The current conti edit page only edits conti metadata through `ContiForm`. Per-song editing exists on the conti detail page through `ContiDetail` and `ContiSongEditor`. Song-level sheet music upload/gallery and preset PDF editing already exist in the songs area.

The selected direction is option A from the browser mockup: make the conti edit page a preparation workspace with conti metadata at the top and per-song preparation controls below it.

## Goals

- Let users register sheet music for each conti song from the conti edit page.
- Let users choose and save per-conti sheet music selections from the same flow.
- Let users edit each song preset's PDF metadata from the conti edit page.
- Reuse existing upload, gallery, selector, preset, and PDF editor behavior where possible.

## Non-Goals

- No database schema changes.
- No new PDF export format.
- No bulk editing across multiple songs in one modal.
- No change to the existing song detail edit page behavior.

## UX

`/contis/[id]/edit` will render the existing `ContiForm`, then a song preparation section for the songs in the conti. Each row shows the song name and current preparation state. The row exposes actions for editing song overrides, registering sheet music, and managing presets/PDF metadata.

Per-song editing should stay in a drawer/dialog flow instead of expanding all heavy controls inline. This keeps the page usable when a conti contains many songs and avoids rendering PDF thumbnails for every song at once.

When a user uploads a sheet music file while editing a conti song, the sheet music list refreshes immediately. If the conti song already has an explicit sheet music selection, the new file is appended to that selection. If the conti song uses the default "all sheet music" behavior, the new file is included by that existing default.

## Architecture

- `EditContiPage` should fetch the full conti with songs and all songs, matching the detail page data needs.
- `ContiDetail` should support a mode for edit-page usage so the existing song list and per-song drawer can be reused below `ContiForm`.
- `ContiSongEditor` should gain sheet music management controls:
  - uploader
  - compact editable gallery
  - refreshed file list after upload/delete
  - preset PDF edit entry point for the applied or selected preset
- A small reusable helper component can keep sheet music upload/gallery refresh logic out of the main drawer.
- Existing server actions remain the source of truth: `uploadSheetMusic`, `deleteSheetMusic`, `getSheetMusicForSong`, `updateContiSong`, `saveContiSongAsPreset`, and `updateSongPreset`.

## Data Flow

1. `EditContiPage` calls `getConti(id)` and `getSongs()`.
2. `ContiForm` edits only conti metadata.
3. `ContiDetail` renders the conti song list in edit workspace mode.
4. `ContiSongEditor` lazy-loads presets and sheet music when opened.
5. Upload/delete actions refresh the local sheet music array and call `router.refresh()` to update server-rendered views.
6. Preset PDF edits update the selected preset's `pdfMetadata` through the existing `PresetEditor`/`PresetPdfEditor` flow or a focused preset PDF dialog.

## Error Handling

- Upload, delete, preset update, and conti-song save failures should show existing toast errors.
- If a song has no sheet music, the drawer should still show an upload control and an empty state.
- If a user tries to edit preset PDF metadata without an applicable preset, the UI should guide them to save or select a preset first.

## Testing And Verification

The repository currently has no test runner configured. Verification will use:

- `pnpm lint`
- `pnpm build`
- Browser check on `/contis/[id]/edit` when a local data-backed route is available

Manual checks:

- Edit conti metadata still saves.
- Existing conti song drawer still opens from the detail page.
- Conti edit page shows song preparation rows.
- Uploading sheet music from a conti song editor refreshes the selector/gallery.
- Editing preset PDF metadata still opens the full-screen editor and saves metadata to the preset.
