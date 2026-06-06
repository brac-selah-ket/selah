import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('neon schema defines worship prep notification state and conti date index', async () => {
  const source = await readFile(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');

  assert.match(source, /export const worshipPrepNotifications = pgTable/);
  assert.match(source, /sundayDate:\s*text\('sunday_date'\)\.notNull\(\)/);
  assert.match(source, /type:\s*text\('type'\)\.notNull\(\)/);
  assert.match(source, /status:\s*text\('status'\)\.notNull\(\)/);
  assert.match(source, /attempts:\s*integer\('attempts'\)\.notNull\(\)\.default\(0\)/);
  assert.match(source, /uniqueIndex\('worship_prep_notifications_week_type_unique'\)\.on\(table\.sundayDate,\s*table\.type\)/);
  assert.match(source, /index\('contis_date_idx'\)\.on\(table\.date\)/);
});

test('turso schema defines worship prep notification state and conti date index', async () => {
  const source = await readFile(new URL('../lib/db/turso-schema.ts', import.meta.url), 'utf8');

  assert.match(source, /export const worshipPrepNotifications = sqliteTable/);
  assert.match(source, /sundayDate:\s*text\('sunday_date'\)\.notNull\(\)/);
  assert.match(source, /status:\s*text\('status'\)\.notNull\(\)/);
  assert.match(source, /attempts:\s*integer\('attempts'\)\.notNull\(\)\.default\(0\)/);
  assert.match(source, /uniqueIndex\('worship_prep_notifications_week_type_unique'\)\.on\(table\.sundayDate,\s*table\.type\)/);
  assert.match(source, /index\('contis_date_idx'\)\.on\(table\.date\)/);
});
