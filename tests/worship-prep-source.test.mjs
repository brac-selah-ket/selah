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
  assert.match(drawerSource, /getDefaultPptxTextSectionId\(structure\)/);
  assert.match(drawerSource, /selectedSectionId/);
  assert.match(drawerSource, /PPT 텍스트 수정/);
  assert.match(drawerSource, /VisibleWhitespaceTextarea/);
  assert.match(whitespaceSource, /renderVisibleWhitespace\(value\)/);
  assert.match(whitespaceSource, /text-transparent/);
  assert.match(whitespaceSource, /caret-foreground/);
});

test('PPT text editor renders tabs with native tab layout and a non-layout marker', async () => {
  const whitespaceSource = await readFile(
    new URL('../components/worship-prep/visible-whitespace-textarea.tsx', import.meta.url),
    'utf8',
  );

  assert.match(whitespaceSource, /renderVisibleWhitespace/);
  assert.match(whitespaceSource, /<React\.Fragment key=\{`tab-\$\{index\}`\}>/);
  assert.match(
    whitespaceSource,
    /<span className="inline-block w-0 overflow-visible text-muted-foreground\/70">/,
  );
  assert.match(whitespaceSource, /\{"\\t"\}/);
  assert.match(whitespaceSource, /\[tab-size:4\]/);
  assert.doesNotMatch(whitespaceSource, /bg-primary\/15/);
  assert.doesNotMatch(whitespaceSource, /ring-primary\/25/);
  assert.doesNotMatch(whitespaceSource, /rounded-sm/);
  assert.doesNotMatch(whitespaceSource, /TAB_TOKEN_WIDTH_CH/);
  assert.doesNotMatch(whitespaceSource, /width: `\$\{TAB_TOKEN_WIDTH_CH\}ch`/);
  assert.doesNotMatch(whitespaceSource, /VISIBLE_TAB_PADDING/);
  assert.doesNotMatch(whitespaceSource, /toVisibleWhitespaceText\(value\)/);
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

test('PPT text editor keeps Tab inside the focused textarea', async () => {
  const whitespaceSource = await readFile(
    new URL('../components/worship-prep/visible-whitespace-textarea.tsx', import.meta.url),
    'utf8',
  );

  assert.match(whitespaceSource, /handleKeyDown/);
  assert.match(whitespaceSource, /event\.key !== "Tab"/);
  assert.match(whitespaceSource, /event\.preventDefault\(\)/);
  assert.match(whitespaceSource, /selectionStart/);
  assert.match(whitespaceSource, /selectionEnd/);
  assert.match(whitespaceSource, /setSelectionRange/);
  assert.match(whitespaceSource, /onKeyDown=\{handleKeyDown\}/);
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
  assert.match(appShellSource, /isOpen \? "md:z-\[60\] md:w-\[min\(640px,76vw\)\] xl:w-\[40%\]" : "md:z-auto md:w-0 md:border-l-0"/);
});

test('worship pptx confirm step shows PPT text change count in summary and edit button', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/worship-pptx-export-button.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /buildPptxTextChangeSummary/);
  assert.match(source, /pptxTextChangeSummary/);
  assert.match(source, /PPT 텍스트/);
  assert.match(source, /\{pptxTextChangeSummary\.total\}곳 수정됨/);
  assert.match(source, /PPT 텍스트 수정 · \{pptxTextChangeSummary\.total\}/);
});

test('PPT text editor drawer highlights changed text and can show only changed items', async () => {
  const drawerSource = await readFile(
    new URL('../components/worship-prep/pptx-text-editor-drawer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(drawerSource, /buildPptxTextChangeSummary/);
  assert.match(drawerSource, /showChangedOnly/);
  assert.match(drawerSource, /수정된 텍스트만 보기/);
  assert.match(drawerSource, /changedShapeKeys/);
  assert.match(drawerSource, /changedSlides/);
  assert.match(drawerSource, /border-primary\/50 bg-primary\/5/);
  assert.match(drawerSource, /border-primary\/60/);
  assert.match(drawerSource, /수정됨/);
  assert.match(drawerSource, /변경 없음/);
});

test('PPT text editor drawer closes from outside click and uses a full-row native checkbox filter', async () => {
  const drawerSource = await readFile(
    new URL('../components/worship-prep/pptx-text-editor-drawer.tsx', import.meta.url),
    'utf8',
  );
  const drawerPrimitiveSource = await readFile(
    new URL('../components/ui/drawer.tsx', import.meta.url),
    'utf8',
  );
  const appShellSource = await readFile(
    new URL('../components/layout/app-shell.tsx', import.meta.url),
    'utf8',
  );

  assert.match(drawerPrimitiveSource, /fixed inset-0 z-\[55\] bg-black\/40/);
  assert.match(drawerPrimitiveSource, /md:bg-transparent/);
  assert.match(drawerPrimitiveSource, /onClick=\{handleClose\}/);
  assert.doesNotMatch(drawerPrimitiveSource, /bg-black\/40[^\n"]*md:hidden/);
  assert.match(appShellSource, /md:w-\[min\(640px,76vw\)\] xl:w-\[40%\]/);
  assert.doesNotMatch(appShellSource, /md:w-\[40%\]/);

  assert.match(drawerSource, /<label[\s\S]+수정된 텍스트만 보기[\s\S]+<input/);
  assert.match(drawerSource, /type="checkbox"/);
  assert.match(drawerSource, /cursor-pointer/);
  assert.doesNotMatch(drawerSource, /Checkbox/);
});

test('PPT text editor labels text boxes by order and keeps content as a preview', async () => {
  const drawerSource = await readFile(
    new URL('../components/worship-prep/pptx-text-editor-drawer.tsx', import.meta.url),
    'utf8',
  );

  assert.match(drawerSource, /getPptxTextShapePreview/);
  assert.match(drawerSource, /getPptxTextShapePreview\(value\)/);
  assert.match(drawerSource, /function getPptxTextShapePreview\(value: string\)/);
  assert.match(drawerSource, /visibleShapes\.map\(\(shape, shapeIndex\)/);
  assert.match(drawerSource, /\{`텍스트 \$\{shapeIndex \+ 1\}`\}/);
  assert.match(drawerSource, /shapePreview/);
  assert.match(drawerSource, /text-muted-foreground/);
  assert.doesNotMatch(drawerSource, /shape\.shape_name \|\| shape\.text/);
  assert.doesNotMatch(drawerSource, /\{shape\.shape_name \|\| `텍스트 \$\{shape\.shape_id\}`\}/);
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
