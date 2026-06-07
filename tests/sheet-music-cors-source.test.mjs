import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
const browserReaders = [
  'components/songs/sheet-music-gallery.tsx',
  'components/shared/sheet-music-selector.tsx',
  'components/contis/ocr-region-selector.tsx',
  'components/contis/pdf-export/hooks/use-editor-pages.ts',
  'components/contis/pdf-export/hooks/use-pdf-export.ts',
];

test('sheet music browser readers use same-origin asset URLs instead of storage URLs', async () => {
  for (const filePath of browserReaders) {
    const source = await readFile(new URL(`../${filePath}`, import.meta.url), 'utf8');

    assert.match(source, /getSheetMusicAssetUrl/);
    assert.doesNotMatch(source, /getPdfPageCount\(file\.fileUrl\)/);
    assert.doesNotMatch(source, /renderPdfPagesToDataUrls\(file\.fileUrl/);
    assert.doesNotMatch(source, /renderPdfPageToDataUrl\(fileUrl/);
    assert.doesNotMatch(source, /fileUrl = sm\.fileUrl/);
  }
});

test('same-origin sheet music route streams stored files by id', async () => {
  const source = await readFile(
    new URL('../app/api/assets/sheet-music/[id]/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /getSheetMusicFile/);
  assert.match(source, /fetch\(file\.fileUrl/);
  assert.match(source, /Content-Disposition/);
});
