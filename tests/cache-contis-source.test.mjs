import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function getFunctionBody(source, name) {
  const match = source.match(
    new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^\\n]+)?\\s*\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `${name} should be exported`);
  return match[1];
}

function getRepositoryMethodBody(source, name) {
  const match = source.match(
    new RegExp(`async\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n  \\},`)
  );
  assert.ok(match, `${name} should be implemented`);
  return match[1];
}

function getNamedImportsFrom(source, modulePath) {
  const imports = [];
  const escapedPath = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`import\\s+\\{([\\s\\S]*?)\\}\\s+from ['"]${escapedPath}['"]`, 'g');

  for (const match of source.matchAll(pattern)) {
    imports.push(
      ...match[1]
        .split(',')
        .map((value) => value.trim().split(/\s+as\s+/)[0].trim())
        .filter(Boolean)
    );
  }

  return imports;
}

test('conti queries use next cache tags and hourly cache life', async () => {
  const source = await read('lib/queries/contis.ts');

  assert.match(source, /from ['"]next\/cache['"]/);

  for (const [name, tagPattern] of [
    ['getContis', /cacheTag\(cacheTags\.contis\(\)\)/],
    ['getContisWithSongSummaries', /cacheTag\(cacheTags\.contis\(\)\)/],
    ['getContiByDate', /cacheTag\(\s*cacheTags\.contis\(\),\s*cacheTags\.contiByDate\(date\)\s*\)/],
    ['getConti', /cacheTag\(\s*cacheTags\.contis\(\),\s*cacheTags\.conti\(id\)\s*\)/],
    ['getContiForExport', /cacheTag\(\s*cacheTags\.contis\(\),\s*cacheTags\.conti\(id\)\s*\)/],
    ['getContiPdfExport', /cacheTag\(\s*cacheTags\.contiPdfExport\(contiId\)\s*\)/],
  ]) {
    const body = getFunctionBody(source, name);
    assert.match(body, /'use cache'/, `${name} should opt into cache components`);
    assert.match(body, /cacheLife\(['"]hours['"]\)/, `${name} should cache for hours`);
    assert.match(body, tagPattern, `${name} should use the expected cache tag`);
  }
});

test('conti repositories expose single conti-song lookup for mutation invalidation', async () => {
  const types = await read('lib/repositories/storyboard/types.ts');
  const turso = await read('lib/repositories/storyboard/turso-repository.ts');

  assert.match(
    types,
    /getContiSong\(contiSongId: string\): Promise<ContiSong \| null>/
  );
  assert.match(turso, /async getContiSong\(contiSongId: string\)/);

  assert.match(getRepositoryMethodBody(turso, 'getContiSong'), /where\(eq\(contiSongs\.id, contiSongId\)\)/);
});

test('conti mutations invalidate conti date tags for created updated and deleted contis', async () => {
  const source = await read('lib/actions/contis.ts');

  assert.match(source, /import \{ invalidateContiDate, invalidateContiWithDate \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    getFunctionBody(source, 'createConti'),
    /invalidateContiWithDate\(conti\.id, conti\.date\)/
  );

  const updateBody = getFunctionBody(source, 'updateConti');
  assert.match(updateBody, /const existing = await repository\.getConti\(id\)/);
  assert.match(updateBody, /existing\?\.date/);
  assert.match(updateBody, /invalidateContiWithDate\(result\.id, result\.date\)/);
  assert.match(updateBody, /invalidateContiDate\(existing\.date\)/);

  const deleteBody = getFunctionBody(source, 'deleteConti');
  assert.match(deleteBody, /const existing = await repository\.getConti\(id\)/);
  assert.match(deleteBody, /invalidateContiWithDate\(id, existing\.date\)/);
});

test('conti-song mutations invalidate conti tags and only batch import invalidates existing song tags', async () => {
  const source = await read('lib/actions/conti-songs.ts');

  assert.match(source, /import \{ invalidateConti, invalidateSong, invalidateSongs \} from ['"]@\/lib\/cache\/invalidation['"]/);

  const addBody = getFunctionBody(source, 'addSongToConti');
  assert.match(addBody, /invalidateConti\(contiId\)/);
  assert.doesNotMatch(addBody, /invalidateSong\(songId\)/);

  const removeBody = getFunctionBody(source, 'removeSongFromConti');
  assert.match(removeBody, /getContiSong\(contiSongId\)/);
  assert.match(removeBody, /invalidateConti\(source\.contiId\)/);

  const updateBody = getFunctionBody(source, 'updateContiSong');
  assert.match(updateBody, /getContiSong\(contiSongId\)/);
  assert.match(updateBody, /invalidateConti\(source\.contiId\)/);

  const reorderBody = getFunctionBody(source, 'reorderContiSongs');
  assert.match(reorderBody, /invalidateConti\(contiId\)/);
  assert.doesNotMatch(reorderBody, /invalidateSong\(songId\)/);

  const syncBody = getFunctionBody(source, 'syncPresetPdfMetadataFromContiLayout');
  assert.match(syncBody, /invalidateConti\(contiId\)/);

  const batchImportBody = getFunctionBody(source, 'batchImportSongsToConti');
  assert.match(batchImportBody, /invalidateConti\(contiId\)/);
  assert.match(batchImportBody, /invalidateSongs\(\)/);
  assert.match(batchImportBody, /invalidateSong\(songId\)/);
});

test('conti pdf export mutations invalidate only pdf export tags', async () => {
  const source = await read('lib/actions/conti-pdf-exports.ts');
  const broadContiInvalidators = [
    'invalidateContis',
    'invalidateContiWithDate',
    'invalidateContiDate',
    'invalidateConti',
  ];

  const invalidationImports = getNamedImportsFrom(source, '@/lib/cache/invalidation');
  assert.ok(invalidationImports.includes('invalidateContiPdfExport'));
  for (const invalidator of broadContiInvalidators) {
    assert.ok(!invalidationImports.includes(invalidator), `${invalidator} should not be imported`);
  }

  const saveBody = getFunctionBody(source, 'saveContiPdfLayout');
  assert.match(saveBody, /invalidateContiPdfExport\(contiId\)/);
  for (const invalidator of broadContiInvalidators) {
    assert.doesNotMatch(saveBody, new RegExp(`\\b${invalidator}\\s*\\(`));
  }
  assert.doesNotMatch(saveBody, /revalidatePath\(\s*['"]\/contis['"]/);

  const exportBody = getFunctionBody(source, 'exportContiPdf');
  assert.match(exportBody, /invalidateContiPdfExport\(contiId\)/);
  for (const invalidator of broadContiInvalidators) {
    assert.doesNotMatch(exportBody, new RegExp(`\\b${invalidator}\\s*\\(`));
  }
  assert.doesNotMatch(exportBody, /revalidatePath\(\s*['"]\/contis['"]/);

  const deleteBody = getFunctionBody(source, 'deleteContiPdfExport');
  assert.match(deleteBody, /invalidateContiPdfExport\(existing\.contiId\)/);
  for (const invalidator of broadContiInvalidators) {
    assert.doesNotMatch(deleteBody, new RegExp(`\\b${invalidator}\\s*\\(`));
  }
  assert.doesNotMatch(deleteBody, /revalidatePath\(\s*['"]\/contis['"]/);
});
