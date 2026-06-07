import { test } from 'vitest';
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

test('PPT text editor drawer keeps outside click disabled and uses a full-row native checkbox filter', async () => {
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
  const backdropSource = drawerPrimitiveSource.match(
    /\{\/\* Backdrop \*\/\}[\s\S]+?aria-hidden="true"[\s\S]+?\/>/,
  )?.[0];
  assert.ok(backdropSource);
  assert.doesNotMatch(backdropSource, /onClick=\{handleClose\}/);
  assert.match(drawerPrimitiveSource, /<Button[\s\S]+onClick=\{handleClose\}/);
  assert.doesNotMatch(drawerPrimitiveSource, /bg-black\/40[^\n"]*md:hidden/);
  assert.match(appShellSource, /md:w-\[min\(640px,76vw\)\] xl:w-\[40%\]/);
  assert.doesNotMatch(appShellSource, /md:w-\[40%\]/);

  assert.match(drawerSource, /<label[\s\S]+수정된 텍스트만 보기[\s\S]+<input/);
  assert.match(drawerSource, /type="checkbox"/);
  assert.match(drawerSource, /cursor-pointer/);
  assert.doesNotMatch(drawerSource, /Checkbox/);
});

test('conti and song drawer subdialogs opt above drawer without changing PPT export dialog layer', async () => {
  const dialogSource = await readFile(
    new URL('../components/ui/dialog.tsx', import.meta.url),
    'utf8',
  );
  const alertDialogSource = await readFile(
    new URL('../components/ui/alert-dialog.tsx', import.meta.url),
    'utf8',
  );
  const ocrSource = await readFile(
    new URL('../components/contis/ocr-region-selector.tsx', import.meta.url),
    'utf8',
  );
  const arrangementSource = await readFile(
    new URL('../components/shared/arrangement-editor/arrangement-editor.tsx', import.meta.url),
    'utf8',
  );
  const worshipExportSource = await readFile(
    new URL('../components/worship-prep/worship-pptx-export-button.tsx', import.meta.url),
    'utf8',
  );

  assert.match(dialogSource, /overlayClassName/);
  assert.match(dialogSource, /<DialogOverlay className=\{overlayClassName\} \/>/);
  assert.match(alertDialogSource, /overlayClassName/);
  assert.match(alertDialogSource, /<AlertDialogOverlay className=\{overlayClassName\} \/>/);

  assert.match(ocrSource, /overlayClassName="z-\[70\]"/);
  assert.match(ocrSource, /className="z-\[70\] h-\[92vh\] flex flex-col"/);
  assert.match(arrangementSource, /<DialogContent[\s\S]+overlayClassName="z-\[70\]"[\s\S]+className="z-\[70\] !w-screen/);
  assert.match(arrangementSource, /<AlertDialogContent[\s\S]+overlayClassName="z-\[70\]"[\s\S]+className="z-\[70\]"/);

  assert.match(worshipExportSource, /modal=\{pptxTextDrawerOpen \? false : true\}/);
  assert.doesNotMatch(worshipExportSource, /overlayClassName="z-\[70\]"/);
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

test('conti detail header uses shared button variants for non-destructive actions', async () => {
  const source = await readFile(
    new URL('../app/(authenticated)/contis/[id]/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /import \{ Button \} from "@\/components\/ui\/button"/);
  assert.doesNotMatch(source, /outlineButtonClass/);
  assert.doesNotMatch(source, /iconButtonClass/);
  assert.doesNotMatch(source, /defaultButtonClass/);
  assert.doesNotMatch(source, /className=\{cn\(/);
  assert.match(source, /<Button[\s\S]+variant="outline"[\s\S]+render=\{<Link[\s\S]+PDF 내보내기/);
  assert.match(source, /<Button[\s\S]+variant="outline"[\s\S]+render=\{<Link[\s\S]+편집/);
  assert.match(source, /<ContiDeleteButton contiId=\{conti\.id\} \/>/);
});

test('conti song drawer uses wide controlled sheet music preview instead of nested preview dialog', async () => {
  const dialogSource = await readFile(
    new URL('../components/ui/dialog.tsx', import.meta.url),
    'utf8',
  );
  const drawerContextSource = await readFile(
    new URL('../components/ui/drawer-context.tsx', import.meta.url),
    'utf8',
  );
  const drawerSource = await readFile(
    new URL('../components/ui/drawer.tsx', import.meta.url),
    'utf8',
  );
  const appShellSource = await readFile(
    new URL('../components/layout/app-shell.tsx', import.meta.url),
    'utf8',
  );
  const previewSource = await readFile(
    new URL('../components/shared/sheet-music-preview.tsx', import.meta.url),
    'utf8',
  );
  const gallerySource = await readFile(
    new URL('../components/songs/sheet-music-gallery.tsx', import.meta.url),
    'utf8',
  );
  const arrangementTypesSource = await readFile(
    new URL('../components/shared/arrangement-editor/types.ts', import.meta.url),
    'utf8',
  );
  const arrangementSource = await readFile(
    new URL('../components/shared/arrangement-editor/arrangement-editor.tsx', import.meta.url),
    'utf8',
  );
  const contiSongEditorSource = await readFile(
    new URL('../components/contis/conti-song-editor.tsx', import.meta.url),
    'utf8',
  );
  const presetEditorSource = await readFile(
    new URL('../components/songs/preset-editor.tsx', import.meta.url),
    'utf8',
  );

  assert.match(dialogSource, /type DialogContentSize = "sm" \| "md" \| "lg" \| "xl" \| "full"/);
  assert.match(dialogSource, /size = "sm"/);
  assert.match(dialogSource, /data-size=\{size\}/);
  assert.match(dialogSource, /dialogContentSizeClassName\[size\]/);

  assert.match(drawerContextSource, /export type DrawerSize = "default" \| "wide"/);
  assert.match(drawerContextSource, /drawerSize/);
  assert.match(drawerContextSource, /setDrawerSize/);
  assert.match(drawerSource, /size = "default"/);
  assert.match(drawerSource, /setDrawerSize\(open \? size : "default"\)/);
  assert.match(appShellSource, /drawerSize === "wide"/);
  assert.match(appShellSource, /md:w-\[min\(1040px,calc\(100vw-11\.25rem\)\)\]/);

  assert.match(previewSource, /export interface SheetMusicPreviewItem/);
  assert.match(previewSource, /previewState: "loading" \| "ready" \| "unavailable"/);
  assert.doesNotMatch(previewSource, /previewState\?:/);
  assert.match(previewSource, /item\.previewState === "ready" && item\.thumbnailUrl/);
  assert.doesNotMatch(previewSource, /\{item\.thumbnailUrl \? \(/);
  assert.match(previewSource, /export function SheetMusicPreviewPane/);
  assert.match(previewSource, /data-slot="sheet-music-preview-pane"/);

  assert.match(gallerySource, /previewMode = "dialog"/);
  assert.match(gallerySource, /previewMode\?: "dialog" \| "controlled"/);
  assert.match(gallerySource, /onPreviewChange\?: \(item: SheetMusicPreviewItem \| null\) => void/);
  assert.match(gallerySource, /previewMode === "controlled"/);
  assert.match(gallerySource, /previewMode === "dialog" &&/);
  assert.match(gallerySource, /<DialogContent size="xl"/);
  assert.doesNotMatch(gallerySource, /hoveredFileId/);
  assert.match(gallerySource, /<button\s+type="button"/);
  assert.match(gallerySource, /onFocus=\{\(\) => \{/);
  assert.match(gallerySource, /group-focus-within:opacity-100/);

  assert.match(arrangementSource, /function renderSheetMusicWorkspace/);
  assert.match(arrangementSource, /data-slot="sheet-music-workspace"/);
  assert.match(
    arrangementSource,
    /const hasSheetMusicWorkspace = availableSheetMusic\.length > 0 \|\| Boolean\(sheetMusicManagementSlot\)/,
  );
  assert.match(
    arrangementSource,
    /const hasDrawerPreview = sheetMusicWorkspacePreview && hasSheetMusicWorkspace/,
  );
  assert.doesNotMatch(
    arrangementSource,
    /const hasDrawerPreview = mode === "conti-song" && availableSheetMusic\.length > 0/,
  );
  assert.match(arrangementSource, /md:col-start-1 md:row-start-1/);
  assert.doesNotMatch(arrangementSource, /renderSheetMusicWorkspace\(\{ mobile:/);
  assert.equal((arrangementSource.match(/\{renderSheetMusicWorkspace\(\)\}/g) ?? []).length, 1);
  assert.match(arrangementSource, /SheetMusicSelector/);
  assert.match(arrangementSource, /sheetMusicManagementSlot/);
  assert.doesNotMatch(arrangementSource, /space-y-4 border-t pt-8/);
  assert.match(contiSongEditorSource, /sheetMusicManagementSlot=\{\s*<div className="space-y-4">/);
  assert.doesNotMatch(contiSongEditorSource, /space-y-4 rounded-lg border bg-background\/50 p-4/);

  assert.match(arrangementTypesSource, /sheetMusicPreviewItem\?: SheetMusicPreviewItem \| null/);
  assert.match(arrangementTypesSource, /sheetMusicWorkspacePreview\?: boolean/);
  assert.match(arrangementSource, /SheetMusicPreviewPane/);
  assert.match(arrangementSource, /hasDrawerPreview/);
  assert.match(arrangementSource, /size=\{hasDrawerPreview \? "wide" : "default"\}/);
  assert.match(arrangementSource, /md:grid-cols-\[minmax\(320px,0\.9fr\)_minmax\(360px,1fr\)\]/);

  assert.match(contiSongEditorSource, /useState<SheetMusicPreviewItem \| null>\(null\)/);
  assert.match(contiSongEditorSource, /sheetMusicWorkspacePreview/);
  assert.match(contiSongEditorSource, /previewMode="controlled"/);
  assert.match(contiSongEditorSource, /onPreviewChange=\{setSheetMusicPreviewItem\}/);
  assert.match(contiSongEditorSource, /sheetMusicPreviewItem=\{sheetMusicPreviewItem\}/);

  assert.match(presetEditorSource, /SheetMusicPreviewItem/);
  assert.match(presetEditorSource, /SheetMusicGallery/);
  assert.match(presetEditorSource, /useState<SheetMusicPreviewItem \| null>\(null\)/);
  assert.match(presetEditorSource, /sheetMusicWorkspacePreview/);
  assert.match(presetEditorSource, /sheetMusicPreviewItem=\{sheetMusicPreviewItem\}/);
  assert.match(presetEditorSource, /previewMode="controlled"/);
  assert.match(presetEditorSource, /onPreviewChange=\{setSheetMusicPreviewItem\}/);
  assert.doesNotMatch(presetEditorSource, /SheetMusicUploader/);
});

test('sheet music lyrics generator uses Gemini images and appends generated pages', async () => {
  const lyricsEditorSource = await readFile(
    new URL('../components/contis/lyrics-editor.tsx', import.meta.url),
    'utf8',
  );
  const generatorSource = await readFile(
    new URL('../components/contis/sheet-music-lyrics-generator-dialog.tsx', import.meta.url),
    'utf8',
  );
  const imageHelperSource = await readFile(
    new URL('../lib/utils/sheet-music-lyrics-images.ts', import.meta.url),
    'utf8',
  );
  const actionSource = await readFile(
    new URL('../lib/actions/sheet-music-lyrics.ts', import.meta.url),
    'utf8',
  );
  const actionConfigSource = await readFile(
    new URL('../lib/actions/sheet-music-lyrics-config.ts', import.meta.url),
    'utf8',
  );
  const envExample = await readFile(
    new URL('../.env.example', import.meta.url),
    'utf8',
  );

  assert.match(lyricsEditorSource, /SheetMusicLyricsGeneratorDialog/);
  assert.match(lyricsEditorSource, /가사 자동 생성/);
  assert.match(lyricsEditorSource, /setLyrics\(prev => \[\.\.\.prev, \.\.\.generatedPages\]\)/);
  assert.doesNotMatch(lyricsEditorSource, /setLyrics\(generatedPages\)/);

  assert.match(generatorSource, /generateLyricsFromSheetMusicImages/);
  assert.match(generatorSource, /buildSheetMusicLyricsImagePages/);
  assert.match(generatorSource, /checkSpelling/);
  assert.match(generatorSource, /validateLyricsPage/);
  assert.match(generatorSource, /TextCheckIcon/);
  assert.match(generatorSource, /Cancel01Icon/);
  assert.match(generatorSource, /removeGeneratedPage/);
  assert.match(generatorSource, /overlayClassName="z-\[70\]"/);
  assert.match(generatorSource, /className="z-\[70\][^"]*flex[^"]*max-h-\[85vh\][^"]*flex-col/);
  assert.match(generatorSource, /onChange=\{\(event\) => updateGeneratedPage\(index, event\.target\.value\)\}/);
  assert.doesNotMatch(generatorSource, /readOnly/);
  assert.match(generatorSource, /aria-label="맞춤법 검사"/);
  assert.match(generatorSource, /icon=\{TextCheckIcon\}[\s\S]+맞춤법 검사/);
  assert.match(generatorSource, /aria-label="페이지 제거"/);
  assert.match(generatorSource, /setGeneratedLyrics\(\(current\) => current\.filter/);
  assert.match(generatorSource, /else if \(pageIndex > index\) next\[pageIndex - 1\] = value/);
  assert.match(generatorSource, /교정 적용/);
  assert.match(generatorSource, /원본 유지/);
  assert.match(generatorSource, /가사에 추가/);
  assert.doesNotMatch(generatorSource, /sectionOrder/);
  assert.doesNotMatch(generatorSource, /sectionLyricsMap/);

  assert.match(imageHelperSource, /'use client'/);
  assert.match(imageHelperSource, /getPdfPageCount/);
  assert.match(imageHelperSource, /renderPdfPagesToDataUrls/);
  assert.match(imageHelperSource, /for \(let pageNumber = 1; pageNumber <= pageCount; pageNumber\+\+\)/);
  assert.match(imageHelperSource, /renderPdfPagesToDataUrls\(\s*assetUrl,\s*\[pageNumber\],\s*2,/);
  assert.match(imageHelperSource, /toDataURL\('image\/jpeg', GEMINI_LYRICS_IMAGE_JPEG_QUALITY\)/);

  assert.match(actionConfigSource, /DEFAULT_GEMINI_LYRICS_MODEL = 'gemini-3\.1-pro-preview'/);
  assert.match(actionSource, /DEFAULT_GEMINI_LYRICS_MODEL/);
  assert.match(actionSource, /normalizeGeneratedLyricsPages/);
  assert.match(actionSource, /회중 찬양용 예배 PPT\/슬라이드쇼/);
  assert.match(actionSource, /최대 2줄/);
  assert.match(actionSource, /문장\/고백\/호흡 단위/);
  assert.match(actionSource, /responseMimeType: 'application\/json'/);
  assert.match(actionSource, /responseJsonSchema/);
  assert.match(actionSource, /inline_data/);
  assert.doesNotMatch(actionSource, /file_data:\s*\{[\s\S]*application\/pdf/);

  assert.match(envExample, /GEMINI_API_KEY/);
  assert.match(envExample, /GEMINI_LYRICS_MODEL=gemini-3\.1-pro-preview/);
});
