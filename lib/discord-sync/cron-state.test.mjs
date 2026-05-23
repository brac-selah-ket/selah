import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadCronState() {
  const source = await readFile(new URL('./cron-state.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputPath = join(tmpdir(), `cron-state-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  await writeFile(outputPath, compiled.outputText);
  return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

test('parses worship thread name and formats sheet date', async () => {
  const { parseWorshipThreadName, toSheetDateFromYYMMDD } = await loadCronState();

  assert.equal(parseWorshipThreadName('260524 예배 준비'), '260524');
  assert.equal(parseWorshipThreadName('260524 other'), null);
  assert.equal(toSheetDateFromYYMMDD('260524'), '2026.05.24');
});

test('selects the nearest upcoming active worship thread', async () => {
  const { selectTargetWorshipThread } = await loadCronState();
  const baseDate = new Date('2026-05-22T12:00:00+09:00');

  const selected = selectTargetWorshipThread(
    [
      { id: 'future', name: '260531 예배 준비', parent_id: 'channel-1' },
      { id: 'target', name: '260524 예배 준비', parent_id: 'channel-1' },
      { id: 'old', name: '260517 예배 준비', parent_id: 'channel-1' },
    ],
    baseDate,
  );

  assert.equal(selected?.id, 'target');
  assert.equal(selected?.sundayDate, '260524');
});

test('falls back to the closest past worship thread when no future thread is active', async () => {
  const { selectTargetWorshipThread } = await loadCronState();
  const baseDate = new Date('2026-05-25T12:00:00+09:00');

  const selected = selectTargetWorshipThread(
    [
      { id: 'older', name: '260510 예배 준비', parent_id: 'channel-1' },
      { id: 'recent', name: '260524 예배 준비', parent_id: 'channel-1' },
    ],
    baseDate,
  );

  assert.equal(selected?.id, 'recent');
  assert.equal(selected?.sundayDate, '260524');
});

test('detects only bot-added processed check reactions', async () => {
  const { hasProcessedReaction } = await loadCronState();

  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '✅' }, count: 1, me: true }],
    }),
    true,
  );
  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '✅' }, count: 1, me: false }],
    }),
    false,
  );
  assert.equal(hasProcessedReaction({ reactions: [] }), false);
});

test('treats parsed and ignored bot markers as processed reactions', async () => {
  const { hasProcessedReaction } = await loadCronState();

  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '✅' }, count: 1, me: true }],
    }),
    true,
  );
  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '☑️' }, count: 1, me: true }],
    }),
    true,
  );
  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '☑️' }, count: 1, me: false }],
    }),
    false,
  );
});

test('resolves guild id from config before channel fallback', async () => {
  const { resolveGuildId } = await loadCronState();

  assert.equal(resolveGuildId({ configuredGuildId: ' guild-from-env ', channel: { guild_id: 'guild-from-channel' } }), 'guild-from-env');
});

test('falls back to channel guild id when config is blank', async () => {
  const { resolveGuildId } = await loadCronState();

  assert.equal(resolveGuildId({ configuredGuildId: '', channel: { guild_id: ' guild-from-channel ' } }), 'guild-from-channel');
  assert.equal(resolveGuildId({ configuredGuildId: undefined, channel: { guild_id: 'guild-from-channel' } }), 'guild-from-channel');
});

test('returns null when guild id cannot be resolved', async () => {
  const { resolveGuildId } = await loadCronState();

  assert.equal(resolveGuildId({ configuredGuildId: ' ', channel: { guild_id: ' ' } }), null);
  assert.equal(resolveGuildId({ configuredGuildId: undefined, channel: null }), null);
});
