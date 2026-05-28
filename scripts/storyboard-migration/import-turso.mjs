import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { setupMigrationRuntime } from './runtime.mjs';

const snapshotCollections = [
  'songs',
  'sheetMusicFiles',
  'songPresets',
  'presetSheetMusic',
  'contis',
  'contiSongs',
  'contiPdfExports',
  'songPageImages',
];
const force = process.argv.includes('--force');
const allowEmpty = process.argv.includes('--allow-empty');
const { snapshotUrl } = setupMigrationRuntime(import.meta.url);
const inputPath = fileURLToPath(snapshotUrl);

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function main() {
  if (!force) {
    throw new Error(
      [
        'Aborting destructive Turso import.',
        'This command replaces all storyboard rows in the target Turso database.',
        'Re-run with --force to confirm operator intent.',
      ].join(' '),
    );
  }

  const snapshot = await readSnapshot(inputPath);
  const counts = validateSnapshot(snapshot, { allowEmpty });

  console.log(`Target Turso URL: ${process.env.TURSO_DATABASE_URL ?? '(not set)'}`);
  console.log(`Snapshot path: ${inputPath}`);
  console.log(`Collection counts: ${JSON.stringify(counts)}`);

  const { importSnapshotToTurso } = await import('../../lib/repositories/storyboard/turso-import.ts');

  await importSnapshotToTurso(snapshot);

  console.log(`Imported Neon snapshot from ${inputPath} into Turso`);
}

async function readSnapshot(path) {
  const contents = await readFile(path, 'utf8');

  try {
    return JSON.parse(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse snapshot JSON at ${path}: ${message}`);
  }
}

function validateSnapshot(snapshot, { allowEmpty }) {
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Snapshot must be an object with StoryboardSnapshot collection arrays.');
  }

  const counts = {};

  for (const collection of snapshotCollections) {
    const rows = snapshot[collection];

    if (!Array.isArray(rows)) {
      throw new Error(`Snapshot collection "${collection}" must exist and be an array.`);
    }

    counts[collection] = rows.length;
  }

  const totalRows = Object.values(counts).reduce((total, count) => total + count, 0);

  if (totalRows === 0 && !allowEmpty) {
    throw new Error(
      'Snapshot is empty across all collections. Re-run with --allow-empty to confirm importing an empty snapshot.',
    );
  }

  return counts;
}
