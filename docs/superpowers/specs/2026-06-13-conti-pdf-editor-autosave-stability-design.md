# Conti PDF Editor Autosave Stability Design

## Context

The conti PDF export editor currently autosaves layout edits through `saveContiPdfLayout()`. That action updates the `conti_pdf_exports` record and calls `invalidateConti(contiId)`. The export route reads both `getContiForExport(id)` and `getContiPdfExport(id)`, and those queries are tied to conti cache tags. As a result, an autosave can invalidate the same server data that produced the current editor props.

When fresh server props arrive, `useEditorPages()` runs its initialization effect again and rebuilds the `pages` state from `existingExport.layoutState`. To the user this looks like an unexpected refresh while editing. The effect is especially noticeable when moving text overlays because overlay pointer movement currently calls the autosave trigger repeatedly.

## Goals

- Keep autosave enabled in the PDF editor.
- Prevent autosave from causing the current editor session to reload, reset, or rebuild its `pages` state.
- Reduce redundant autosave requests during active pointer interactions.
- Keep manual save and export behavior predictable.
- Preserve existing PDF rendering, export format, database schema, and visual editor layout.

## Non-Goals

- No redesign of the PDF editor UI.
- No change to generated PDF output quality or page composition.
- No database schema migration.
- No rewrite of the conti editor or song preset editor.
- No removal of autosave.

## Recommended Approach

Separate PDF layout persistence from broad conti invalidation, then tighten autosave scheduling.

`saveContiPdfLayout()` should be treated as a draft layout save for the active editor session. It should persist the latest layout state but should not invalidate the full conti data graph. A dedicated PDF export cache tag, such as `conti-pdf-export:{contiId}`, should cover the `conti_pdf_exports` record. `getContiPdfExport(contiId)` should use that tag instead of `conti:{contiId}`.

`getContiForExport(id)` should continue to use conti tags because it represents the songs, overrides, selected sheet music, and preset metadata needed to build editor pages. Those inputs should refresh when the actual conti changes, but not on every PDF layout autosave.

Autosave should save snapshots of client editor state as a side effect. Successful saves should update save status only; they should not rebuild `pages` from server props. Intentional reset actions, such as "프리셋 다시 적용", remain the explicit path for rebuilding the editor layout.

## Cache and Server Actions

Add a cache tag helper for PDF export records:

- `cacheTags.contiPdfExport(contiId) -> "conti-pdf-export:{contiId}"`

Add a focused invalidation helper:

- `invalidateContiPdfExport(contiId)` updates only the PDF export tag.

Use the new tag in `getContiPdfExport(contiId)`.

Adjust server actions by intent:

- `saveContiPdfLayout(contiId, layoutState)` persists `layoutState` and invalidates only `conti-pdf-export:{contiId}`. It does not call `invalidateConti(contiId)` and does not call `revalidatePath('/contis')`.
- `exportContiPdf(contiId, formData)` persists the generated PDF URL and invalidates `conti-pdf-export:{contiId}`. It does not call `invalidateConti(contiId)` or `revalidatePath('/contis')` in this scope because current conti list data does not display PDF export state.
- `deleteContiPdfExport(exportId)` deletes the export record and invalidates `conti-pdf-export:{contiId}`. It does not call broad conti invalidation for the same reason.
- `syncPresetPdfMetadataFromContiLayout(contiId, layoutStateText)` continues to invalidate conti data because synced preset metadata changes the exported layout inputs that `getContiForExport(id)` reads.

This keeps autosave from invalidating `getContiForExport(id)` and from causing the active export page to receive unrelated refreshed conti props.

## Editor State and Autosave

The editor's `pages` array remains the source of truth for the active editing session after initialization. Autosave sends snapshots of that state to the server. Server save responses update `saveStatus` and error feedback only.

Autosave scheduling should follow these rules:

- The first edit schedules a debounced save instead of forcing an immediate save because `lastSaveRef` starts at zero.
- If a save is already in flight, new autosave requests should mark a pending save instead of starting concurrent server actions.
- When the in-flight save finishes, the latest pending snapshot should be saved once.
- Manual save cancels any pending autosave timer and immediately saves the latest snapshot.
- Save failure leaves the editor state untouched, sets status to `unsaved`, and shows the existing toast error.
- Save success sets status to `saved` for the snapshot that actually reached the server.

Pointer interactions should avoid autosave spam:

- Text overlay drag updates position in local state during pointer movement.
- Text overlay drag schedules autosave once on pointer up when movement actually occurred.
- Text edits, font changes, color changes, add/delete overlay, crop confirm, crop undo, image reset, image pan, and image resize still schedule autosave after the user action completes.

## Data Flow

Initial page load:

1. The export route fetches `conti` through `getContiForExport(id)`.
2. The export route fetches `existingExport` through `getContiPdfExport(id)`.
3. `PdfEditor` initializes `pages` from conti data, saved layout, and preset metadata.

Editing:

1. User changes overlays, crops, or image transform.
2. The editor updates client `pages`.
3. Autosave schedules a save of the latest layout snapshot.
4. `saveContiPdfLayout()` persists the snapshot and invalidates only the PDF export tag.
5. The editor updates save status without reinitializing `pages`.

Intentional reset:

1. User confirms "프리셋 다시 적용".
2. `reloadFromPreset()` rebuilds `pages` from conti and preset metadata.
3. Autosave can persist the new explicit layout after the reset action.

## Testing

Update source-level cache tests:

- `getContiPdfExport()` uses `cacheTags.contiPdfExport(contiId)`.
- `saveContiPdfLayout()` does not call `invalidateConti(contiId)`.
- PDF export actions call the new PDF export invalidation helper.
- `cacheTags` and invalidation helpers define the new PDF export tag.

Add or update source-level editor tests:

- `useAutoSave` no longer uses `lastSaveRef` initialized to zero to force the first autosave immediately.
- `useAutoSave` has an in-flight or pending-save guard so overlapping autosaves collapse into the latest save.
- `useOverlays` does not call the autosave trigger from pointer movement.
- `useOverlays` schedules autosave on pointer up after a drag.

Manual verification:

- Open a conti PDF export editor.
- Move a text overlay repeatedly for at least ten seconds.
- Confirm the page does not show the loading skeleton, lose selection unexpectedly, jump back to an older layout, or reset the current page.
- Confirm save status reaches `saved`.
- Refresh manually and confirm the saved layout is restored.
- Use manual save and confirm it persists immediately.
- Use "프리셋 다시 적용" and confirm that this explicit reset still rebuilds layout.

## Risks and Mitigations

Risk: Another page expects `conti:{id}` invalidation when the PDF export URL changes.

Mitigation: The current design states that conti lists do not display PDF export state. The conti detail page should read PDF export state through `getContiPdfExport()`, which will have its own tag. If a future list view shows PDF export status, that feature should opt into the PDF export tag or explicitly invalidate the list.

Risk: Debounced autosave could leave recent edits unsaved if the user closes the tab immediately.

Mitigation: Keep the existing before-unload warning when status is `unsaved`, and make manual save cancel timers and save immediately.

Risk: Collapsing in-flight saves could save an older snapshot after a newer edit.

Mitigation: Store the latest requested snapshot separately from the in-flight snapshot. After the current request completes, save the latest pending snapshot once.

## Acceptance Criteria

- Autosave remains enabled.
- Autosave no longer triggers full conti invalidation.
- Editing PDF layout no longer causes the editor to reload or rebuild `pages` from server props.
- Text overlay dragging does not schedule autosave on every pointer movement.
- Manual save, export, delete, and preset sync remain functional.
- Tests cover the cache tag separation and autosave scheduling changes.
