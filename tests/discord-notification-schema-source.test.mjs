import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('turso schema defines worship prep notification state and conti date index', async () => {
  const source = await readFile(new URL('../lib/db/turso-schema.ts', import.meta.url), 'utf8');

  assert.match(source, /export const worshipPrepNotifications = sqliteTable/);
  assert.match(source, /sundayDate:\s*text\('sunday_date'\)\.notNull\(\)/);
  assert.match(source, /status:\s*text\('status'\)\.notNull\(\)/);
  assert.match(source, /attempts:\s*integer\('attempts'\)\.notNull\(\)\.default\(0\)/);
  assert.match(source, /uniqueIndex\('worship_prep_notifications_week_type_unique'\)\.on\(table\.sundayDate,\s*table\.type\)/);
  assert.match(source, /index\('contis_date_idx'\)\.on\(table\.date\)/);
});

test('notification state store uses atomic claim before send and sent marking', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/worship-prep-notification-state.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /export async function getWorshipPrepNotification/);
  assert.match(source, /export async function claimWorshipPrepNotificationWithStore/);
  assert.match(source, /export async function claimWorshipPrepNotification/);
  assert.match(source, /export async function markWorshipPrepNotificationSent/);
  assert.match(source, /export async function markWorshipPrepNotificationFailed/);
  assert.match(source, /export async function markWorshipPrepNotificationSentWithStore/);
  assert.match(source, /export async function markWorshipPrepNotificationFailedWithStore/);
  assert.match(source, /getNotificationClaimSkipReason/);
  assert.match(source, /onConflictDoNothing/);
  assert.match(source, /\.returning\(\)/);
  assert.match(source, /lte\(/);
  assert.match(source, /status:\s*'pending'/);
  assert.match(source, /status:\s*'sent'/);
  assert.match(source, /status:\s*'failed'/);
  assert.doesNotMatch(source, /getStoryboardDatabaseProviderName/);
});

test('notification terminal updates are scoped to the active pending claim', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/worship-prep-notification-state.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /markWorshipPrepNotificationSent\(\s*claim:/);
  assert.match(source, /markWorshipPrepNotificationFailed\(\s*claim:/);
  assert.match(source, /eq\(worshipPrepNotifications\.status,\s*'pending'\)/);
  assert.match(source, /eq\(worshipPrepNotifications\.attempts,\s*claim\.attempts\)/);
  assert.match(source, /eq\(worshipPrepNotifications\.lastAttemptAt,\s*dateToDbText\(claim\.lastAttemptAt\)\)/);
});

test('notification orchestration checks sent state before expensive reads and claims before send', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/worship-prep-notifications.ts', import.meta.url),
    'utf8',
  );

  const functionIndex = source.indexOf('export async function checkAndSendWorshipPrepReadyNotification');
  assert.ok(functionIndex !== -1);

  const body = source.slice(functionIndex);
  const existingMessageHelperIndex = source.indexOf('export async function findExistingWorshipPrepReadyMessage');
  const existingMessageHelperBody = source.slice(existingMessageHelperIndex, functionIndex);
  const stateReadIndex = body.indexOf('getWorshipPrepNotification');
  const skipIndex = body.indexOf('getNotificationClaimSkipReason');
  const sheetReadIndex = body.indexOf('readWorshipDataByDate');
  const claimIndex = body.indexOf('claimWorshipPrepNotification');
  const existingMessageIndex = body.indexOf('findExistingWorshipPrepReadyMessage');
  const sendIndex = body.indexOf('sendThreadMessage');
  const sentIndex = body.indexOf('markWorshipPrepNotificationSent', sendIndex);
  const failedIndex = body.indexOf('markWorshipPrepNotificationFailed');

  assert.ok(existingMessageHelperIndex !== -1);
  assert.match(existingMessageHelperBody, /getThreadMessages/);
  assert.match(existingMessageHelperBody, /message\.content\s*===\s*content/);
  assert.match(existingMessageHelperBody, /message\.author\.bot\s*!==\s*false/);
  assert.ok(stateReadIndex !== -1);
  assert.ok(skipIndex !== -1);
  assert.ok(sheetReadIndex !== -1);
  assert.ok(claimIndex !== -1);
  assert.ok(existingMessageIndex !== -1);
  assert.ok(sendIndex !== -1);
  assert.ok(sentIndex !== -1);
  assert.ok(failedIndex !== -1);
  assert.ok(stateReadIndex < sheetReadIndex);
  assert.ok(skipIndex < sheetReadIndex);
  assert.ok(claimIndex < sendIndex);
  assert.ok(existingMessageIndex < sendIndex);
  assert.ok(sendIndex < sentIndex);
  assert.ok(failedIndex < sentIndex);
});
