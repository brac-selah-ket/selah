# Mashup Conti Presets Design

Date: 2026-06-19
Status: Approved design for implementation planning

## Summary

Add first-class support for two-song mashup presets. A mashup preset is one shared preset that appears on both participating song detail pages, carries one shared sheet-music/PDF layout, and can be applied to two adjacent songs in a conti as one worship order item.

The selected direction keeps `song_presets` as the canonical preset body and adds a `song_preset_songs` join table so a preset can belong to one or more songs. The first implementation supports exactly two-song mashups in the UI, while the relation model remains ordered and can later support longer medleys.

## Context

The current model treats every preset as owned by one song:

- `song_presets.song_id` points to a single `songs.id`.
- `preset_sheet_music` points to a preset and one or more sheet-music files.
- `conti_songs.preset_id` applies one preset to one conti song row.
- PDF export currently uses `conti.songs` indexes to generate pages and overlay numbers.
- PPT export currently turns each conti song with section order into an independent `찬양 N` section.

That model works for one song, but it cannot represent a real mashup case where song A and song B both exist in the library, both should show the same mashup preset, and the conti should use one shared PDF layout.

## Goals

- Let one preset be associated with both participating songs.
- Show the same mashup preset in both song detail pages.
- Allow creating a mashup preset from a song detail page by searching or creating the linked song.
- Allow connecting adjacent songs during YouTube playlist import review.
- Allow connecting adjacent songs inside an existing conti.
- Treat a mashup group as one order item in conti display, PDF export, and PPT export by default.
- Use the mashup preset's sheet-music selection and PDF metadata once, not once per song.
- Let users split an applied mashup group without deleting the preset.
- Let users choose whether split restores the previous per-song presets or clears presets.
- Add a customizable PPT/display title for mashup presets.

## Non-Goals

- No support for non-adjacent conti song grouping.
- No UI support for three-or-more-song medleys in this phase.
- No automatic deletion of mashup presets when a conti group is split.
- No broad redesign of the arrangement editor beyond adding mashup-specific controls.
- No migration that immediately removes `song_presets.song_id`; keep it for compatibility during this phase.

## Selected Approach

Use `song_presets` as the canonical preset entity and add a join table for preset-song ownership.

Alternatives considered:

- Replacing `song_presets.song_id` with JSON `song_ids` would make the schema look smaller, but it would lose FK validation, cascade semantics, and clean song-to-preset lookup.
- Keeping separate A-song and B-song presets tied by a `mashupGroupId` would preserve the current one-song ownership model, but the two records could drift and would not satisfy the requirement that the PDF layout is truly shared.

The join table gives a single shared preset body while keeping relational integrity and direct lookup from either song.

## Data Model

### Preset Ownership

Add `song_preset_songs`:

- `id`
- `preset_id` references `song_presets.id` with cascade delete
- `song_id` references `songs.id` with cascade delete
- `sort_order` for the song's position inside the preset
- nullable `part_label`, written as `null` in the first implementation and reserved for future part labels

Unique constraints:

- `(preset_id, song_id)` to prevent duplicate song links
- `(preset_id, sort_order)` to keep the ordered parts unambiguous

Backfill one row for every existing preset using the current `song_presets.song_id` and `sort_order = 0`.

Keep `song_presets.song_id` in this phase as a legacy primary song field. New code should use `song_preset_songs`; legacy code can still treat `song_id` as the first linked song. Removing the legacy column is explicitly out of scope for this phase.

### Preset Type And Title

Add to `song_presets`:

- `preset_type`: `single` or `mashup`, default `single`
- `display_title`: nullable text

A mashup preset must have exactly two linked songs in this phase. Its default display/PPT title is the first linked song's name. If `display_title` is set, use it for the group title and PPT title.

### Conti Mashup Application

Add to `conti_songs`:

- `mashup_group_id`: nullable text shared by the two grouped rows
- `mashup_part_order`: nullable integer, `0` for the front song and `1` for the following song
- `pre_mashup_preset_id`: nullable preset reference used only to restore the row when splitting

When two adjacent conti rows are connected:

- Generate one `mashup_group_id`.
- Set both rows' `preset_id` to the shared mashup preset.
- Set `mashup_part_order` according to the row order.
- Store each row's previous `preset_id` in `pre_mashup_preset_id`.

When a mashup is split:

- Read the saved `pre_mashup_preset_id` values before mutating either row.
- Confirm with the user and offer two choices: restore previous presets or split without presets.
- If restoring, set each row's `preset_id` back to its saved `pre_mashup_preset_id`.
- If clearing, set both rows' `preset_id` to `null`.
- Always clear `mashup_group_id`, `mashup_part_order`, and `pre_mashup_preset_id` after deciding the new `preset_id` values.
- Do not delete the mashup preset.

## UX

### Song Library

Song detail pages add a "매시업 프리셋 추가" action.

Flow:

1. Search for the linked song.
2. If the linked song does not exist, create it inline.
3. Choose whether the current song is the first or second song.
4. Create a mashup preset linked to both songs in that order.
5. Open the shared arrangement editor for keys, tempos, sections, lyrics, sheet music, PDF metadata, notes, YouTube reference, and `display_title`.

Both song detail pages show the same preset with a "매시업" label. Editing it from either page edits the same preset.

### YouTube Playlist Import

In the playlist review step, show a mashup button between adjacent import items.

When clicked:

- Resolve the two items to existing songs or stage new-song creation before the preset search/apply step.
- Search for a `preset_type = mashup` preset whose linked song order matches those two songs.
- If matching presets exist, let the user choose one.
- If none exist, allow creating a blank mashup preset for that pair.
- Mark the two review items as connected so the created conti applies the shared preset and group metadata.

Duplicate detection remains in place. A review item that is excluded cannot be part of a mashup.

### Conti Detail And Edit

For ungrouped adjacent songs, show a connection affordance between rows. Clicking it searches for an ordered mashup preset for those two songs. If one exists, apply it; if none exists, offer to create a blank mashup preset.

Grouped rows render as one visually thicker mashup row:

- The group occupies one visible order number.
- The row shows a "매시업" label and the group title.
- The front and following song remain visible inside the row.
- A highlighted "이어지는 매시업 프리셋" strip appears between the inner song parts.
- Clicking the strip opens the split confirm dialog.

The split dialog offers "원래 프리셋 복원" and "프리셋 없이 분리".

## Derived Arrangement Items

Introduce a derived view model for display and export:

- Single item: one conti song.
- Mashup item: two conti songs with the same `mashup_group_id`, ordered by `mashup_part_order`.

This view model should have a stable item key:

- single: `conti-song:<contiSongId>`
- mashup: `mashup:<mashupGroupId>`

Existing components that need raw rows can still use `conti.songs`. UI tables, PDF export, and PPT export should use the derived arrangement items when they care about visible order.

## Export Behavior

### PDF

PDF export/editor treats a mashup item as one order item.

- Use the shared mashup preset's selected sheet music.
- Use the shared mashup preset's `pdfMetadata`.
- Generate those pages once.
- Use the visible arrangement item index for overlay song numbers.
- Syncing PDF metadata from a conti layout writes back to the shared mashup preset.

The PDF editor should resolve saved layouts by stable arrangement item key where possible. Existing index-based `songIndex` can remain for backward compatibility, but new mashup behavior should avoid assuming that one visible order item equals one raw `conti_songs` index.

### PPT

Default PPT export merges a mashup item into one praise section.

- Section name remains generated as `찬양 N`.
- Song title is `display_title` when set.
- If no `display_title` exists, use the first linked song's name.
- Section order, lyrics, and section-lyrics map come from the shared mashup preset arrangement data.

The PPT export UI should offer a "매시업 분리 내보내기" option. When enabled, mashup groups are exported as separate song sections using the current per-row behavior.

## Validation And Error Handling

- Mashup creation requires exactly two linked songs in this phase.
- Conti connection requires two adjacent, ungrouped rows.
- A row already in a mashup group must be split before being connected to another row.
- A mashup preset match requires `preset_type = mashup` and the same ordered song pair.
- If a selected mashup preset's linked songs do not match the two conti rows, block application and show a toast.
- If linked sheet music no longer exists, show the existing sheet music empty state and prevent PDF generation until corrected.
- If split restore references a deleted previous preset, restore what still exists and clear missing references.
- Mutation failures use the existing server action result/toast pattern.

## Testing And Verification

Focused tests should cover:

- Backfilling `song_preset_songs` from existing `song_presets.song_id`.
- Querying presets for a song through `song_preset_songs`.
- Creating a mashup preset from either song order.
- Finding mashup presets by ordered song pair.
- Applying a mashup to adjacent conti rows.
- Rejecting non-adjacent or already-grouped rows.
- Splitting with previous preset restore.
- Splitting with presets cleared.
- Rendering the derived arrangement item view model.
- PDF export/editor generating one page set for a mashup group.
- PPT export merging mashups by default.
- PPT export separating mashups when the option is enabled.
- YouTube import review connecting adjacent items and creating/applying the shared preset.

Verification commands for implementation should include:

- `pnpm lint`
- targeted Vitest tests for repository helpers, view-model helpers, PDF/PPT helpers, and import-state behavior

## Implementation Notes

The implementation should stay close to existing patterns:

- Server actions continue returning `{ success, error, data }`.
- Repository interfaces get explicit mashup preset and conti group methods.
- Neon and Turso schemas/migrations must stay in sync.
- JSON text columns may continue for arrangement data, but relationship data should use relational tables.
- Existing arrangement editor should be extended rather than duplicated.
