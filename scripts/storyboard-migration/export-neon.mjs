import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setupMigrationRuntime } from './runtime.mjs';

const { snapshotUrl } = setupMigrationRuntime(import.meta.url);
const outputPath = fileURLToPath(snapshotUrl);
const { readNeonSnapshot } = await import('../../lib/repositories/storyboard/neon-snapshot.ts');
const snapshot = await readNeonSnapshot();

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`Wrote Neon snapshot to ${outputPath}`);
console.log(JSON.stringify(createCounts(snapshot), null, 2));

function createCounts(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot).map(([collection, rows]) => [collection, rows.length]),
  );
}
