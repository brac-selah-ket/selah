# Worship Prep Phase 2 QA Design

Date: 2026-06-06

## Summary

This design covers the second QA pass after the initial Storyboard UI/UX polish phase. It keeps the work in one phase but splits implementation into three focused streams:

1. Worship prep page spacing, card hierarchy, click-through behavior, and data-source labels.
2. Scripture reference modal with in-memory client caching and explicit refetch.
3. Song preset editor reliability around saved preset data, dirty-state accuracy, and sheet-music preview loading copy.

The goal is to make `/worship-prep` more useful as the login landing page while fixing a preset editor reliability issue that affects trust in the conti-to-preset workflow.

## QA Items Covered

- Align the top spacing on `/worship-prep` with other pages.
- Fix the connected conti card layout where the `완료` badge and conti text are visually stuck together.
- Make the connected conti card click through to the conti detail page.
- Make the displayed conti value act like a link to the conti detail page without creating nested-link problems.
- Show a top-right data-source marker on each worship prep card.
- Make scripture references fetch and display the scripture text in a modal.
- Cache fetched scripture text in memory and provide a `다시 불러오기` button that refetches.
- Emphasize card values more strongly and place them closer to the card title.
- Show loading copy instead of empty-state copy before sheet-music previews are ready in the song preset editor.
- Investigate and fix why data saved from conti editing into a preset can appear missing in the song preset editor.
- Investigate and fix why the song preset editor can show an unsaved-changes confirmation even when the user made no edits.

## Scope And Boundaries

This phase is intentionally smaller than the previous broad UI/UX pass. It should not introduce schema changes, rewrite shared editor architecture, or redesign the app shell.

The main expected files are:

- `app/(authenticated)/worship-prep/page.tsx`
- `components/worship-prep/prep-element-cards.tsx`
- `components/worship-prep/worship-date-selector.tsx`
- `lib/queries/worship-prep.ts`
- `lib/scripture/provider.ts`
- `components/shared/arrangement-editor/*`
- `components/shared/sheet-music-preview.tsx`
- `components/songs/preset-editor.tsx`
- `components/contis/conti-song-editor.tsx`
- `lib/actions/conti-songs.ts`
- `lib/actions/song-presets.ts`

The scripture provider already exists for PPT export and should be reused. The arrangement editor already has value-aware dirty-state logic and should be extended carefully instead of replaced.

## Worship Prep Layout And Cards

`/worship-prep` should feel consistent with the other authenticated pages. The date selector should not appear to float too far below the page header. Keep the `PageHeader` pattern, but tighten the vertical rhythm around the selector and automation panel.

The card grid can keep the existing responsive 3-column structure. Inside each card, change the information hierarchy:

- small category/source row at the top;
- card title;
- emphasized value directly under the title;
- completion badge as compact supporting metadata.

The value text should be stronger than the current muted small text. Use a consistent style for all cards, including role values, sermon title, scripture reference, song list, and connected conti.

The status badge and value must always have explicit spacing, for example a flex row with `gap-2`, so the connected conti card never renders like `완료재광`.

### Data Source Markers

Each card should show its data source at the top-right.

Sheet-derived cards should show `구글 시트`. The connected conti card should show `콘티`. Prefer existing project icon conventions from `@hugeicons/react`; if there is no suitable Google-specific icon, use a small text badge first and adjust visually during browser QA.

The marker is informational only. It should not become a clickable control.

### Connected Conti Click Behavior

When `conti` exists, the whole connected conti card should navigate to `/contis/{conti.id}`. The displayed conti value should look link-like, but implementation should avoid invalid nested anchors.

Acceptable implementations:

- render the entire card as a single `Link` and style the value with underline-on-hover;
- or render a clickable card with router navigation and stop propagation only for future nested controls.

Because this card currently has no child buttons, the single-link card is preferred. If future controls are added, they must keep their own behavior and not trigger card navigation accidentally.

## Scripture Modal

When `item.scripture` has a value, the scripture card should be clickable. The modal opens immediately and shows loading state while the scripture text is fetched.

The fetch path should reuse the existing scripture parsing/fetching implementation in `lib/scripture/provider.ts`. Add a thin server action that accepts the displayed scripture reference string, parses it, calls the provider, and returns a serializable result. This matches the existing mutation/query action style used elsewhere in the app and avoids adding a route handler for one UI interaction.

The client component should keep an in-memory cache keyed by the normalized scripture reference string. Opening the same scripture reference again should use cached data immediately. The modal must include a `다시 불러오기` button that bypasses or replaces the cached entry by fetching again.

Modal states:

- loading: show a short loading message;
- success: show the reference title and verses with verse numbers;
- error: show the error message and `다시 불러오기`;
- empty result: show that no text was found and `다시 불러오기`.

Outside-click close should follow the ordinary dialog behavior. This modal is informational and does not need alert-dialog style forced decisions.

## Song Preset Editor Reliability

The preset reliability work starts with root-cause verification before code changes. There are two reported symptoms:

1. A user edits a conti song, saves it to a preset, then opens that preset from the song library and sees missing arrangement information.
2. A user opens the song preset editor and closes it without edits, but the unsaved-changes confirmation appears.

Treat these as related but separate bugs until data proves otherwise.

### Preset Save And Reload Data Flow

Trace the full path:

1. `components/contis/conti-song-editor.tsx` prepares the draft and calls `saveContiSongAsPreset`.
2. `lib/actions/conti-songs.ts` reads `getContiSongPresetSource` and passes overrides into `createSongPreset` or `updateSongPreset`.
3. `lib/actions/song-presets.ts` writes JSON fields and sheet-music associations through the repository.
4. `components/songs/preset-editor.tsx` converts the loaded `SongPresetWithSheetMusic` back into an `ArrangementDraft`.

The implementation should determine whether the missing information is caused by the save source, repository persistence, query hydration, JSON parsing, or draft conversion. Do not assume it is a UI-only issue.

Add focused diagnostics or tests around the broken path before patching. The expected saved fields are keys, tempos, section order, lyrics, section-to-lyrics map, notes, sheet-music file IDs, PDF metadata, and YouTube metadata where applicable.

### Dirty-State Accuracy In The Preset Editor

The shared `ArrangementEditor` compares a normalized initial draft with the current draft. The song preset editor may still become dirty if initial data is reshaped after open, especially around sheet-music selection semantics, preview state, or `[]` versus `null` sheet-music file IDs.

The fix should keep these rules:

- opening and closing an untouched preset editor must not show the unsaved-changes dialog;
- preview-only changes must not count as edits;
- async sheet-music preview preparation must not count as edits;
- semantically equivalent all-sheet-music selections must compare equal;
- real edits to preset name, keys, tempos, section order, lyrics, mappings, notes, YouTube reference, PDF metadata, default flag, or sheet-music selection must count as edits.

Prefer strengthening the dirty normalization and editor initialization contract over adding ad hoc bypasses to close handlers.

### Sheet-Music Preview Loading Copy

`SheetMusicPreviewPane` already supports `loading`. The song preset editor should pass a loading state, or an equivalent loading preview item, while the first preview selection is still being prepared. The copy `미리볼 악보를 선택하세요.` should only appear after loading has finished and there is truly no selected preview item.

This should be verified in the song library preset editor, not only in the conti song editor.

## Error Handling

- If scripture parsing fails, show a clear modal error and keep `다시 불러오기` available.
- If scripture fetching times out or fails, surface the provider error text rather than hiding it behind a generic empty state.
- If the connected conti does not exist, keep the current non-clickable empty state.
- If preset save-to-library fails, keep the existing toast/error behavior and do not clear local editor state.
- If preset reload returns malformed JSON, keep safe fallbacks but make sure valid saved fields are not silently dropped.

## Testing And Verification

Add or update focused tests where feasible:

- scripture fetch action parses supported references and rejects invalid ones;
- scripture cache behavior can be covered through component-level logic if extracted into a small helper;
- arrangement dirty-state treats untouched preset editor state as clean;
- all-sheet-music `null` and equivalent selected IDs normalize consistently;
- conti-to-preset saved data round-trips into `presetToDraft`.

Run available project checks:

- `pnpm lint`
- relevant test command if present, or focused `tsx`/Vitest command for touched tests.

Use the in-app browser for UI smoke checks:

- `/worship-prep` top spacing matches nearby pages better.
- Worship prep card values are more prominent and visually close to titles.
- All card data-source markers render without crowding.
- Connected conti card navigates to the correct conti detail page.
- Scripture card opens a modal, shows loading, renders verses, uses cached data on reopen, and refetches via `다시 불러오기`.
- Song preset editor shows loading copy before sheet-music preview is ready.
- Opening and closing an untouched song preset editor does not show the unsaved-changes dialog.
- Saving conti song edits to a preset, then opening that preset from the song library, shows the saved arrangement fields.

## Implementation Notes

Keep visual changes restrained and consistent with the existing app. The worship prep cards should become clearer and more scannable, not decorative.

For the scripture modal, avoid prefetching every card. Fetch only when the user opens a scripture reference, then cache in memory for that browser session.

For preset reliability, start by reproducing and identifying whether the database contains the expected data. A fix that only masks the UI symptom is not sufficient if the save path is dropping values.

This design is ready to be converted into an implementation plan after user review.
