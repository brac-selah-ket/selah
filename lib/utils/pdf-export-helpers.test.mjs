import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPdfExportHelpersModule() {
  const source = await readFile(new URL('./pdf-export-helpers.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `pdf-export-helpers-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'pdf-export-helpers.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'pdf-export-helpers.mjs')).href}?v=${Date.now()}`);
}

test('extracts preset pdf metadata by arrangement item key before song index', async () => {
  const { extractPresetPdfMetadataFromLayout } = await loadPdfExportHelpersModule();

  const result = extractPresetPdfMetadataFromLayout(
    [
      { pageIndex: 0, songIndex: 0, arrangementItemKey: 'conti-song:old', sheetMusicFileId: 'sheet-old', pdfPageIndex: null, overlays: [] },
      { pageIndex: 1, songIndex: 0, arrangementItemKey: 'mashup:group-1', sheetMusicFileId: 'sheet-new', pdfPageIndex: null, overlays: [{ id: 'songNumber', type: 'songNumber', text: '1', x: 1, y: 1, fontSize: 12 }] },
    ],
    0,
    'mashup:group-1',
  );

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].sheetMusicFileId, 'sheet-new');
});

test('does not fallback to a wrong keyed layout with the same song index', async () => {
  const { extractPresetPdfMetadataFromLayout } = await loadPdfExportHelpersModule();

  const result = extractPresetPdfMetadataFromLayout(
    [
      { pageIndex: 0, songIndex: 0, arrangementItemKey: 'mashup:other-group', sheetMusicFileId: 'sheet-wrong', pdfPageIndex: null, overlays: [] },
    ],
    0,
    'mashup:requested-group',
  );

  assert.equal(result, null);
});

test('falls back to true legacy layout rows without an arrangement item key', async () => {
  const { extractPresetPdfMetadataFromLayout } = await loadPdfExportHelpersModule();

  const result = extractPresetPdfMetadataFromLayout(
    [
      { pageIndex: 0, songIndex: 0, sheetMusicFileId: 'sheet-legacy', pdfPageIndex: null, overlays: [{ id: 'songNumber', type: 'songNumber', text: '1', x: 1, y: 1, fontSize: 12 }] },
    ],
    0,
    'mashup:requested-group',
  );

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].sheetMusicFileId, 'sheet-legacy');
});
