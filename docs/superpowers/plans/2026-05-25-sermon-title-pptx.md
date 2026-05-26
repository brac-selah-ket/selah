# Sermon Title PPTX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include the weekly sermon title in the worship PPT export by updating the existing sermon-title slide after all scripture pages, wrapping the title in Korean-style curly quotes.

**Architecture:** The React worship-prep dialog already has the weekly Google Sheet row as `item`, where `item.title` maps to the sheet's `DB!J`/`말씀 제목` column. The server action will pass that title into the scripture payload, and the Python PPTX handler will update the first slide of the existing `말씀 제목` section without creating a new section or moving section boundaries.

**Tech Stack:** Next.js server actions, TypeScript payload types, `python-pptx`, PowerPoint OOXML section parsing, Node built-in test runner.

---

## File Structure

- Modify `lib/types.ts`: add optional sermon title fields to `PptxExportScriptureData`.
- Modify `lib/utils/pptx-helpers.ts`: allow `buildPptxScriptureData()` to carry optional `sermon_title` and `sermon_title_section_name`.
- Modify `lib/utils/pptx-helpers.test.mjs`: prove the helper emits the new snake_case payload fields.
- Modify `lib/actions/worship-pptx-export.ts`: accept `sermonTitle`, normalize it, and include it in the scripture payload.
- Modify `components/worship-prep/worship-pptx-export-button.tsx`: pass `item.title` into `exportWorshipToPptx()`.
- Modify `api/pptx.py`: format sermon title as `“title”`, find the existing `말씀 제목` section, and update its first slide's first textbox.
- Modify `tests/pptx-source.test.mjs`: source-level guard that sermon title logic exists and is called after scripture processing.
- No commit: user explicitly requested no commit for this implementation.

## Task 1: Extend TypeScript Payload

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/utils/pptx-helpers.ts`
- Modify: `lib/utils/pptx-helpers.test.mjs`

- [ ] **Step 1: Write the failing helper test**

Append this test to `lib/utils/pptx-helpers.test.mjs`:

```js
test('builds scripture data with optional sermon title fields', async () => {
  const { buildPptxScriptureData } = await loadPptxHelpersModule();

  const result = buildPptxScriptureData(
    '롬 3:20~31',
    [
      {
        title: '롬 3:20-21',
        text: '20 본문\n21 본문',
        verseStart: '3:20',
        verseEnd: '3:21',
      },
    ],
    '봉독 말씀',
    {
      sermonTitle: '모든 사람에게 미치는 하나님의 의',
      sermonTitleSectionName: '말씀 제목',
    },
  );

  assert.equal(result.sermon_title, '모든 사람에게 미치는 하나님의 의');
  assert.equal(result.sermon_title_section_name, '말씀 제목');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test lib/utils/pptx-helpers.test.mjs
```

Expected: FAIL because `buildPptxScriptureData()` currently accepts only three arguments and does not emit `sermon_title`.

- [ ] **Step 3: Extend `PptxExportScriptureData`**

In `lib/types.ts`, change the interface to:

```ts
export interface PptxExportScriptureData {
  section_name: string;
  reference: string;
  pages: PptxExportScripturePageData[];
  sermon_title?: string;
  sermon_title_section_name?: string;
}
```

- [ ] **Step 4: Extend `buildPptxScriptureData()`**

In `lib/utils/pptx-helpers.ts`, replace `buildPptxScriptureData()` with:

```ts
export function buildPptxScriptureData(
  reference: string,
  pages: ScriptureSlidePage[],
  sectionName: string,
  options: {
    sermonTitle?: string | null;
    sermonTitleSectionName?: string;
  } = {}
): PptxExportScriptureData {
  const sermonTitle = options.sermonTitle?.trim();

  return {
    section_name: sectionName,
    reference,
    pages: pages.map((page) => ({
      title: page.title,
      text: page.text,
      verse_start: page.verseStart,
      verse_end: page.verseEnd,
    })),
    ...(sermonTitle ? { sermon_title: sermonTitle } : {}),
    ...(options.sermonTitleSectionName ? { sermon_title_section_name: options.sermonTitleSectionName } : {}),
  };
}
```

- [ ] **Step 5: Run helper test to verify it passes**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test lib/utils/pptx-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit skipped**

Do not commit. User requested local implementation only.

## Task 2: Pass Sheet Sermon Title From Worship Prep Export

**Files:**
- Modify: `lib/actions/worship-pptx-export.ts`
- Modify: `components/worship-prep/worship-pptx-export-button.tsx`
- Test: `tests/export-service-source.test.mjs` or `lib/utils/pptx-helpers.test.mjs` as a source guard if needed

- [ ] **Step 1: Add sermon title section constant and action option**

In `lib/actions/worship-pptx-export.ts`, add this helper below `getScriptureSectionName()`:

```ts
function getSermonTitleSectionName(): string {
  return (
    process.env.PPTX_SERMON_TITLE_SECTION_NAME ||
    '말씀 제목'
  );
}
```

Then update `buildScripturePayload()` signature:

```ts
async function buildScripturePayload(
  scriptureReference: string,
  versesPerSlide?: number,
  verseTextFormat?: string,
  sermonTitle?: string | null
): Promise<PptxExportScriptureData> {
```

And update the return statement:

```ts
  return buildPptxScriptureData(reference, pages, getScriptureSectionName(), {
    sermonTitle,
    sermonTitleSectionName: getSermonTitleSectionName(),
  });
```

- [ ] **Step 2: Thread option through preview/export callers**

Keep `previewScripturePptx()` unchanged except for the extra `undefined` argument if needed:

```ts
    const scripture = await buildScripturePayload(
      scriptureReference,
      options.versesPerSlide,
      options.verseTextFormat
    );
```

In `exportWorshipToPptx()` options, add:

```ts
  sermonTitle?: string | null;
```

Then pass it into payload building:

```ts
    const scripture = await buildScripturePayload(
      scriptureReference,
      options.versesPerSlide,
      options.verseTextFormat,
      options.sermonTitle
    );
```

- [ ] **Step 3: Pass `item.title` from the client**

In `components/worship-prep/worship-pptx-export-button.tsx`, update the `exportWorshipToPptx()` call:

```ts
      const result = await exportWorshipToPptx({
        fileId: selectedFile.file_id,
        overwrite,
        outputFileName: overwrite ? undefined : outputFileName.trim(),
        contiId: selectedConti.id,
        scriptureReference: scriptureReference.trim(),
        versesPerSlide,
        verseTextFormat: effectiveVerseTextFormat,
        sermonTitle: item.title,
      })
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
env PATH=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit skipped**

Do not commit. User requested local implementation only.

## Task 3: Update Existing Sermon Title Section In PPTX Handler

**Files:**
- Modify: `api/pptx.py`
- Modify: `tests/pptx-source.test.mjs`

- [ ] **Step 1: Write failing source guards**

Append this test to `tests/pptx-source.test.mjs`:

```js
test('sermon title slide is updated in the existing sermon title section', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def format_sermon_title_text\(title\):/);
  assert.match(source, /return f'“\{stripped\}”'/);
  assert.match(source, /def process_sermon_title_section\(prs, scripture, sections, slide_id_map\):/);
  assert.match(source, /sermon_title_section_name/);
  assert.match(source, /find_section_by_name\(sections, section_name\)/);
  assert.match(source, /title_slide_id = section\['slide_ids'\]\[0\]/);
  assert.match(source, /inject_text_into_shape\(title_shape, format_sermon_title_text\(sermon_title\)\)/);
  assert.match(
    source,
    /process_scripture_section\(prs, scripture, section, slide_id_map\)[\s\S]+process_sermon_title_section\(prs, scripture, sections, slide_id_map\)/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-source.test.mjs
```

Expected: FAIL because sermon-title functions do not exist yet.

- [ ] **Step 3: Add sermon-title functions**

In `api/pptx.py`, insert these functions after `process_scripture_section()`:

```python
def format_sermon_title_text(title):
    """Wrap sermon title in curly Korean presentation quotes."""
    stripped = (title or '').strip().strip('"').strip("'").strip('“').strip('”').strip()
    if not stripped:
        return ''
    return f'“{stripped}”'


def process_sermon_title_section(prs, scripture, sections, slide_id_map):
    """Update the existing sermon-title section's first slide without changing sections."""
    sermon_title = scripture.get('sermon_title', '') if isinstance(scripture, dict) else ''
    if not sermon_title or not sermon_title.strip():
        return False

    section_name = scripture.get('sermon_title_section_name') or '말씀 제목'
    section = find_section_by_name(sections, section_name)
    if section is None or not section['slide_ids']:
        return False

    title_slide_id = section['slide_ids'][0]
    title_slide = slide_id_map[title_slide_id]['slide']
    title_shape = get_first_textbox(title_slide)
    if not title_shape:
        return False

    inject_text_into_shape(title_shape, format_sermon_title_text(sermon_title))
    return True
```

- [ ] **Step 4: Call sermon-title update after scripture pages**

In `process_export()`, after `process_scripture_section(...)`, add:

```python
        process_sermon_title_section(prs, scripture, sections, slide_id_map)
```

The block should read:

```python
        scripture_slides = process_scripture_section(prs, scripture, section, slide_id_map)
        process_sermon_title_section(prs, scripture, sections, slide_id_map)
        result['scripture_processed'] = True
        result['scripture_slides_generated'] = scripture_slides
```

- [ ] **Step 5: Run PPTX source tests**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit skipped**

Do not commit. User requested local implementation only.

## Task 4: Verify End To End And Open Local Dev Server

**Files:**
- No code files beyond Tasks 1-3.

- [ ] **Step 1: Run focused tests**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-source.test.mjs tests/export-service-source.test.mjs lib/utils/pptx-helpers.test.mjs lib/scripture/reference.test.mjs lib/scripture/pagination.test.mjs lib/scripture/provider.test.mjs lib/discord-sync/cron-state.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
env PATH=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run:

```bash
env PATH=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm lint
```

Expected: exit 0 with the existing warnings only.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 5: Start local PPTX server**

Run:

```bash
env PPTX_DEV_PORT=3002 /Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/pptx-dev-server.py
```

Expected: server listens on `http://127.0.0.1:3002/api/pptx`.

- [ ] **Step 6: Start Next dev server**

Run:

```bash
env PPTX_API_URL=http://127.0.0.1:3002/api/pptx PATH=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm exec next dev -p 3000
```

Expected: server listens on `http://localhost:3000`.

- [ ] **Step 7: Open in-app browser**

Navigate the in-app browser to:

```text
http://localhost:3000/worship-prep?date=2026-05-24
```

Expected: worship prep page opens and the PPT export dialog can be tested locally.

- [ ] **Step 8: Commit skipped**

Do not commit. User requested local implementation only.

## Self-Review

- Spec coverage: Plan passes sermon title from Google Sheet `DB!J`, updates the existing `말씀 제목` first slide, wraps the title in `“...”`, leaves section structure unchanged, and opens local dev after verification.
- Placeholder scan: No placeholder tasks remain; every code step contains exact code or exact commands.
- Type consistency: `sermonTitle` is TypeScript camelCase at the UI/action/helper boundary; `sermon_title` and `sermon_title_section_name` are snake_case in the PPTX API payload.
