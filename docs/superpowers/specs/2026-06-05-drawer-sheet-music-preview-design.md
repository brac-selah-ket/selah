# Drawer Sheet Music Preview Design

## Goal

Make sheet music preview usable inside the conti song editor drawer.

The current preview opens as a small dialog over the drawer. In production, that dialog can appear visually inside the drawer area but fail to close reliably. The preview is also too small to inspect sheet music comfortably. The target behavior is:

- The drawer can show a large sheet music preview on its left side.
- The preview does not require a nested modal to inspect ordinary sheet music.
- The shared dialog component supports explicit size options for future modal use.
- Existing dialogs keep their current default size unless they opt into a larger size.

## Current Context

The relevant flow is:

- `components/contis/conti-song-editor.tsx` opens `ArrangementEditor` in `conti-song` mode.
- `ArrangementEditor` renders a custom `Drawer`.
- The sheet music management slot includes `SheetMusicGallery`.
- `SheetMusicGallery` opens a preview through `Dialog` and `DialogContent`.
- `components/ui/dialog.tsx` currently has no semantic size prop. Consumers pass raw classes such as `max-w-5xl`.

The app shell drawer is rendered into a right-side `aside` through `DrawerProvider`. On desktop, the drawer sits at `z-[60]`, while the default dialog overlay/content uses `z-50`. Recent code added `overlayClassName` and higher z-index overrides for some drawer subdialogs, but the sheet music gallery preview still uses the default dialog layer. That makes the preview vulnerable to being placed underneath drawer surfaces or focus handling, which explains the non-closing behavior.

## Chosen Approach

Use a left preview pane inside the drawer, and keep dialog sizing as a reusable primitive improvement.

1. Add semantic sizing to `DialogContent`.
2. Add a wide drawer mode that gives `ArrangementEditor` enough horizontal room.
3. Add an optional large-preview mode to the shared sheet music gallery/selector UI.
4. In `conti-song` editing, render a large preview pane to the left of the editor controls on desktop.
5. On mobile and narrow widths, fall back to an inline preview below the sheet music grid.

This removes the nested preview dialog from the drawer workflow while preserving the full-screen dialog pattern for workflows that truly need a modal, such as PDF editing.

## UX

### Desktop

The conti song editor drawer becomes a two-column surface when sheet music exists:

- Left column: large sheet music preview.
- Right column: the existing song edit form, upload controls, selection controls, and save footer.

The left preview pane should:

- Show the selected or most recently focused sheet music page.
- Use a stable aspect ratio so the drawer does not jump while PDF thumbnails load.
- Fit the available drawer height and allow the preview pane to scroll if needed.
- Display the file name and PDF page label above or near the preview.
- Show an empty state when there is no previewable sheet music.

The right editor column should keep existing behavior:

- Uploading and deleting sheet music still works.
- Selecting sheet music for export still works.
- Saving to the current conti song or as a preset still works.
- Unsaved-change protection still works.

### Mobile

Mobile keeps a single-column drawer because a left pane would be cramped. The large preview appears inline near the sheet music section after a thumbnail is selected or focused.

## Component Design

### DialogContent Size Prop

Add a `size` prop to `components/ui/dialog.tsx`:

```ts
type DialogContentSize = "sm" | "md" | "lg" | "xl" | "full"
```

Default `size` is `sm`, matching the current `sm:max-w-sm` behavior. Larger sizes map to semantic max-width classes. `full` supports full-viewport dialog surfaces. `className` remains available for one-off layout needs and should be merged after the size class so specialized callers can still override dimensions deliberately.

Existing call sites do not need to change unless they want a semantic size.

### Drawer Size Mode

Add a drawer size concept without changing existing default drawer behavior:

```ts
type DrawerSize = "default" | "wide"
```

`Drawer` accepts `size?: DrawerSize`. `DrawerProvider` stores the active size while a drawer is open. `AppShell` uses it to choose desktop width:

- `default`: current width behavior.
- `wide`: wide enough for a large preview plus the existing editor column, constrained by viewport and sidebar.

When the drawer closes or unmounts, size resets to `default`.

### Sheet Music Preview State

Create a small shared preview data shape:

```ts
interface SheetMusicPreviewItem {
  file: SheetMusicFile
  thumbnailUrl: string | null
  pdfPage: number | null
  pdfTotalPages: number | null
}
```

The gallery and selector already build equivalent item objects. The implementation should avoid duplicating the expensive PDF-rendering logic more than necessary. A focused extraction is acceptable if it keeps responsibilities clear:

- Thumbnail/page item building remains local to sheet music UI.
- Selection state remains owned by `ArrangementEditor`.
- Previewed item state is owned by `ArrangementEditor` for drawer layout coordination.

`SheetMusicGallery` should support an optional controlled preview callback:

```ts
onPreviewChange?: (item: SheetMusicPreviewItem | null) => void
previewMode?: "dialog" | "controlled"
```

The default remains `dialog` for the song detail page gallery. The conti-song drawer passes `previewMode="controlled"` and uses `onPreviewChange` to populate the left pane instead of opening a dialog.

## Error Handling

- If a PDF thumbnail fails to render, the thumbnail and preview show a loading/error placeholder without blocking the drawer.
- If a selected preview item is deleted, the preview clears or moves to the next available item.
- If sheet music is uploaded while the drawer is open, the new item appears in the gallery and can become the preview.
- If there is no sheet music, no left preview pane is shown on desktop unless the layout needs a neutral empty state.

## Testing

Use focused source-level tests matching the existing test style:

- `DialogContent` exposes a `size` prop and keeps the old default size.
- `Drawer` and `DrawerProvider` expose a drawer size mode and reset it on close/unmount.
- `AppShell` maps `wide` drawer state to a wider desktop width.
- The conti song arrangement editor opts into wide drawer mode when rendering sheet music preview.
- `SheetMusicGallery` supports controlled preview mode and does not render its preview dialog in that mode.
- Existing full-screen PDF editor dialogs keep their explicit high layer behavior.

Manual browser verification should cover:

- Open production-equivalent conti song editor.
- Click a sheet music thumbnail and confirm the large preview appears in the drawer.
- Confirm no nested preview modal is opened in the conti-song drawer flow.
- Confirm Escape and close buttons still close the drawer or the appropriate active dialog.
- Confirm song detail page gallery can still open its normal preview dialog.

## Non-Goals

- Do not redesign the full arrangement editor.
- Do not change sheet music persistence or PDF rendering output.
- Do not replace PDF editing dialogs with the preview pane.
- Do not change alert dialog layering except where required by drawer size or controlled preview behavior.

## Open Decisions Resolved

The selected layout is the left preview pane. The browser companion choice was option A: a larger drawer with a persistent preview area on the left and editor controls on the right.
