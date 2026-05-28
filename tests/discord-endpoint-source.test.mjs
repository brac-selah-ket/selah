import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('create-thread cron dryRun returns before Discord side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url),
    'utf8',
  );

  const dryRunIndex = source.indexOf('if (dryRun)');
  const channelEnvIndex = source.indexOf('process.env.DISCORD_CHANNEL_ID');
  const createThreadIndex = source.indexOf('await createForumThread');
  const sheetReadIndex = source.indexOf('await readRoleOptionsFromSheet');

  assert.notEqual(dryRunIndex, -1);
  assert.notEqual(channelEnvIndex, -1);
  assert.notEqual(createThreadIndex, -1);
  assert.notEqual(sheetReadIndex, -1);
  assert.ok(dryRunIndex < channelEnvIndex);
  assert.ok(dryRunIndex < createThreadIndex);
  assert.ok(dryRunIndex < sheetReadIndex);

  const dryRunGuard = source.slice(dryRunIndex, Math.min(createThreadIndex, sheetReadIndex));
  assert.match(dryRunGuard, /return NextResponse\.json/);
  assert.doesNotMatch(dryRunGuard, /createForumThread|sendDropdownMessage|readRoleOptionsFromSheet/);
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
