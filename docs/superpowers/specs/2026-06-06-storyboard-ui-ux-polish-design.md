# Storyboard UI/UX Polish Design

Date: 2026-06-06

## Summary

This design covers a focused UI/UX polish pass for Storyboard. The work is implemented in two phases:

1. Fix existing navigation, list density, drawer, modal, dirty-state, loading-copy, and label issues.
2. Add an inline YouTube playlist import wizard to the new conti creation screen while reusing the existing import review logic.

The goal is to make high-frequency worship preparation workflows denser, less surprising, and easier to complete without changing the database schema.

## QA Items Covered

- Move `예배 준비` to the top of the sidebar and make it the login/default landing page.
- Hide the fake `설명이 없는 콘티입니다` text unless a real conti description exists, and reduce conti row height.
- Open the conti-song editor when clicking a song row, without interfering with row buttons or YouTube links.
- Show an accurate sheet-music loading state before previews are ready.
- Restore outside-click close behavior for ordinary modals and drawers.
- Prevent drawer layout from compressing and breaking the underlying page.
- Only show the unsaved-changes dialog when a real edit occurred.
- Add YouTube playlist import to `/contis/new`.
- Rename the conti `title` field to `인도자` everywhere it is exposed as an editable/user-facing field, without renaming the DB column.
- Convert the song library list to a responsive grid-card view.
- When importing playlist videos into an existing preset that already has a YouTube reference, default to keeping the existing reference and allow explicit replacement.
- Preserve the originally requested URL across auth redirects.

## Phase 1: Existing UX Fixes

### Navigation And Auth Redirects

`components/layout/sidebar.tsx` should list `예배 준비` first, followed by `콘티 목록` and `찬양 라이브러리`.

`app/page.tsx` should redirect `/` to `/worship-prep`. The login form already routes to `/`, so successful login will land on worship prep by default.

Middleware should preserve protected destination URLs. If an unauthenticated user visits `/contis/abc?tab=songs`, middleware redirects to `/login?next=%2Fcontis%2Fabc%3Ftab%3Dsongs`. Preserve `pathname + search`. URL fragments cannot be preserved by middleware and are out of scope. After successful login, `components/auth/login-form.tsx` reads `next`, accepts only internal paths beginning with `/` and not `//`, then routes there. If `next` is missing or unsafe, the fallback is `/worship-prep`.

### Conti List Density

`components/contis/conti-card.tsx` should stop rendering placeholder copy for empty descriptions. Real sanitized descriptions still render as one line. If no description exists, the song/key summary moves directly under the title. Row padding should be tightened so the list shows more contis per viewport.

The field currently stored as `contis.title` remains unchanged in schema and action payloads. In product language, this value represents the worship leader. UI copy should call the field `인도자` where the user is editing or reading it as conti metadata, including new/edit forms and placeholders. Existing primary displays that show the value itself, such as conti cards and detail headers showing `재광`, can keep using that value as the primary human label. Do not introduce `제목` as the label for this field, and do not rename unrelated titles such as sermon titles or document/page titles.

### Conti Song Row Editing

`components/contis/conti-song-summary-table.tsx` should support row-level edit clicks in action mode. Clicking a row opens the same editor currently opened by the edit icon.

Interactive children must keep their own behavior:

- edit, move up, move down, and delete buttons call their existing handlers;
- YouTube links still open the reference;
- those controls stop event propagation so row-click edit does not fire.

Keyboard accessibility continues to rely on the explicit edit button. The row click is a mouse convenience, not a replacement for accessible controls.

### Drawer Overlay

The current desktop drawer is portaled into an `aside` that participates in the flex layout. This compresses the page behind it and breaks the conti detail controls. The drawer portal should become a fixed overlay that does not reserve width in the app shell.

`components/layout/app-shell.tsx` should keep the normal page width unchanged. The drawer panel should appear above it:

- desktop: fixed to the right, above the page, with a bounded width such as `min(1040px, calc(100vw - sidebarWidth - margin))`;
- mobile: keep the existing bottom-sheet behavior;
- backdrop: blocks clicks to the underlying page.

`components/ui/drawer.tsx` keeps ESC and close-button behavior, and backdrop clicks should call the same close path. If `onBeforeClose` returns false because there are unsaved changes, the drawer remains open and the unsaved confirmation appears.

### Modal Outside Click

Ordinary `Dialog` modals should close on outside click through the Base UI dialog behavior/backdrop. This includes normal import and editor-support dialogs.

`AlertDialog` remains the exception. Destructive confirmations and unsaved-change confirmations should require an explicit button decision to avoid accidental dismissal.

### Dirty-State Accuracy

`ArrangementEditor` currently marks dirty whenever a child calls `markDirty`, even if the value did not change meaningfully. This causes the unsaved-changes dialog to appear after opening and closing with no user edits.

Dirty detection should become value-aware. A normalized `ArrangementDraft` snapshot is compared against the initial snapshot. Normalization should make semantically equivalent values compare equal:

- trim strings used for saved values;
- treat empty optional fields consistently;
- normalize YouTube references to the stored video ID shape when possible;
- treat default all-sheet-music selection consistently;
- keep arrays and maps in stable order where order is semantically fixed.

Initial async sheet-music loading, preview selection, and harmless component re-renders must not make the editor dirty. Real user changes to keys, tempos, section order, lyrics, section-lyrics mapping, notes, sheet-music selection, YouTube reference, or preset fields should make it dirty.

### Sheet-Music Preview Loading Copy

Sheet music preview should distinguish loading from empty state at the source level, not only by changing copy. While sheet-music files are being fetched or PDF page-count/thumbnail placeholders are being generated, pass an explicit loading state into the preview workspace and show loading copy or a skeleton such as `악보 불러오는 중...`. Only show empty-state copy when there are truly no previewable files or when no item has been selected after loading.

### Song Library Grid

`components/songs/song-list.tsx` and `components/songs/song-card.tsx` should change from a full-width row list to responsive cards:

- desktop: 3 columns by default;
- wide desktop: can expand to 4 columns if space allows;
- tablet: 2 columns;
- mobile: 1 column.

Cards should stay compact and scannable, showing the song name, registration date, and an open affordance. The search and empty states remain.

## Phase 2: New Conti Inline YouTube Import

### Flow

`/contis/new` should support both existing empty-conti creation and playlist-based creation.

Without a playlist, users can enter `인도자`, date, and description, then create a conti with the current existing behavior.

With a playlist, the same page shows an inline wizard:

1. Enter YouTube playlist URL.
2. Fetch playlist items.
3. Review import items.
4. Match existing songs or leave items as new songs.
5. Choose existing presets or create new presets.
6. Choose whether to keep or replace an existing preset YouTube reference.
7. Submit once.

On submit, the app creates the conti first, then runs batch import with the new `contiId`, then navigates to the new conti detail page. If conti creation succeeds but import fails, show a toast that the conti was created and import failed, then navigate to the detail page so the user can retry import there.

### Reused Import Logic

The existing `components/contis/youtube-import-dialog.tsx` should not be duplicated. This is a substantial refactor because the file currently mixes fetch state, matching, duplicate detection, preset loading, payload creation, and UI. Assign one implementation owner to extract shared import logic before any other work depends on it. Extract shared behavior into reusable units, for example:

- a hook for playlist URL, fetch, review state, matching, exclusion, preset selection, and import payload creation;
- a presentational review component used by both the dialog and inline new-conti wizard;
- a small wrapper for dialog-specific header/footer layout.

The existing conti detail dialog keeps the same user-facing behavior, except for the new YouTube reference preservation option.

### Existing Preset YouTube Policy

When a playlist item is matched to an existing song and an existing preset with a YouTube reference is selected, the default is to keep the existing preset YouTube reference. The user can explicitly choose to replace it with the playlist video.

The batch import payload should represent this choice. Items that keep the existing reference should not send overwrite data for that preset. Items that replace should send the playlist `videoId` and title.

This policy applies to both the existing import dialog and the new inline wizard.

## Data And Server Actions

The conti schema remains unchanged. `title` remains the database column and action field, but UI labels say `인도자`.

`createConti` can stay as the conti creation primitive. The inline wizard can call it first and then call `batchImportSongsToConti`.

`batchImportSongsToConti` should be extended only as needed to support the preserve-versus-replace YouTube behavior. Existing callers should keep their behavior unless they pass the new option.

The preserve-versus-replace behavior must be implemented consistently in both repository providers, including `lib/repositories/storyboard/neon-repository.ts` and `lib/repositories/storyboard/turso-repository.ts`.

## Error Handling

- Login redirects reject unsafe `next` values and fall back to `/worship-prep`.
- Playlist fetch errors remain inline/toast errors and do not create a conti.
- Import review validation prevents submitting when no importable items remain.
- Existing preset YouTube replacement is explicit and should not require a global browser `confirm`; the per-item option is the confirmation.
- If import fails after conti creation, keep the created conti and route to its detail page with a clear toast.
- Drawer outside click honors the dirty guard.

## Testing

Add focused tests for pure logic:

- dirty draft normalization and comparison;
- import payload generation for existing YouTube keep versus replace;
- safe login `next` redirect parsing if implemented as a helper.

Run the existing test suite and lint where feasible:

- `pnpm lint`
- `pnpm test`

Use the in-app browser for UI smoke checks:

- `/` redirects to `/worship-prep` after auth.
- Protected deep links return to their original URL after login.
- Sidebar order is `예배 준비`, `콘티 목록`, `찬양 라이브러리`.
- Conti list hides fake descriptions and is denser.
- Conti song row click opens the editor; child buttons and YouTube links still work.
- Drawer overlays the page without compressing it.
- Drawer and ordinary dialogs close on outside click; alert dialogs do not.
- Opening and closing an untouched conti-song editor does not show unsaved changes.
- Sheet music loading state does not look like an empty state.
- `/contis/new` supports empty conti creation and inline playlist import.
- Existing preset YouTube references are kept by default and replaced only when selected.
- Song library renders as a responsive grid.

## Implementation Notes

Keep edits scoped to existing component boundaries. Avoid broad visual redesign beyond the requested density and interaction changes. Prefer extracting shared import review logic before adding new-conti inline behavior so existing dialog behavior remains easy to compare.

Implementation should be planned for subagent-driven execution after an external agent reviews this design and the implementation plan.

Recommended subagent ownership boundaries:

- auth, navigation, conti list density, conti labels, and song grid;
- drawer/dialog primitives and outside-click behavior;
- dirty-state normalization and tests;
- YouTube import shared logic, server action payloads, Neon/Turso repository behavior, and new-conti inline wizard.

Avoid multiple agents editing `components/contis/youtube-import-dialog.tsx` or drawer primitives concurrently.
