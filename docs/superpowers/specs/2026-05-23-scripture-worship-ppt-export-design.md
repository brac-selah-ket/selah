# Scripture Worship PPT Export Design

## Goal

Add a worship-prep PPT export flow that inserts both the weekly scripture passage and the selected conti songs into one PowerPoint file.

The first implementation reads the weekly scripture reference from the existing Google Sheets `DB` row, lets the user edit that reference in the UI, fetches New Korean Revised Version scripture text through a non-official parser provider, splits the text into slides, and sends the scripture payload together with the existing song payload to the PPTX export API.

## Key Decisions

- The source of the weekly scripture reference is the Google Sheets `DB` row already shown in the worship-prep tab.
- The user can edit the scripture reference before export. The Sheets value is only the default.
- The first scripture provider is a non-official HTML parser for the Korean Bible Society legacy Bible reading page.
- The provider boundary must be explicit so a licensed API, local database, or manual text provider can replace the parser later.
- The scripture PowerPoint section name is configurable. The default is `말씀`.
- Scripture slides default to two verses per slide. The export UI lets the user choose the verses-per-slide value.
- The worship-prep tab gets a new combined `예배 PPT 내보내기` button. The existing conti detail `PPT 내보내기` button remains focused on songs.
- The first version does not include a full scripture text preview. It shows the normalized reference, verses-per-slide value, and expected slide count in the confirmation step.

## Non-Goals

- Do not replace the existing conti detail PPT export flow.
- Do not store fetched scripture text in the database in the first version.
- Do not build a full scripture editor or manual slide-break editor in the first version.
- Do not implement a licensed scripture data source yet.
- Do not scrape or crawl the entire Bible. Fetch only the chapter pages required for one export.

## Copyright And Source Notes

The New Korean Revised Version text is copyrighted by the Korean Bible Society. The first implementation uses a non-official parser because this app is an internal church operations tool and the user explicitly approved that direction.

The design keeps the parser behind a provider interface and avoids long-lived scripture storage. That does not remove copyright risk; it only keeps the implementation replaceable if the source needs to change.

Known source options from research:

- Korean Bible Society current platform: `https://bible.bskorea.or.kr/bible/NKRV/JHN.3`
- Korean Bible Society legacy reading page: `https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=jhn&chap=3`
- Public reference implementation using the legacy page: `https://github.com/oksure/bible-ko-mcp`
- Avoid HolyBible as the default provider because its page states it uses Korean Bible Society content by permission and restricts external app linkage.

## Architecture

Extend the existing flow:

```text
Worship prep page
  -> worship PPT export dialog
  -> Next.js server action
  -> scripture reference parser
  -> scripture provider
  -> scripture paginator
  -> existing song payload builder
  -> api/pptx.py
  -> Google Drive overwrite or Blob download
```

The code should stay split into small units:

- `scripture-reference`: parse and normalize references such as `요 3:16~18`, `요한복음 3:16-18`, and cross-chapter ranges.
- `scripture-provider`: fetch chapter text and return normalized verse records.
- `scripture-pagination`: split verses into pages based on `versesPerSlide`.
- `pptx-helpers`: build the combined export request payload.
- `worship export UI`: choose PPT file, conti, scripture reference, verses-per-slide, and save mode.
- `api/pptx.py`: process scripture sections before song sections.

The existing song logic remains conceptually unchanged. Scripture data is not modeled as a fake song because that would overload `section_order`, `lyrics`, and `section_lyrics_map` with non-song meaning.

## Data Model

No database schema change is required for the first version.

Add request types alongside the existing PPTX export types:

```ts
interface PptxExportScriptureData {
  section_name: string;
  reference: string;
  pages: Array<{
    title: string;
    text: string;
    verse_start: string;
    verse_end: string;
  }>;
}
```

Extend the export request so `scripture` is optional:

```ts
interface PptxExportRequest {
  action: 'export_lyrics';
  file_id: string;
  overwrite: boolean;
  output_file_name?: string;
  output_folder_id?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
}
```

Keep the `export_lyrics` action name for backward compatibility in the first implementation. The Python handler treats `scripture` as an optional addition to the existing export action.

## Scripture Reference Parsing

The parser should support the forms already used by worship prep:

- Abbreviated Korean book names: `요`, `창`, `시`, `고전`
- Full Korean book names: `요한복음`, `창세기`, `시편`, `고린도전서`
- Single verse: `요 3:16`
- Same-chapter range: `요 3:16~18`, `요 3:16-18`
- Cross-chapter range: `요 3:16~4:2`

The existing `lib/discord-parser/scripture.ts` can be reused or extended, but the export feature needs richer output than the current normalized string. It should expose canonical book metadata, start chapter/verse, and end chapter/verse.

## Scripture Provider

The initial provider fetches the Korean Bible Society legacy page one chapter at a time:

```text
https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=<bookCode>&chap=<chapter>
```

Provider behavior:

- Fetch only chapters included in the requested range.
- Parse verse numbers and verse text from the page.
- Strip footnote markers and study-note content from the returned verse text.
- Return a clear error when no verses are found.
- Cache within a single export request so a repeated chapter is not fetched twice.

The provider should not implement whole-Bible search, prefetching, or persistent caching in the first version.

## Scripture Pagination

Pagination takes ordered verse records and `versesPerSlide`.

Rules:

- Default `versesPerSlide` is `2`.
- UI range is `1` through `5`.
- Each generated page includes a compact title, for example `요 3:16-17`.
- Page text includes verse numbers inline, for example `16 하나님이...`.
- If the final page has fewer verses than the setting, keep it as a normal final page.
- Cross-chapter boundaries should preserve readable titles, for example `요 3:35-4:1`.

## PPTX Processing

The Python export API should process scripture before songs.

Scripture section requirements:

- Find the configured scripture section by exact section name.
- Require at least two slides in that section: title slide and body base slide.
- Put the normalized scripture reference on the title slide.
- Duplicate the body base slide once per scripture page.
- Insert the page text into the first text box of each duplicated body slide, preserving the base slide formatting.
- Delete stale generated slides from the section, mirroring the existing song-section cleanup behavior.
- Add speaker notes such as `말씀-1`, `말씀-2`, or the page title.
- Keep transitions consistent with the existing cloned lyric slide behavior.

Split base slide selection so scripture clones from the scripture section's second slide and songs clone from the existing song base slide logic. Scripture processing must not change which base slide song sections use.

## Worship Prep UI

Add a combined export button to the worship-prep detail page.

Dialog flow:

1. PPT file selection from the configured Google Drive folder.
2. Worship data selection:
   - Scripture reference input, defaulting to the selected week's Sheets value.
   - Conti selector, defaulting to the conti with the same date when available.
   - Verses-per-slide control, defaulting to `2`.
3. Save mode selection:
   - Overwrite selected Drive file.
   - Download as a new file through Blob, matching the current export behavior.
4. Confirmation:
   - Selected PPT file.
   - Scripture reference and expected scripture slide count.
   - Selected conti and song summary.
   - Save mode.

When the dialog enters the confirmation step, it calls a server action that parses the scripture reference, fetches the required verses, paginates them, and returns the expected scripture slide count. It does not show the full scripture text in the first version.

If the selected date has no matching conti, the user can pick one from available contis. If no conti is selected, the combined export should not proceed because the requested flow is scripture plus conti.

## Environment Variables

Add client/server configuration for the scripture section name:

```text
PPTX_SCRIPTURE_SECTION_NAME=말씀
NEXT_PUBLIC_PPTX_SCRIPTURE_SECTION_NAME=말씀
```

The client value is used only for UI summary. The server value is authoritative for the payload sent to the Python API.

## Error Handling

Return user-facing errors for:

- Missing scripture reference.
- Unsupported scripture reference format.
- Unknown book name.
- Invalid verse range.
- Scripture provider network failure.
- Scripture provider HTML parsing failure.
- Requested verses not found.
- Missing scripture section in the PPT template.
- Scripture section with fewer than two slides.
- Existing Drive, Blob, or PPT processing failures.

If scripture fetching fails, do not export a partial worship PPT silently. The user should fix the reference or retry.

## Testing

Add focused tests for:

- Scripture reference parser:
  - abbreviated and full book names
  - `-` and `~` ranges
  - single verse
  - same-chapter range
  - cross-chapter range
- Scripture pagination:
  - default two verses per slide
  - one verse per slide
  - uneven final page
  - cross-chapter page labels
- Provider parser:
  - extract verses from saved Korean Bible Society HTML fixture
  - ignore footnotes and non-verse text
  - fail clearly when no verses are found
- Payload builder:
  - scripture payload and song payload are both present for worship export
  - existing song-only payload remains unchanged
- Python PPTX processor:
  - scripture section is found by configured name
  - generated slide count matches scripture page count
  - missing section returns a controlled error

Run the existing lint/build checks after implementation.

## Rollout

1. Implement parser, provider, paginator, and tests.
2. Extend export types and server action payload.
3. Extend Python PPTX processing for optional scripture payload.
4. Add the worship-prep combined export UI.
5. Validate with a real template containing a `말씀` section and existing `찬양 N` sections.
6. Keep the existing conti detail song-only export available as a fallback.

## Open Operational Risk

The scripture provider is intentionally non-official for the first version. If the source page changes, blocks automated access, or legal/usage concerns arise, the provider must be replaced with a licensed API, a local permitted data file, or a manual paste flow. The rest of the design should survive that replacement.
