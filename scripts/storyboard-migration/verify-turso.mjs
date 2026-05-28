import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { setupMigrationRuntime } from './runtime.mjs';

const useLiveNeon = process.argv.includes('--live-neon');
const { snapshotUrl } = setupMigrationRuntime(import.meta.url);
const snapshotPath = fileURLToPath(snapshotUrl);
const [{ readTursoSnapshot }, { verifyStoryboardSnapshots }] = await Promise.all([
  import('../../lib/repositories/storyboard/turso-snapshot.ts'),
  import('../../lib/repositories/storyboard/verify.ts'),
]);
const neonSnapshot = useLiveNeon
  ? await readLiveNeonSnapshot()
  : JSON.parse(await readFile(snapshotPath, 'utf8'));

const result = await verifyStoryboardSnapshots(neonSnapshot, await readTursoSnapshot());

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

async function readLiveNeonSnapshot() {
  const { readNeonSnapshot } = await import('../../lib/repositories/storyboard/neon-snapshot.ts');

  return readNeonSnapshot();
}
