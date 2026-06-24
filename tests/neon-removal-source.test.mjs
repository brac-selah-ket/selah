import { readFile } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const repoRoot = new URL('../', import.meta.url).pathname;

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function sourceFiles(dir) {
  const results = [];

  for (const entry of readdirSync(join(repoRoot, dir))) {
    const fullPath = join(repoRoot, dir, entry);
    const stat = statSync(fullPath);

    if (entry === 'node_modules' || entry === '.next') {
      continue;
    }

    if (stat.isDirectory()) {
      results.push(...sourceFiles(relative(repoRoot, fullPath)));
      continue;
    }

    if (/\.(ts|tsx|mjs|js)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.mjs')) {
      results.push(relative(repoRoot, fullPath));
    }
  }

  return results;
}

test('remaining runtime source does not import the Neon client or Postgres schema', async () => {
  const violations = [];

  for (const path of [...sourceFiles('app'), ...sourceFiles('lib'), ...sourceFiles('scripts')]) {
    const source = await read(path);
    if (/@neondatabase\/serverless|drizzle-orm\/neon-http|@\/lib\/db(?:\/schema)?['"]/.test(source)) {
      violations.push(path);
    }
  }

  assert.deepEqual(violations, []);
});

test('Discord state store uses Turso tables for operational state', async () => {
  const source = await read('lib/discord-sync/state-store.ts');

  assert.match(source, /from ['"]@\/lib\/db\/turso['"]/);
  assert.match(source, /discordThreadStates/);
  assert.match(source, /discordProcessedMessages/);
  assert.match(source, /discordInteractionReceipts/);
  assert.doesNotMatch(source, /from ['"]@\/lib\/db['"]/);
  assert.doesNotMatch(source, /from ['"]@\/lib\/db\/schema['"]/);
});

test('Turso schema owns Discord operational state tables', async () => {
  const source = await read('lib/db/turso-schema.ts');

  assert.match(source, /export const discordThreadStates = sqliteTable/);
  assert.match(source, /export const discordProcessedMessages = sqliteTable/);
  assert.match(source, /export const discordInteractionReceipts = sqliteTable/);
  assert.match(source, /uniqueIndex\('discord_thread_states_thread_id_unique'\)/);
  assert.match(source, /uniqueIndex\('discord_processed_messages_message_id_unique'\)/);
  assert.match(source, /uniqueIndex\('discord_interaction_receipts_interaction_id_unique'\)/);
});

test('package scripts and dependencies no longer expose Neon migration paths', async () => {
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(packageJson.dependencies['@neondatabase/serverless'], undefined);
  assert.equal(packageJson.scripts['db:export:neon'], undefined);
  assert.equal(packageJson.scripts['db:import:turso'], undefined);
  assert.equal(packageJson.scripts['db:verify:turso'], undefined);
});
