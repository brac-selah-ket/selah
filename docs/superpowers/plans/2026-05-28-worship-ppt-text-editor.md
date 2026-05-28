# Worship PPT Text Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side PPT text editor drawer to the worship-prep PPT export confirmation step, with section jumping, visible whitespace, and final export text overrides.

**Architecture:** The existing worship export modal remains the owner of export state. A new drawer component loads text structure for the selected PPT through a server action, keeps per-export draft edits in client state, and sends changed text overrides with the final export request. The Python PPTX handler gains an inspect-text path and applies overrides after generated scripture/song processing so direct user edits win.

**Tech Stack:** Next.js App Router, React 19 client components, Base UI dialog, existing app-shell drawer, TypeScript server actions, Node built-in tests, python-pptx.

---

## File Structure

- Modify `lib/types.ts`: add PPT text inspection/override types and export payload/result fields.
- Modify `lib/pptx/export-service.ts`: add text inspection request and carry `text_overrides` in export requests.
- Modify `lib/actions/worship-pptx-export.ts`: expose `inspectWorshipPptxText()` and thread `textOverrides` through `exportWorshipToPptx()`.
- Create `lib/utils/visible-whitespace.ts`: map raw whitespace to visible editor markers.
- Create `lib/utils/visible-whitespace.test.mjs`: verify marker rendering preserves raw source text outside display.
- Create `lib/utils/pptx-text-overrides.ts`: build stable draft keys and changed-only text override payloads.
- Create `lib/utils/pptx-text-overrides.test.mjs`: verify default section selection and changed-only overrides.
- Create `components/worship-prep/visible-whitespace-textarea.tsx`: textarea plus visual whitespace overlay.
- Create `components/worship-prep/pptx-text-editor-drawer.tsx`: section jump drawer and slide text fields.
- Modify `components/worship-prep/worship-pptx-export-button.tsx`: add confirm-step entry point, load text structure, maintain draft state, and include overrides in export.
- Modify `components/layout/app-shell.tsx`: ensure the existing drawer can sit above a dialog overlay while open.
- Modify `api/pptx.py`: inspect editable text shapes and apply optional `text_overrides` after export generation.
- Modify `tests/export-service-source.test.mjs`: source guards for transport/action payload wiring.
- Modify `tests/worship-prep-source.test.mjs`: source guards for confirm-step drawer entry and default section.
- Modify `tests/pptx-source.test.mjs`: source guards for Python inspect/apply behavior.

## Task 1: Add Transport Types And Server Action Plumbing

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/pptx/export-service.ts`
- Modify: `lib/actions/worship-pptx-export.ts`
- Modify: `tests/export-service-source.test.mjs`

- [ ] **Step 1: Write failing source tests for text inspection and override transport**

Append these tests to `tests/export-service-source.test.mjs`:

```js
test('PPTX export request can carry text overrides', async () => {
  const typesSource = await readFile(new URL('../lib/types.ts', import.meta.url), 'utf8');
  const serviceSource = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(typesSource, /export interface PptxTextOverride/);
  assert.match(typesSource, /text_overrides\?: PptxTextOverride\[\]/);
  assert.match(typesSource, /text_overrides_applied\?: number/);
  assert.match(serviceSource, /textOverrides\?: PptxTextOverride\[\]/);
  assert.match(serviceSource, /body\.text_overrides = options\.textOverrides/);
});

test('PPTX export service supports text inspection', async () => {
  const serviceSource = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(serviceSource, /PptxTextStructure/);
  assert.match(serviceSource, /export async function sendPptxTextInspectRequest/);
  assert.match(serviceSource, /'X-Action': 'inspect-text'/);
  assert.match(serviceSource, /'X-File-Id': fileId/);
});

test('worship PPT action exposes text inspection and passes overrides', async () => {
  const actionSource = await readFile(new URL('../lib/actions/worship-pptx-export.ts', import.meta.url), 'utf8');

  assert.match(actionSource, /export async function inspectWorshipPptxText/);
  assert.match(actionSource, /sendPptxTextInspectRequest\(allowedFile\.data!\.file_id\)/);
  assert.match(actionSource, /textOverrides\?: PptxTextOverride\[\]/);
  assert.match(actionSource, /textOverrides: options\.textOverrides/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/export-service-source.test.mjs
```

Expected: FAIL because `PptxTextOverride`, `sendPptxTextInspectRequest`, and `inspectWorshipPptxText` do not exist yet.

- [ ] **Step 3: Add PPT text types to `lib/types.ts`**

Insert these interfaces after `PptxExportScriptureData`:

```ts
export interface PptxTextShape {
  shape_id: string;
  shape_name: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptxTextSlide {
  slide_id: number;
  slide_index: number;
  section_name: string;
  title: string;
  shapes: PptxTextShape[];
}

export interface PptxTextSection {
  name: string;
  slide_ids: number[];
  slides: PptxTextSlide[];
}

export interface PptxTextStructure {
  file_id: string;
  sections: PptxTextSection[];
}

export interface PptxTextOverride {
  slide_id: number;
  shape_id: string;
  text: string;
}
```

Then update `PptxExportRequest`:

```ts
export interface PptxExportRequest {
  action: 'export_lyrics';
  file_id: string;
  overwrite: boolean;
  output_file_name?: string;
  output_folder_id?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
  text_overrides?: PptxTextOverride[];
}
```

And update `PptxExportResult`:

```ts
export interface PptxExportResult {
  file_id: string;
  file_name: string;
  web_view_link: string;
  download_url?: string;
  songs_processed: number;
  slides_generated: number;
  scripture_processed?: boolean;
  scripture_slides_generated?: number;
  text_overrides_applied?: number;
  text_overrides_skipped?: number;
}
```

- [ ] **Step 4: Add text inspect and override transport to `lib/pptx/export-service.ts`**

Update the imports:

```ts
import type {
  ActionResult,
  PptxDriveFile,
  PptxExportRequest,
  PptxExportResult,
  PptxExportScriptureData,
  PptxExportSongData,
  PptxTemplateStructure,
  PptxTextOverride,
  PptxTextStructure,
} from '@/lib/types';
```

Update `sendPptxExportRequest()` options:

```ts
export async function sendPptxExportRequest(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
  textOverrides?: PptxTextOverride[];
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
```

Add this after the existing scripture assignment:

```ts
    if (options.textOverrides && options.textOverrides.length > 0) {
      body.text_overrides = options.textOverrides;
    }
```

Append this function after `sendPptxInspectRequest()`:

```ts
export async function sendPptxTextInspectRequest(
  fileId: string
): Promise<ActionResult<PptxTextStructure>> {
  try {
    const response = await fetch(getPptxApiUrl(), {
      method: 'GET',
      headers: getPptxHeaders({
        'X-Action': 'inspect-text',
        'X-File-Id': fileId,
      }),
    });

    const text = await response.text();
    let result: { success: boolean; error?: string; data?: PptxTextStructure };
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[sendPptxTextInspectRequest] Non-JSON response:', response.status, text.slice(0, 500));
      return { success: false, error: `PPT 서버 오류 (${response.status}): 응답을 처리할 수 없습니다` };
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('[sendPptxTextInspectRequest]', error);
    return { success: false, error: 'PPT 텍스트를 불러오는 중 오류가 발생했습니다' };
  }
}
```

- [ ] **Step 5: Add worship text inspect action and export option**

Update `lib/actions/worship-pptx-export.ts` imports:

```ts
import { ensurePptxFileAllowed, sendPptxExportRequest, sendPptxTextInspectRequest } from '@/lib/pptx/export-service';
```

Update type imports:

```ts
import type {
  ActionResult,
  ContiWithSongs,
  PptxExportResult,
  PptxExportScriptureData,
  PptxExportScripturePageData,
  PptxTextOverride,
  PptxTextStructure,
} from '@/lib/types';
```

Add this action after `getContiForWorshipPptxExport()`:

```ts
export async function inspectWorshipPptxText(
  fileId: string
): Promise<ActionResult<PptxTextStructure>> {
  try {
    const allowedFile = await ensurePptxFileAllowed(fileId);
    if (!allowedFile.success) {
      return { success: false, error: allowedFile.error };
    }

    return sendPptxTextInspectRequest(allowedFile.data!.file_id);
  } catch (error) {
    console.error('[inspectWorshipPptxText]', error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : 'PPT 텍스트를 불러오는 중 오류가 발생했습니다',
    };
  }
}
```

Update `exportWorshipToPptx()` options:

```ts
export async function exportWorshipToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  contiId: string;
  scriptureReference: string;
  versesPerSlide?: number;
  verseTextFormat?: string;
  sermonTitle?: string | null;
  textOverrides?: PptxTextOverride[];
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
```

Add `textOverrides` to the `sendPptxExportRequest()` call:

```ts
      textOverrides: options.textOverrides,
```

- [ ] **Step 6: Run the transport tests and confirm they pass**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/export-service-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit transport plumbing**

Run:

```bash
git add lib/types.ts lib/pptx/export-service.ts lib/actions/worship-pptx-export.ts tests/export-service-source.test.mjs
git commit -m "feat: add worship ppt text transport"
```

## Task 2: Add Whitespace And Override Helpers

**Files:**
- Create: `lib/utils/visible-whitespace.ts`
- Create: `lib/utils/visible-whitespace.test.mjs`
- Create: `lib/utils/pptx-text-overrides.ts`
- Create: `lib/utils/pptx-text-overrides.test.mjs`

- [ ] **Step 1: Write failing visible whitespace tests**

Create `lib/utils/visible-whitespace.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadVisibleWhitespaceModule() {
  const source = await readFile(new URL('./visible-whitespace.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `visible-whitespace-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'visible-whitespace.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'visible-whitespace.mjs')).href}?v=${Date.now()}`);
}

test('renders spaces tabs and newlines as visible markers', async () => {
  const { toVisibleWhitespaceText } = await loadVisibleWhitespaceModule();

  assert.equal(toVisibleWhitespaceText('대표 기도\t김소망\n다같이'), '대표·기도→김소망↵\n다같이');
});

test('leaves ordinary text unchanged while marking only whitespace', async () => {
  const { toVisibleWhitespaceText } = await loadVisibleWhitespaceModule();

  assert.equal(toVisibleWhitespaceText('광고 1'), '광고·1');
  assert.equal(toVisibleWhitespaceText(''), '');
});
```

- [ ] **Step 2: Write failing PPT text override helper tests**

Create `lib/utils/pptx-text-overrides.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPptxTextOverridesModule() {
  const source = await readFile(new URL('./pptx-text-overrides.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `pptx-text-overrides-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'pptx-text-overrides.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'pptx-text-overrides.mjs')).href}?v=${Date.now()}`);
}

const structure = {
  file_id: 'ppt-1',
  sections: [
    {
      name: '봉독 말씀',
      slide_ids: [101],
      slides: [
        {
          slide_id: 101,
          slide_index: 0,
          section_name: '봉독 말씀',
          title: '봉독 말씀 1p',
          shapes: [
            { shape_id: '4', shape_name: 'TextBox 4', text: '요 3:16', left: 0, top: 0, width: 10, height: 10 },
          ],
        },
      ],
    },
    {
      name: '기도 봉헌 광고',
      slide_ids: [201],
      slides: [
        {
          slide_id: 201,
          slide_index: 1,
          section_name: '기도 봉헌 광고',
          title: '대표기도',
          shapes: [
            { shape_id: '7', shape_name: 'TextBox 7', text: '대표기도', left: 0, top: 0, width: 10, height: 10 },
          ],
        },
      ],
    },
  ],
};

test('chooses prayer offering announcement as the default section when present', async () => {
  const { getDefaultPptxTextSectionName } = await loadPptxTextOverridesModule();

  assert.equal(getDefaultPptxTextSectionName(structure), '기도 봉헌 광고');
});

test('builds text drafts and emits only changed overrides', async () => {
  const {
    buildInitialPptxTextDrafts,
    buildPptxTextOverrides,
    makePptxTextOverrideKey,
  } = await loadPptxTextOverridesModule();

  const drafts = buildInitialPptxTextDrafts(structure);
  drafts[makePptxTextOverrideKey(201, '7')] = '대표기도\n김소망 집사';

  assert.deepEqual(buildPptxTextOverrides(structure, drafts), [
    {
      slide_id: 201,
      shape_id: '7',
      text: '대표기도\n김소망 집사',
    },
  ]);
});
```

- [ ] **Step 3: Run helper tests and confirm they fail**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test lib/utils/visible-whitespace.test.mjs lib/utils/pptx-text-overrides.test.mjs
```

Expected: FAIL because the helper files do not exist.

- [ ] **Step 4: Implement `lib/utils/visible-whitespace.ts`**

Create `lib/utils/visible-whitespace.ts`:

```ts
export const VISIBLE_SPACE = '·';
export const VISIBLE_TAB = '→';
export const VISIBLE_NEWLINE = '↵';

export function toVisibleWhitespaceText(value: string): string {
  return value
    .replace(/ /g, VISIBLE_SPACE)
    .replace(/\t/g, VISIBLE_TAB)
    .replace(/\n/g, `${VISIBLE_NEWLINE}\n`);
}
```

- [ ] **Step 5: Implement `lib/utils/pptx-text-overrides.ts`**

Create `lib/utils/pptx-text-overrides.ts`:

```ts
import type { PptxTextOverride, PptxTextStructure } from '@/lib/types';

export const DEFAULT_PPT_TEXT_SECTION_NAME = '기도 봉헌 광고';

export function makePptxTextOverrideKey(slideId: number, shapeId: string): string {
  return `${slideId}:${shapeId}`;
}

export function getDefaultPptxTextSectionName(structure: PptxTextStructure | null): string {
  if (!structure || structure.sections.length === 0) return '';
  return (
    structure.sections.find((section) => section.name === DEFAULT_PPT_TEXT_SECTION_NAME)?.name ??
    structure.sections[0].name
  );
}

export function buildInitialPptxTextDrafts(structure: PptxTextStructure | null): Record<string, string> {
  if (!structure) return {};

  const drafts: Record<string, string> = {};
  for (const section of structure.sections) {
    for (const slide of section.slides) {
      for (const shape of slide.shapes) {
        drafts[makePptxTextOverrideKey(slide.slide_id, shape.shape_id)] = shape.text;
      }
    }
  }
  return drafts;
}

export function buildPptxTextOverrides(
  structure: PptxTextStructure | null,
  drafts: Record<string, string>
): PptxTextOverride[] {
  if (!structure) return [];

  const overrides: PptxTextOverride[] = [];
  for (const section of structure.sections) {
    for (const slide of section.slides) {
      for (const shape of slide.shapes) {
        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id);
        const draftText = drafts[key];
        if (draftText !== undefined && draftText !== shape.text) {
          overrides.push({
            slide_id: slide.slide_id,
            shape_id: shape.shape_id,
            text: draftText,
          });
        }
      }
    }
  }
  return overrides;
}
```

- [ ] **Step 6: Run helper tests and confirm they pass**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test lib/utils/visible-whitespace.test.mjs lib/utils/pptx-text-overrides.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit helpers**

Run:

```bash
git add lib/utils/visible-whitespace.ts lib/utils/visible-whitespace.test.mjs lib/utils/pptx-text-overrides.ts lib/utils/pptx-text-overrides.test.mjs
git commit -m "feat: add ppt text editor helpers"
```

## Task 3: Add Python PPTX Text Inspection And Override Application

**Files:**
- Modify: `api/pptx.py`
- Modify: `tests/pptx-source.test.mjs`

- [ ] **Step 1: Write failing Python source tests**

Append these tests to `tests/pptx-source.test.mjs`:

```js
test('pptx handler can inspect editable text sections', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def get_shape_stable_id\(shape, fallback_index\):/);
  assert.match(source, /def inspect_text_template\(pptx_path, file_id=''\):/);
  assert.match(source, /'X-Action', 'health'/);
  assert.match(source, /action == 'inspect-text'/);
  assert.match(source, /inspect_text_template\(template_path, file_id\)/);
});

test('pptx handler applies text overrides after generated export content', async () => {
  const source = await readFile(new URL('../api/pptx.py', import.meta.url), 'utf8');

  assert.match(source, /def find_shape_by_stable_id\(slide, shape_id\):/);
  assert.match(source, /def apply_text_overrides\(prs, text_overrides\):/);
  assert.match(source, /def process_export\(prs, songs, scripture=None, text_overrides=None\):/);
  assert.match(
    source,
    /result\.update\(process_all_songs\(prs, songs, sections, slide_id_map\)\)[\s\S]+if text_overrides:[\s\S]+result\.update\(apply_text_overrides\(prs, text_overrides\)\)/,
  );
  assert.match(source, /body\.get\('text_overrides', \[\]\)/);
});
```

- [ ] **Step 2: Run source tests and confirm they fail**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-source.test.mjs
```

Expected: FAIL because inspect-text and text override functions do not exist yet.

- [ ] **Step 3: Add text shape helpers after `get_first_textbox()` in `api/pptx.py`**

Insert:

```python
def get_shape_stable_id(shape, fallback_index):
    """Return a stable shape id from slide XML, falling back to slide-local index."""
    c_nv_pr = shape._element.find(f'.//{_pn("cNvPr")}')
    if c_nv_pr is not None and c_nv_pr.get('id'):
        return str(c_nv_pr.get('id'))
    return f'shape-{fallback_index}'


def get_shape_text_title(shape, fallback_title):
    """Return a compact title for a text shape."""
    text = shape.text_frame.text if shape.has_text_frame else ''
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), '')
    return first_line[:40] if first_line else fallback_title


def inspect_text_template(pptx_path, file_id=''):
    """Return section/slide/text-shape data for the PPT text editor."""
    prs = Presentation(pptx_path)
    sections = parse_sections(prs)
    slide_id_map = get_slide_id_map(prs)
    editable_sections = []

    for section in sections:
        slides = []
        for slide_id in section['slide_ids']:
            entry = slide_id_map.get(slide_id)
            slide = entry.get('slide') if entry else None
            if slide is None:
                continue

            shapes = []
            for shape_index, shape in enumerate(slide.shapes):
                if not shape.has_text_frame:
                    continue

                shape_id = get_shape_stable_id(shape, shape_index)
                shapes.append({
                    'shape_id': shape_id,
                    'shape_name': getattr(shape, 'name', '') or f'TextBox {shape_index + 1}',
                    'text': shape.text_frame.text,
                    'left': int(shape.left or 0),
                    'top': int(shape.top or 0),
                    'width': int(shape.width or 0),
                    'height': int(shape.height or 0),
                })

            if not shapes:
                continue

            slide_number = entry['index'] + 1
            slides.append({
                'slide_id': slide_id,
                'slide_index': entry['index'],
                'section_name': section['name'],
                'title': get_shape_text_title(slide.shapes[0], f"{section['name']} {slide_number}p")
                    if len(slide.shapes) > 0 else f"{section['name']} {slide_number}p",
                'shapes': shapes,
            })

        if slides:
            editable_sections.append({
                'name': section['name'],
                'slide_ids': section['slide_ids'],
                'slides': slides,
            })

    return {
        'file_id': file_id,
        'sections': editable_sections,
    }
```

- [ ] **Step 4: Add text override helpers before `process_export()` in `api/pptx.py`**

Insert:

```python
def find_shape_by_stable_id(slide, shape_id):
    """Find a shape on a slide by the stable id used by inspect_text_template."""
    target = str(shape_id)
    for shape_index, shape in enumerate(slide.shapes):
        if get_shape_stable_id(shape, shape_index) == target:
            return shape
    return None


def apply_text_overrides(prs, text_overrides):
    """Apply user-edited text overrides after generated export content."""
    if not isinstance(text_overrides, list) or not text_overrides:
        return {
            'text_overrides_applied': 0,
            'text_overrides_skipped': 0,
        }

    slide_id_map = get_slide_id_map(prs)
    applied = 0
    skipped = 0

    for override in text_overrides:
        if not isinstance(override, dict):
            skipped += 1
            continue

        slide_id = override.get('slide_id')
        shape_id = override.get('shape_id')
        text = override.get('text', '')
        if slide_id is None or not shape_id:
            skipped += 1
            continue

        entry = slide_id_map.get(int(slide_id))
        slide = entry.get('slide') if entry else None
        if slide is None:
            skipped += 1
            continue

        shape = find_shape_by_stable_id(slide, shape_id)
        if shape is None or not shape.has_text_frame:
            skipped += 1
            continue

        inject_text_into_shape(shape, str(text))
        applied += 1

    return {
        'text_overrides_applied': applied,
        'text_overrides_skipped': skipped,
    }
```

- [ ] **Step 5: Apply overrides from `process_export()`**

Change the function signature:

```python
def process_export(prs, songs, scripture=None, text_overrides=None):
```

Replace the final two lines of `process_export()`:

```python
    result.update(process_all_songs(prs, songs, sections, slide_id_map))
    if text_overrides:
        result.update(apply_text_overrides(prs, text_overrides))
    return result
```

Update `_handle_export_lyrics()`:

```python
            result_stats = process_export(
                prs,
                songs,
                body.get('scripture'),
                body.get('text_overrides', []),
            )
```

Add result fields to both overwrite and Blob `response_data` blocks:

```python
                if 'text_overrides_applied' in result_stats:
                    response_data["text_overrides_applied"] = result_stats['text_overrides_applied']
                    response_data["text_overrides_skipped"] = result_stats['text_overrides_skipped']
```

- [ ] **Step 6: Add GET inspect-text handling**

In `do_GET()`, add this branch immediately after the existing inspect branch that starts with `if action == 'inspect':` and ends after its `finally: shutil.rmtree(tmp_dir, ignore_errors=True)` block:

```python
            elif action == 'inspect-text':
                file_id = self.headers.get('X-File-Id', '')

                if not file_id:
                    self.send_json(400, {"success": False, "error": "X-File-Id header required"})
                    return

                service = get_drive_service()
                tmp_dir = tempfile.mkdtemp()
                template_path = os.path.join(tmp_dir, 'template.pptx')

                try:
                    download_file_by_id(service, file_id, template_path)
                    structure = inspect_text_template(template_path, file_id)
                    self.send_json(200, {"success": True, "data": structure})
                finally:
                    shutil.rmtree(tmp_dir, ignore_errors=True)
```

- [ ] **Step 7: Run PPTX source tests and confirm they pass**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-source.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Run Python tests and confirm existing PPTX mechanics still pass**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/pptx-python.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit Python inspection and overrides**

Run:

```bash
git add api/pptx.py tests/pptx-source.test.mjs
git commit -m "feat: inspect and override ppt text"
```

## Task 4: Build The PPT Text Editor Drawer Components

**Files:**
- Create: `components/worship-prep/visible-whitespace-textarea.tsx`
- Create: `components/worship-prep/pptx-text-editor-drawer.tsx`
- Modify: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: Write failing worship UI source test for the drawer component**

Append this test to `tests/worship-prep-source.test.mjs`:

```js
test('PPT text editor drawer defaults to prayer offering announcement section and renders whitespace editor', async () => {
  const drawerSource = await readFile(
    new URL('../components/worship-prep/pptx-text-editor-drawer.tsx', import.meta.url),
    'utf8',
  );
  const whitespaceSource = await readFile(
    new URL('../components/worship-prep/visible-whitespace-textarea.tsx', import.meta.url),
    'utf8',
  );

  assert.match(drawerSource, /DEFAULT_PPT_TEXT_SECTION_NAME/);
  assert.match(drawerSource, /getDefaultPptxTextSectionName\(structure\)/);
  assert.match(drawerSource, /PPT 텍스트 수정/);
  assert.match(drawerSource, /VisibleWhitespaceTextarea/);
  assert.match(whitespaceSource, /toVisibleWhitespaceText\(value\)/);
  assert.match(whitespaceSource, /text-transparent/);
  assert.match(whitespaceSource, /caret-foreground/);
});
```

- [ ] **Step 2: Run the source test and confirm it fails**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/worship-prep-source.test.mjs
```

Expected: FAIL because the component files do not exist.

- [ ] **Step 3: Create `VisibleWhitespaceTextarea`**

Create `components/worship-prep/visible-whitespace-textarea.tsx`:

```tsx
"use client"

import * as React from "react"

import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { toVisibleWhitespaceText } from "@/lib/utils/visible-whitespace"

interface VisibleWhitespaceTextareaProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> {
  value: string
  onChange: (value: string) => void
}

export function VisibleWhitespaceTextarea({
  value,
  onChange,
  className,
  ...props
}: VisibleWhitespaceTextareaProps) {
  const visibleValue = toVisibleWhitespaceText(value)

  return (
    <div className="relative">
      <pre
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 min-h-32 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 font-mono text-base leading-6 text-muted-foreground",
          "before:text-muted-foreground/60",
        )}
      >
        {visibleValue || " "}
      </pre>
      <Textarea
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={cn(
          "relative min-h-32 resize-y bg-transparent font-mono leading-6 text-transparent caret-foreground selection:bg-primary/25 [tab-size:4]",
          className,
        )}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `PptxTextEditorDrawer`**

Create `components/worship-prep/pptx-text-editor-drawer.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/ui/drawer"
import { VisibleWhitespaceTextarea } from "@/components/worship-prep/visible-whitespace-textarea"
import type { PptxTextStructure } from "@/lib/types"
import {
  DEFAULT_PPT_TEXT_SECTION_NAME,
  getDefaultPptxTextSectionName,
  makePptxTextOverrideKey,
} from "@/lib/utils/pptx-text-overrides"

interface PptxTextEditorDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  structure: PptxTextStructure | null
  loading: boolean
  error: string | null
  drafts: Record<string, string>
  onDraftsChange: (drafts: Record<string, string>) => void
  onReset: () => void
}

export function PptxTextEditorDrawer({
  open,
  onOpenChange,
  fileName,
  structure,
  loading,
  error,
  drafts,
  onDraftsChange,
  onReset,
}: PptxTextEditorDrawerProps) {
  const [selectedSectionName, setSelectedSectionName] = useState("")

  useEffect(() => {
    if (!open || !structure) return
    setSelectedSectionName((current) => {
      if (current && structure.sections.some((section) => section.name === current)) {
        return current
      }
      return getDefaultPptxTextSectionName(structure)
    })
  }, [open, structure])

  const selectedSection = useMemo(() => {
    if (!structure) return null
    return (
      structure.sections.find((section) => section.name === selectedSectionName) ??
      structure.sections.find((section) => section.name === DEFAULT_PPT_TEXT_SECTION_NAME) ??
      structure.sections[0] ??
      null
    )
  }, [selectedSectionName, structure])

  function updateDraft(slideId: number, shapeId: string, text: string) {
    const key = makePptxTextOverrideKey(slideId, shapeId)
    onDraftsChange({
      ...drafts,
      [key]: text,
    })
  }

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="PPT 텍스트 수정"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onReset} disabled={!structure || loading}>
            초기화
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            적용
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-sm text-muted-foreground">
            섹션을 선택하고 각 PPT 페이지의 텍스트를 수정하세요.
          </p>
        </div>

        {loading && (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            PPT 텍스트를 불러오는 중...
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </p>
        )}

        {structure && structure.sections.length === 0 && (
          <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            수정할 수 있는 텍스트가 없습니다.
          </p>
        )}

        {structure && structure.sections.length > 0 && (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {structure.sections.map((section) => (
                <Button
                  key={section.name}
                  type="button"
                  size="sm"
                  variant={section.name === selectedSection?.name ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => setSelectedSectionName(section.name)}
                >
                  {section.name}
                </Button>
              ))}
            </div>

            {selectedSection && (
              <div className="space-y-4">
                {selectedSection.slides.map((slide) => (
                  <div key={slide.slide_id} className="rounded-lg border bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {slide.slide_index + 1}p · {slide.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          텍스트 상자 {slide.shapes.length}개
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 p-4">
                      {slide.shapes.map((shape, index) => {
                        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id)
                        return (
                          <div key={key} className="space-y-2">
                            <label className="text-sm font-medium" htmlFor={`ppt-text-${key}`}>
                              {shape.shape_name || `텍스트 상자 ${index + 1}`}
                            </label>
                            <VisibleWhitespaceTextarea
                              id={`ppt-text-${key}`}
                              value={drafts[key] ?? shape.text}
                              onChange={(text) => updateDraft(slide.slide_id, shape.shape_id, text)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  )
}
```

- [ ] **Step 5: Run the source test and confirm it passes**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit drawer components**

Run:

```bash
git add components/worship-prep/visible-whitespace-textarea.tsx components/worship-prep/pptx-text-editor-drawer.tsx tests/worship-prep-source.test.mjs
git commit -m "feat: add worship ppt text drawer"
```

## Task 5: Integrate Drawer Into Worship Export Confirmation

**Files:**
- Modify: `components/worship-prep/worship-pptx-export-button.tsx`
- Modify: `components/layout/app-shell.tsx`
- Modify: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: Write failing integration source test**

Append this test to `tests/worship-prep-source.test.mjs`:

```js
test('worship pptx confirm step opens text editor drawer and exports text overrides', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/worship-pptx-export-button.tsx', import.meta.url),
    'utf8',
  );
  const appShellSource = await readFile(
    new URL('../components/layout/app-shell.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /PptxTextEditorDrawer/);
  assert.match(source, /inspectWorshipPptxText/);
  assert.match(source, /buildInitialPptxTextDrafts/);
  assert.match(source, /buildPptxTextOverrides/);
  assert.match(source, /modal=\{pptxTextDrawerOpen \? false : true\}/);
  assert.match(source, /PPT 텍스트 수정/);
  assert.match(source, /textOverrides/);
  assert.match(appShellSource, /isOpen \? "z-\[60\]" : "z-50"/);
  assert.match(appShellSource, /isOpen \? "md:z-\[60\] md:w-\[40%\]" : "md:z-auto md:w-0 md:border-l-0"/);
});
```

- [ ] **Step 2: Run the source test and confirm it fails**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/worship-prep-source.test.mjs
```

Expected: FAIL because the export modal has not been wired to the drawer.

- [ ] **Step 3: Update imports in `worship-pptx-export-button.tsx`**

Add `PptxTextEditorDrawer`:

```ts
import { PptxTextEditorDrawer } from "@/components/worship-prep/pptx-text-editor-drawer"
```

Update the action import:

```ts
import {
  exportWorshipToPptx,
  getContiForWorshipPptxExport,
  inspectWorshipPptxText,
  previewScripturePptx,
} from "@/lib/actions/worship-pptx-export"
```

Update type imports:

```ts
import type {
  Conti,
  ContiWithSongs,
  PptxDriveFile,
  PptxExportScripturePageData,
  PptxTextStructure,
} from "@/lib/types"
```

Add helper imports:

```ts
import {
  buildInitialPptxTextDrafts,
  buildPptxTextOverrides,
} from "@/lib/utils/pptx-text-overrides"
```

- [ ] **Step 4: Add drawer state after scripture preview state**

Add:

```ts
  const [pptxTextDrawerOpen, setPptxTextDrawerOpen] = useState(false)
  const [pptxTextStructure, setPptxTextStructure] = useState<PptxTextStructure | null>(null)
  const [pptxTextLoading, setPptxTextLoading] = useState(false)
  const [pptxTextError, setPptxTextError] = useState<string | null>(null)
  const [pptxTextDrafts, setPptxTextDrafts] = useState<Record<string, string>>({})
```

Add this memo after `songData`:

```ts
  const textOverrides = useMemo(
    () => buildPptxTextOverrides(pptxTextStructure, pptxTextDrafts),
    [pptxTextDrafts, pptxTextStructure]
  )
```

- [ ] **Step 5: Reset drawer state with the dialog**

In `resetDialog()`, add:

```ts
    setPptxTextDrawerOpen(false)
    setPptxTextStructure(null)
    setPptxTextLoading(false)
    setPptxTextError(null)
    setPptxTextDrafts({})
```

In `handleSelectFile(file)`, add before `setStep("worship-data")`:

```ts
    setPptxTextStructure(null)
    setPptxTextDrafts({})
    setPptxTextError(null)
```

- [ ] **Step 6: Add drawer load and reset handlers**

Add these functions before `handleExport()`:

```ts
  function handleOpenPptxTextEditor() {
    if (!selectedFile) {
      toast.error("PPT 파일을 선택해 주세요")
      return
    }

    setPptxTextDrawerOpen(true)

    if (pptxTextStructure?.file_id === selectedFile.file_id || pptxTextLoading) {
      return
    }

    setPptxTextLoading(true)
    setPptxTextError(null)
    inspectWorshipPptxText(selectedFile.file_id).then((result) => {
      if (!result.success || !result.data) {
        const message = result.error || "PPT 텍스트를 불러오지 못했습니다"
        setPptxTextError(message)
        toast.error(message)
        setPptxTextLoading(false)
        return
      }

      setPptxTextStructure(result.data)
      setPptxTextDrafts(buildInitialPptxTextDrafts(result.data))
      setPptxTextLoading(false)
    })
  }

  function handleResetPptxTextDrafts() {
    setPptxTextDrafts(buildInitialPptxTextDrafts(pptxTextStructure))
  }
```

- [ ] **Step 7: Pass overrides to export**

In the `exportWorshipToPptx()` call, add:

```ts
        textOverrides,
```

- [ ] **Step 8: Make the dialog non-modal while drawer is open**

Change the dialog root:

```tsx
      <Dialog open={open} onOpenChange={handleOpenChange} modal={pptxTextDrawerOpen ? false : true}>
```

- [ ] **Step 9: Add confirm-step entry button**

In `DialogFooter`, before the existing confirm export button block or immediately before the confirm `내보내기` button, add:

```tsx
            {step === "confirm" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenPptxTextEditor}
                disabled={isPending || pptxTextLoading}
              >
                {pptxTextLoading ? "불러오는 중..." : "PPT 텍스트 수정"}
              </Button>
            )}
```

- [ ] **Step 10: Render the drawer next to the dialog**

Add this after the closing `</Dialog>` but before the fragment closes:

```tsx
      <PptxTextEditorDrawer
        open={pptxTextDrawerOpen}
        onOpenChange={setPptxTextDrawerOpen}
        fileName={selectedFile?.name ?? ""}
        structure={pptxTextStructure}
        loading={pptxTextLoading}
        error={pptxTextError}
        drafts={pptxTextDrafts}
        onDraftsChange={setPptxTextDrafts}
        onReset={handleResetPptxTextDrafts}
      />
```

- [ ] **Step 11: Raise the app drawer above modal overlays**

In `components/layout/app-shell.tsx`, replace the current `<aside>` element with this version:

```tsx
      <aside
        ref={portalRef}
        className={cn(
          "shrink-0 flex flex-col bg-background overflow-hidden",
          "fixed inset-x-0 bottom-0 h-[90vh] rounded-t-2xl shadow-xl",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "z-[60]" : "z-50",
          isOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
          "md:sticky md:inset-auto md:top-0 md:h-screen md:max-h-none md:rounded-none md:border-l md:shadow-none",
          "md:transition-[width] md:duration-300 md:ease-in-out",
          "md:translate-y-0 md:pointer-events-auto",
          isOpen ? "md:z-[60] md:w-[40%]" : "md:z-auto md:w-0 md:border-l-0",
        )}
      />
```

The important behavior is that an open drawer uses `z-[60]` on mobile and desktop, so it sits above the export dialog overlay while the dialog is switched to non-modal mode.

- [ ] **Step 12: Run UI source tests and confirm they pass**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 13: Commit UI integration**

Run:

```bash
git add components/worship-prep/worship-pptx-export-button.tsx components/layout/app-shell.tsx tests/worship-prep-source.test.mjs
git commit -m "feat: wire ppt text drawer into worship export"
```

## Task 6: Final Verification

**Files:**
- No new files unless fixes are required by verification.

- [ ] **Step 1: Run focused source and helper tests**

Run:

```bash
/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/export-service-source.test.mjs tests/worship-prep-source.test.mjs tests/pptx-source.test.mjs lib/utils/visible-whitespace.test.mjs lib/utils/pptx-text-overrides.test.mjs lib/utils/pptx-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run existing project tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
yarn typeCheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Start the PPTX dev server**

Run:

```bash
env PPTX_DEV_PORT=3002 /Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/pptx-dev-server.py
```

Expected: server listens on `http://127.0.0.1:3002/api/pptx`.

- [ ] **Step 6: Start the Next.js dev server**

Run in a separate terminal:

```bash
env PPTX_API_URL=http://127.0.0.1:3002/api/pptx PATH=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm dev
```

Expected: app listens on `http://localhost:3000`.

- [ ] **Step 7: Browser verify the UI path**

Open:

```text
http://localhost:3000/worship-prep
```

Expected:

- `예배 PPT 내보내기` opens the existing export dialog.
- On `내보내기 확인`, `PPT 텍스트 수정` appears next to `뒤로` and `내보내기`.
- Clicking `PPT 텍스트 수정` opens the right drawer.
- `기도 봉헌 광고` is selected by default when present.
- Spaces display as `·`, tabs display as `→`, and line breaks display as `↵`.
- Editing drawer text updates local draft state without closing the export dialog.

- [ ] **Step 8: Browser verify final export payload path**

With a safe test PPT file selected, edit one text box in `기도 봉헌 광고`, choose new-file export, and click `내보내기`.

Expected:

- Export completes.
- The downloaded/generated PPT contains the edited text.
- Existing scripture, sermon title, and song generation still work.

- [ ] **Step 9: Final status**

Run:

```bash
git status --short
```

Expected: clean worktree.
