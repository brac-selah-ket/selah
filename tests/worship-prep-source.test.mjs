import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worship pptx confirm step shows the sermon title used for export', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/worship-pptx-export-button.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /sermonTitle:\s*item\.title/);
  assert.match(
    source,
    /step === "confirm"[\s\S]+말씀 제목[\s\S]+\{item\.title \|\| "-"\}/,
  );
});

test('worship prep date selector refreshes immediately on calendar change', async () => {
  const pageSource = await readFile(
    new URL('../app/(authenticated)/worship-prep/page.tsx', import.meta.url),
    'utf8',
  );
  const selectorSource = await readFile(
    new URL('../components/worship-prep/worship-date-selector.tsx', import.meta.url),
    'utf8',
  );

  assert.match(pageSource, /import \{ WorshipDateSelector \}/);
  assert.match(pageSource, /<WorshipDateSelector selectedDate=\{selectedDate\} \/>/);
  assert.doesNotMatch(pageSource, /<form[\s\S]+method='GET'/);
  assert.doesNotMatch(pageSource, /주차 변경/);

  assert.match(selectorSource, /"use client"/);
  assert.match(selectorSource, /useRouter\(\)/);
  assert.match(selectorSource, /DatePicker/);
  assert.match(selectorSource, /onChange=\{handleChange\}/);
  assert.match(selectorSource, /router\.push\(`\$\{pathname\}\?\$\{params\.toString\(\)\}`\)/);
});

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
