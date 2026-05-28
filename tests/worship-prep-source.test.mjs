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

test('PPT text editor drawer uses updater drafts and textarea keeps overlay scroll aligned', async () => {
  const drawerSource = await readFile(
    new URL('../components/worship-prep/pptx-text-editor-drawer.tsx', import.meta.url),
    'utf8',
  );
  const whitespaceSource = await readFile(
    new URL('../components/worship-prep/visible-whitespace-textarea.tsx', import.meta.url),
    'utf8',
  );

  assert.match(drawerSource, /React\.Dispatch<React\.SetStateAction<Record<string, string>>>/);
  assert.match(drawerSource, /onDraftsChange\(\(current\) => \(\{/);
  assert.doesNotMatch(drawerSource, /aria-label=\{`\$\{slide\.title/);

  assert.match(whitespaceSource, /overlayRef/);
  assert.match(whitespaceSource, /textareaRef/);
  assert.match(whitespaceSource, /handleScroll/);
  assert.match(whitespaceSource, /overlayRef\.current\.scrollTop = event\.currentTarget\.scrollTop/);
  assert.match(whitespaceSource, /onScroll=\{handleScroll\}/);
});

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
  assert.match(source, /if \(!newOpen && pptxTextDrawerOpen\) \{\s*return\s*\}/);
  assert.match(source, /PPT 텍스트 수정/);
  assert.match(source, /textOverrides/);
  assert.match(appShellSource, /isOpen \? "z-\[60\]" : "z-50"/);
  assert.match(appShellSource, /isOpen \? "md:z-\[60\] md:w-\[40%\]" : "md:z-auto md:w-0 md:border-l-0"/);
});

test('worship pptx export guards stale drawer and scripture preview async results', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/worship-pptx-export-button.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /useRef/);
  assert.match(source, /pptxTextRequestSeqRef/);
  assert.match(source, /pptxTextRequestSeqRef\.current \+= 1/);
  assert.match(source, /pptxTextStructure\?\.file_id === selectedFile\.file_id/);
  assert.match(source, /const inspectedFileId = selectedFile\.file_id/);
  assert.match(source, /selectedFileIdRef\.current !== inspectedFileId/);
  assert.match(source, /requestSeq !== pptxTextRequestSeqRef\.current/);
  assert.match(source, /getScripturePreviewRequestKey/);
  assert.match(source, /const requestKey = getScripturePreviewRequestKey/);
  assert.match(source, /currentKey !== requestKey/);
  assert.match(source, /if \(!preview \|\| !isCurrentScripturePreview\(preview\)\) return/);
  assert.match(source, /disabled=\{isPending \|\| pptxTextDrawerOpen\}/);
  assert.match(source, /disabled=\{isPending \|\| pptxTextLoading \|\| pptxTextDrawerOpen\}/);
});
