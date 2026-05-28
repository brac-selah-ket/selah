import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Blob to R2 migration script covers all storage-backed tables', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /sheet_music_files/);
  assert.match(source, /conti_pdf_exports/);
  assert.match(source, /song_page_images/);
});

test('Blob to R2 migration is dry-run by default and updates DB only after upload', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /const dryRun = !process\.argv\.includes\('--commit'\)/);
  assert.match(source, /if \(dryRun\)[\s\S]+continue/);

  const uploadIndex = source.indexOf('await putMigrationObject');
  const updateIndex = source.indexOf('await updateAssetUrl');

  assert.ok(uploadIndex !== -1 && updateIndex !== -1);
  assert.ok(uploadIndex < updateIndex);
  assert.match(source, /stored: await putObject/);
  assert.match(source, /allowOverwrite: false/);
});

test('Blob to R2 migration skips rows that already point to the configured R2 host', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /getObjectKeyFromPublicUrl/);
  assert.match(source, /function isAlreadyR2Url/);
  assert.match(source, /getObjectKeyFromPublicUrl\(r2PublicBaseUrl, value\) !== null/);
});

test('Blob to R2 migration updates rows only when the source URL is unchanged', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /async function updateAssetUrl\(config, id, previousUrl, nextUrl\)/);
  assert.match(source, /and\(eq\(config\.idColumn, id\), eq\(config\.urlColumn, previousUrl\)\)/);
  assert.match(source, /\.returning\(\{ id: config\.idColumn \}\)/);
  assert.match(source, /row was changed or deleted before URL update/);
});

test('Blob to R2 migration migrates only Vercel Blob source URLs', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /function isVercelBlobUrl/);
  assert.match(source, /\.blob\.vercel-storage\.com/);
  assert.match(source, /skippedUnsupportedSource/);
});

test('Blob to R2 migration enforces limits across attempted rows and validates --only', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /attempted: 0/);
  assert.match(source, /summary\.attempted \+= 1/);
  assert.match(source, /summary\.attempted >= limit/);
  assert.match(source, /function validateOnlyTables/);
  assert.match(source, /Unknown --only table/);
  assert.match(source, /must include at least one table/);
});

test('Blob to R2 migration does not overwrite existing R2 objects', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /allowOverwrite: false/);
});

test('Blob to R2 migration can resume after upload succeeds but DB update fails', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /function isObjectAlreadyExistsError/);
  assert.match(source, /name === 'PreconditionFailed'/);
  assert.match(source, /statusCode === 412/);
  assert.match(source, /createPublicUrl\(r2PublicBaseUrl, key\)/);
  assert.match(source, /reusedExistingR2Object/);
});

test('Blob to R2 migration cleans up a newly uploaded object if the DB CAS update fails', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /deleteObject/);
  assert.match(source, /cleanupNewMigrationObject/);
  assert.match(source, /if \(!reusedExistingObject\)/);
  assert.match(source, /await cleanupNewMigrationObject\(stored\.url\)/);
  assert.match(source, /await deleteObject\(storedUrl\)/);
});

test('Blob to R2 migration caps generated object filenames', async () => {
  const source = await readFile(
    new URL('../scripts/storyboard-migration/migrate-blob-assets-to-r2.mjs', import.meta.url),
    'utf8',
  );

  assert.match(source, /\.slice\(0, 180\)/);
});
