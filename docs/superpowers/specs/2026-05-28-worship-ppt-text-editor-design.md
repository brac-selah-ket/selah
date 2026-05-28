# Worship PPT Text Editor Design

## Goal

Add a just-before-export PPT text editor to the worship-prep export flow. In the `내보내기 확인` step, users can open a right-side drawer, jump by PowerPoint section, and directly edit text on individual PPT pages before overwriting or downloading the final file.

The default drawer section is `기도 봉헌 광고`.

## Key Decisions

- The feature lives inside the existing `예배 PPT 내보내기` dialog, not as a new page.
- The entry point appears in the confirm step footer next to `뒤로` and `내보내기`.
- The editor opens as a right-side drawer, following the conti editing interaction pattern.
- Section navigation is explicit and jump-based. The drawer opens to `기도 봉헌 광고` when that section exists.
- Whitespace must be visible while editing. Spaces, tabs, and line breaks are shown in a word-processor-like way without changing the saved text value.
- Manual text edits are per-export draft state. They are not persisted to the database.
- Manual edits are applied late in PPTX processing so the user's direct edits win over generated scripture, sermon title, and song text.

## Non-Goals

- Do not build a full PowerPoint layout editor.
- Do not move, resize, restyle, add, or delete shapes.
- Do not persist edited PPT text to Google Sheets, the database, or the selected Drive file before the user clicks export.
- Do not edit non-text assets such as images, backgrounds, transitions, or speaker notes in the first version.
- Do not replace the existing scripture and conti data controls.

## User Flow

1. User opens `예배 PPT 내보내기`.
2. User selects a PPT file, confirms worship data, and chooses export mode.
3. On `내보내기 확인`, the footer shows:
   - `뒤로`
   - `PPT 텍스트 수정`
   - `내보내기`
4. User clicks `PPT 텍스트 수정`.
5. The app loads text-editable structure for the selected PPT file and opens a right drawer.
6. The drawer selects `기도 봉헌 광고` by default if present. Otherwise it selects the first editable section.
7. User jumps between sections and edits slide text fields.
8. User applies or closes the drawer. Edits remain in the current dialog state.
9. User clicks `내보내기`; the export request includes text overrides.

## UI Design

The confirm modal remains the primary workflow anchor. The drawer is a companion editor, not another wizard step.

Drawer structure:

- Header: `PPT 텍스트 수정`, selected file name, loading/error state when needed.
- Section jump row: horizontally scrollable section buttons using PowerPoint section names.
- Slide list: cards grouped under the selected section.
- Slide card: slide/page label, text box count, and editable text fields for each text-bearing shape.
- Footer: `초기화` and `적용` actions.

The first version should favor compact operational UI over visual slide thumbnails. Slide previews can be added later if text-only editing proves insufficient.

## Whitespace Editing

Editing should use a controlled plain text value as the source of truth. A visual layer shows invisible characters:

- Space: `·`
- Tab: a tab marker such as `→` with a tinted tab span
- Newline: visible `↵` at line ends or equivalent line-break marker

The saved override value must preserve the original characters:

- Spaces remain spaces.
- Tabs remain `\t`.
- Newlines remain `\n`.

Implementation can use either:

- A textarea with an aligned overlay that renders visible whitespace, or
- A contenteditable/plain-text editor abstraction if it stays small and predictable.

Prefer the textarea plus overlay approach first because it keeps selection, IME input, copy/paste, and form state easier to reason about.

## Data Model

No database schema change is required.

Add request/response types for temporary PPT text editing:

```ts
interface PptxTextShape {
  shape_id: string;
  shape_name: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PptxTextSlide {
  slide_id: number;
  slide_index: number;
  section_name: string;
  title: string;
  shapes: PptxTextShape[];
}

interface PptxTextSection {
  name: string;
  slide_ids: number[];
  slides: PptxTextSlide[];
}

interface PptxTextOverride {
  slide_id: number;
  shape_id: string;
  text: string;
}
```

The `shape_id` should be stable within a single source PPT file. A practical first choice is the PowerPoint non-visual shape id from the slide XML. If that is missing, fall back to a deterministic slide-local index.

## Data Flow

Add a server action to inspect the selected PPT file:

```text
worship export dialog
  -> inspectPptxText(fileId)
  -> export service
  -> api/pptx.py inspect-text action
  -> drawer draft state
```

Add text overrides to the final export call:

```text
worship export dialog
  -> exportWorshipToPptx({ ..., textOverrides })
  -> sendPptxExportRequest()
  -> api/pptx.py export_lyrics
  -> generated scripture/songs
  -> apply text overrides
  -> save/overwrite/download
```

The inspect action should validate the selected file through the same allowed-template-folder check used by export.

## PPTX Processing

Python handler additions:

- Inspect action: return sections, slides, and editable text shapes from the selected PPT.
- Export action: accept optional `text_overrides`.
- Override application: after scripture and songs are processed, find each target slide and shape, then replace text while preserving formatting via the existing text injection helper.

Override failure behavior:

- If a target slide is missing because export generation removed it, skip that override and report a warning count in the result.
- If a target shape is missing on an existing slide, skip that override and report a warning count.
- Do not fail the entire export for stale overrides unless every override is stale.

This keeps the editor useful even when generated sections change slide counts during export.

## Error Handling

Show user-facing errors for:

- Missing PPT file selection.
- File no longer available in the configured Drive folder.
- PPT text inspection failure.
- Template without sections.
- Selected section has no editable text shapes.
- Export failure from Drive, Blob, scripture, songs, or PPT processing.

The drawer should preserve local edits while transient inspection/export errors are shown.

## Testing

Add focused tests for:

- UI source guard: confirm step includes the `PPT 텍스트 수정` entry point.
- UI source guard: drawer defaults to `기도 봉헌 광고`.
- Helper test: whitespace renderer maps spaces, tabs, and newlines to visible markers while preserving raw text.
- Type/helper test: text overrides are included in the export request payload.
- Python source/integration guard: inspect-text action extracts sections/slides/text shapes.
- Python source/integration guard: export applies text overrides after generated scripture and song processing.

Manual verification:

- Open worship prep export dialog.
- Reach `내보내기 확인`.
- Open drawer and confirm `기도 봉헌 광고` is selected.
- Edit text containing spaces, tabs, and line breaks.
- Export as a new file and inspect the resulting PPT manually.

## Open Implementation Notes

- The exact drawer component can reuse the existing shadcn/Base UI drawer primitives in `components/ui/drawer.tsx`.
- The drawer should not block the confirm modal from staying open; the modal remains the owner of export state.
- If the current drawer primitive cannot comfortably coexist with the modal, use the app's established drawer context pattern before adding a new primitive.
