import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('create-thread cron dryRun returns before Discord write side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url),
    'utf8',
  );

  const dryRunIndex = source.indexOf('if (dryRun)');
  const archiveThreadIndex = source.indexOf('await archiveThread');
  const createThreadIndex = source.indexOf('await createForumThread');
  const sheetReadIndex = source.indexOf('await readRoleOptionsFromSheet');
  const dropdownIndex = source.indexOf('await sendDropdownMessage');

  assert.notEqual(dryRunIndex, -1);
  assert.notEqual(archiveThreadIndex, -1);
  assert.notEqual(createThreadIndex, -1);
  assert.notEqual(sheetReadIndex, -1);
  assert.notEqual(dropdownIndex, -1);
  assert.ok(dryRunIndex < archiveThreadIndex);
  assert.ok(dryRunIndex < createThreadIndex);
  assert.ok(dryRunIndex < sheetReadIndex);
  assert.ok(dryRunIndex < dropdownIndex);

  const firstWriteSideEffectIndex = Math.min(archiveThreadIndex, createThreadIndex, sheetReadIndex, dropdownIndex);
  const dryRunGuard = source.slice(dryRunIndex, firstWriteSideEffectIndex);
  assert.match(dryRunGuard, /return NextResponse\.json/);
  assert.doesNotMatch(dryRunGuard, /archiveThread|createForumThread|sendDropdownMessage|readRoleOptionsFromSheet/);
  assert.match(dryRunGuard, /wouldArchiveThread/);
});

test('create-thread cron archives previous worship thread before creating the new one', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /archiveThread/);
  assert.match(source, /selectPreviousWorshipThread/);

  const body = source.slice(source.indexOf('export async function GET'));
  const archiveThreadIndex = body.indexOf('await archiveThread');
  const createThreadIndex = body.indexOf('await createForumThread');

  assert.notEqual(archiveThreadIndex, -1);
  assert.notEqual(createThreadIndex, -1);
  assert.ok(archiveThreadIndex < createThreadIndex);
});

test('send-week-dropdown requires cron authorization before Discord side effects', async () => {
  const source = await readFile(
    new URL('../app/api/discord/send-week-dropdown/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /NextRequest/);
  assert.match(source, /isCronAuthorized/);

  const body = source.slice(source.indexOf('export async function POST'));
  const authIndex = body.indexOf('isCronAuthorized');
  const firstDiscordReadIndex = Math.min(
    body.indexOf('getChannel('),
    body.indexOf('getActiveForumThreads('),
  );

  assert.ok(authIndex !== -1 && firstDiscordReadIndex !== -1);
  assert.ok(authIndex < firstDiscordReadIndex);
  assert.match(body, /status:\s*401/);
});

test('parse-comments requires cron authorization before Discord and Google side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/parse-comments/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /isCronAuthorized/);

  const body = source.slice(source.indexOf('export async function GET'));
  const authIndex = body.indexOf('isCronAuthorized');
  const sideEffectIndexes = [
    body.indexOf('getChannel('),
    body.indexOf('getActiveForumThreads('),
    body.indexOf('getThreadMessages('),
    body.indexOf('findRowByDate('),
    body.indexOf('updateWorshipData('),
    body.indexOf('addMessageReaction('),
  ].filter((index) => index !== -1);

  assert.notEqual(authIndex, -1);
  assert.ok(sideEffectIndexes.length > 0);
  assert.ok(sideEffectIndexes.every((index) => authIndex < index));
  assert.match(body, /status:\s*401/);
});

test('discord client archives worship threads without locking them', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/discord-client.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /export async function archiveThread/);
  assert.match(source, /method:\s*'PATCH'/);
  assert.match(source, /archived:\s*true/);

  const archiveFunction = source.slice(
    source.indexOf('export async function archiveThread'),
    source.indexOf('export async function', source.indexOf('export async function archiveThread') + 1),
  );
  assert.doesNotMatch(archiveFunction, /locked/);
});

test('discord client sends plain messages to a thread channel', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/discord-client.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /export async function sendThreadMessage/);
  assert.match(source, /\/channels\/\$\{threadId\}\/messages/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*content/);
});
