import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function writeModule(dir, fileName, source) {
  await writeFile(join(dir, fileName), source);
}

async function loadStateModule() {
  const dir = join(tmpdir(), `worship-prep-notification-state-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });

  await writeModule(dir, 'drizzle.mjs', 'export function and() {}; export function eq() {}; export function isNull() {}; export function lte() {}; export function or() {};');
  await writeModule(dir, 'db.mjs', 'export const db = {};');
  await writeModule(dir, 'turso.mjs', 'export function getTursoDb() { return {}; }');
  await writeModule(dir, 'time.mjs', 'export function dateToDbText(value) { return value.toISOString(); } export function dbTextToDate(value) { return new Date(value); }');
  await writeModule(dir, 'id.mjs', 'export function generateId() { return "id-1"; }');
  await writeModule(dir, 'provider.mjs', 'export function getStoryboardDatabaseProviderName() { return "turso"; }');
  await writeModule(dir, 'schema.mjs', 'export const worshipPrepNotifications = {};');
  await writeModule(dir, 'turso-schema.mjs', 'export const worshipPrepNotifications = {};');

  const source = await readFile(new URL('./worship-prep-notification-state.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const output = compiled.outputText
    .replace("from 'drizzle-orm';", "from './drizzle.mjs';")
    .replace("from '@/lib/db';", "from './db.mjs';")
    .replace("from '@/lib/db/turso';", "from './turso.mjs';")
    .replace("from '@/lib/db/time';", "from './time.mjs';")
    .replace("from '@/lib/id';", "from './id.mjs';")
    .replace("from '@/lib/repositories/storyboard/provider';", "from './provider.mjs';")
    .replace("from '@/lib/db/schema';", "from './schema.mjs';")
    .replace("from '@/lib/db/turso-schema';", "from './turso-schema.mjs';");

  await writeModule(dir, 'state.mjs', output);
  return import(`${pathToFileURL(join(dir, 'state.mjs')).href}?v=${Date.now()}`);
}

function baseRecord(overrides = {}) {
  const now = new Date('2026-06-06T00:00:00.000Z');
  return {
    id: 'notification-1',
    sundayDate: '260607',
    type: 'ppt_ready',
    status: 'pending',
    threadId: 'thread-1',
    messageId: null,
    attempts: 1,
    lastAttemptAt: now,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('claim skip reason blocks already sent and recent pending records', async () => {
  const { getNotificationClaimSkipReason } = await loadStateModule();
  const now = new Date('2026-06-06T00:10:00.000Z');

  assert.equal(getNotificationClaimSkipReason(baseRecord({ status: 'sent' }), now), 'already-sent');
  assert.equal(
    getNotificationClaimSkipReason(
      baseRecord({ status: 'pending', lastAttemptAt: new Date('2026-06-06T00:05:01.000Z') }),
      now,
    ),
    'recent-pending',
  );
});

test('claim skip reason allows failed and stale pending records to retry', async () => {
  const { getNotificationClaimSkipReason } = await loadStateModule();
  const now = new Date('2026-06-06T00:10:00.000Z');

  assert.equal(getNotificationClaimSkipReason(baseRecord({ status: 'failed' }), now), null);
  assert.equal(
    getNotificationClaimSkipReason(
      baseRecord({ status: 'pending', lastAttemptAt: new Date('2026-06-05T23:59:59.000Z') }),
      now,
    ),
    null,
  );
  assert.equal(getNotificationClaimSkipReason(baseRecord({ status: 'pending', lastAttemptAt: null }), now), null);
});

class FakeNotificationStore {
  constructor(initialRecord = null, options = {}) {
    this.record = initialRecord;
    this.insertConflicts = options.insertConflicts ?? false;
    this.conflictRecord = options.conflictRecord ?? null;
    this.claimExistingReturnsNull = options.claimExistingReturnsNull ?? false;
  }

  async get() {
    return this.record;
  }

  async insertPending(record) {
    if (this.insertConflicts || this.record) {
      if (!this.record && this.conflictRecord) {
        this.record = this.conflictRecord;
      }
      return null;
    }
    this.record = record;
    return record;
  }

  async claimExisting(existing, update) {
    if (this.claimExistingReturnsNull || !this.record || this.record.id !== existing.id) {
      return null;
    }
    if (this.record.status === 'sent') {
      return null;
    }
    if (
      this.record.status === 'pending' &&
      this.record.lastAttemptAt &&
      this.record.lastAttemptAt.getTime() > update.staleCutoff.getTime()
    ) {
      return null;
    }
    this.record = {
      ...this.record,
      status: 'pending',
      threadId: update.threadId,
      attempts: update.attempts,
      lastAttemptAt: update.now,
      updatedAt: update.now,
    };
    return this.record;
  }

  async markSent(id, messageId, now) {
    if (this.record?.id === id) {
      this.record = { ...this.record, status: 'sent', messageId, sentAt: now, updatedAt: now };
    }
  }

  async markFailed(id, now) {
    if (this.record?.id === id) {
      this.record = { ...this.record, status: 'failed', updatedAt: now };
    }
  }
}

test('claim service inserts a new pending claim', async () => {
  const { claimWorshipPrepNotificationWithStore } = await loadStateModule();
  const store = new FakeNotificationStore();

  const result = await claimWorshipPrepNotificationWithStore(store, '260607', 'thread-1', 'ppt_ready', new Date('2026-06-06T00:10:00.000Z'));

  assert.equal(result.claimed, true);
  assert.equal(result.reason, 'claimed');
  assert.equal(result.record.status, 'pending');
  assert.equal(result.record.attempts, 1);
});

test('claim service skips sent and recent pending records', async () => {
  const { claimWorshipPrepNotificationWithStore } = await loadStateModule();
  const now = new Date('2026-06-06T00:10:00.000Z');

  const sent = await claimWorshipPrepNotificationWithStore(
    new FakeNotificationStore(baseRecord({ status: 'sent' })),
    '260607',
    'thread-1',
    'ppt_ready',
    now,
  );
  assert.equal(sent.claimed, false);
  assert.equal(sent.reason, 'already-sent');

  const recent = await claimWorshipPrepNotificationWithStore(
    new FakeNotificationStore(baseRecord({ status: 'pending', lastAttemptAt: new Date('2026-06-06T00:05:01.000Z') })),
    '260607',
    'thread-1',
    'ppt_ready',
    now,
  );
  assert.equal(recent.claimed, false);
  assert.equal(recent.reason, 'recent-pending');
});

test('claim service retries failed and stale pending records atomically through the store', async () => {
  const { claimWorshipPrepNotificationWithStore } = await loadStateModule();
  const now = new Date('2026-06-06T00:10:00.000Z');

  const failedStore = new FakeNotificationStore(baseRecord({ status: 'failed', attempts: 1 }));
  const failed = await claimWorshipPrepNotificationWithStore(failedStore, '260607', 'thread-2', 'ppt_ready', now);
  assert.equal(failed.claimed, true);
  assert.equal(failed.record.threadId, 'thread-2');
  assert.equal(failed.record.attempts, 2);

  const staleStore = new FakeNotificationStore(
    baseRecord({ status: 'pending', attempts: 2, lastAttemptAt: new Date('2026-06-05T23:59:59.000Z') }),
  );
  const stale = await claimWorshipPrepNotificationWithStore(staleStore, '260607', 'thread-3', 'ppt_ready', now);
  assert.equal(stale.claimed, true);
  assert.equal(stale.record.threadId, 'thread-3');
  assert.equal(stale.record.attempts, 3);
});

test('claim service reports lost race when insert or conditional update does not win', async () => {
  const { claimWorshipPrepNotificationWithStore } = await loadStateModule();
  const now = new Date('2026-06-06T00:10:00.000Z');

  const insertRaceStore = new FakeNotificationStore(
    null,
    {
      insertConflicts: true,
      conflictRecord: baseRecord({ status: 'pending', lastAttemptAt: new Date('2026-06-06T00:09:00.000Z') }),
    },
  );
  const insertRace = await claimWorshipPrepNotificationWithStore(insertRaceStore, '260607', 'thread-1', 'ppt_ready', now);
  assert.equal(insertRace.claimed, false);
  assert.equal(insertRace.reason, 'recent-pending');

  const updateRaceStore = new FakeNotificationStore(
    baseRecord({ status: 'failed', attempts: 1 }),
    { claimExistingReturnsNull: true },
  );
  const updateRace = await claimWorshipPrepNotificationWithStore(updateRaceStore, '260607', 'thread-1', 'ppt_ready', now);
  assert.equal(updateRace.claimed, false);
  assert.equal(updateRace.reason, 'lost-race');
});

test('store-backed mark helpers can mark sent and failed records', async () => {
  const {
    markWorshipPrepNotificationSentWithStore,
    markWorshipPrepNotificationFailedWithStore,
  } = await loadStateModule();
  const store = new FakeNotificationStore(baseRecord({ status: 'pending' }));
  const sentAt = new Date('2026-06-06T00:11:00.000Z');
  await markWorshipPrepNotificationSentWithStore(store, 'notification-1', 'message-1', sentAt);
  assert.equal(store.record.status, 'sent');
  assert.equal(store.record.messageId, 'message-1');
  assert.equal(store.record.sentAt, sentAt);

  await markWorshipPrepNotificationFailedWithStore(store, 'notification-1', new Date('2026-06-06T00:12:00.000Z'));
  assert.equal(store.record.status, 'failed');
});
