# Discord Worship Prep Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Discord automation that archives the previous worship-prep thread on weekly thread creation and notifies the active thread when sheet fields plus linked conti are ready for PPT work.

**Architecture:** Keep Discord thread lifecycle helpers in `lib/discord-sync`, add provider-aware notification persistence for Neon and Turso, and centralize readiness checks in a dedicated notification module. Event hooks call the readiness check immediately after relevant state changes, while a 10-minute cron route acts as recovery.

**Tech Stack:** Next.js App Router route handlers and server actions, TypeScript, Drizzle ORM for Neon and Turso schemas, Discord REST API v10, Google Sheets helpers, Node test runner, ESLint.

---

## File Structure

- Create `lib/discord-sync/worship-prep-readiness.ts`: pure date, readiness, URL, and message helpers.
- Create `lib/discord-sync/worship-prep-notification-state.ts`: provider-aware persistence for notification status and claim-before-send state transitions.
- Create `lib/discord-sync/worship-prep-notifications.ts`: orchestration that reads Sheets, checks conti linkage, finds Discord thread, sends message, and records state.
- Create `app/api/cron/discord/check-worship-prep-ready/route.ts`: 10-minute recovery cron endpoint.
- Modify `lib/discord-sync/cron-state.ts`: previous-thread and exact-week thread selection helpers.
- Modify `lib/discord-sync/discord-client.ts`: plain message send and archive-thread Discord calls.
- Modify `app/api/cron/discord/create-thread/route.ts`: archive previous active worship-prep thread before creating the new one.
- Modify `app/api/discord/interactions/route.ts`: call readiness check after role selection writes to Sheets.
- Modify `app/api/cron/discord/parse-comments/route.ts`: call readiness check after parsed Sheet updates.
- Modify `lib/actions/worship-prep.ts`: call readiness check after manual parse writes to Sheets.
- Modify `lib/actions/contis.ts`: call readiness check after conti create/update.
- Modify `lib/db/schema.ts`, `lib/db/turso-schema.ts`, `lib/types.ts`: add notification state and `contis.date` indexes.
- Create Neon and Turso migration SQL files.
- Modify `.env.example`: document `APP_BASE_URL`.
- Modify `vercel.json`: add 10-minute recovery cron.
- Add tests in `lib/discord-sync/cron-state.test.mjs`, `lib/discord-sync/worship-prep-readiness.test.mjs`, `lib/discord-sync/worship-prep-notification-state.test.mjs`, `tests/discord-endpoint-source.test.mjs`, and `tests/discord-notification-schema-source.test.mjs`.

## Task 1: Pure Worship Thread Selection Helpers

**Files:**
- Modify: `lib/discord-sync/cron-state.ts`
- Modify: `lib/discord-sync/cron-state.test.mjs`

- [ ] **Step 1: Add failing tests for previous-thread and exact-week selection**

Append this to `lib/discord-sync/cron-state.test.mjs`:

```js
test('selects nearest previous worship thread before a target sunday', async () => {
  const { selectPreviousWorshipThread } = await loadCronState();

  const selected = selectPreviousWorshipThread(
    [
      { id: 'current', name: '260607 예배 준비', parent_id: 'channel-1' },
      { id: 'previous', name: '260531 예배 준비', parent_id: 'channel-1' },
      { id: 'older', name: '260524 예배 준비', parent_id: 'channel-1' },
      { id: 'ignored', name: '260531 other', parent_id: 'channel-1' },
    ],
    '260607',
  );

  assert.equal(selected?.id, 'previous');
  assert.equal(selected?.sundayDate, '260531');
});

test('does not select target or future worship threads as previous', async () => {
  const { selectPreviousWorshipThread } = await loadCronState();

  const selected = selectPreviousWorshipThread(
    [
      { id: 'target', name: '260607 예배 준비', parent_id: 'channel-1' },
      { id: 'future', name: '260614 예배 준비', parent_id: 'channel-1' },
    ],
    '260607',
  );

  assert.equal(selected, null);
});

test('selects exact worship thread by sunday date', async () => {
  const { selectWorshipThreadBySundayDate } = await loadCronState();

  const selected = selectWorshipThreadBySundayDate(
    [
      { id: 'wrong', name: '260531 예배 준비', parent_id: 'channel-1' },
      { id: 'target', name: '260607 예배 준비', parent_id: 'channel-1' },
    ],
    '260607',
  );

  assert.equal(selected?.id, 'target');
  assert.equal(selected?.sundayDate, '260607');
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
node --experimental-strip-types --test lib/discord-sync/cron-state.test.mjs
```

Expected: FAIL because `selectPreviousWorshipThread` and `selectWorshipThreadBySundayDate` are not exported.

- [ ] **Step 3: Implement the helpers**

In `lib/discord-sync/cron-state.ts`, add these exports after `selectTargetWorshipThread()`:

```ts
export function selectWorshipThreadBySundayDate(
  threads: ActiveForumThread[],
  sundayDate: string,
): SelectedWorshipThread | null {
  const selected = threads.find((thread) => parseWorshipThreadName(thread.name) === sundayDate);
  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    name: selected.name,
    parent_id: selected.parent_id,
    sundayDate,
  };
}

export function selectPreviousWorshipThread(
  threads: ActiveForumThread[],
  targetSundayDate: string,
): SelectedWorshipThread | null {
  const candidates = threads
    .map((thread) => {
      const sundayDate = parseWorshipThreadName(thread.name);
      if (!sundayDate) return null;

      const diff = yymmddToUtcDay(targetSundayDate) - yymmddToUtcDay(sundayDate);
      if (diff <= 0) return null;

      return { ...thread, sundayDate, diff };
    })
    .filter((thread): thread is SelectedWorshipThread & { diff: number } => thread !== null)
    .sort((a, b) => a.diff - b.diff);

  const selected = candidates[0];
  if (!selected) {
    return null;
  }

  return {
    id: selected.id,
    name: selected.name,
    parent_id: selected.parent_id,
    sundayDate: selected.sundayDate,
  };
}
```

- [ ] **Step 4: Run the tests and verify pass**

Run:

```bash
node --experimental-strip-types --test lib/discord-sync/cron-state.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/discord-sync/cron-state.ts lib/discord-sync/cron-state.test.mjs
git commit -m "feat: add worship thread selection helpers"
```

## Task 2: Discord Client Archive And Plain Message Calls

**Files:**
- Modify: `lib/discord-sync/discord-client.ts`
- Modify: `tests/discord-endpoint-source.test.mjs`

- [ ] **Step 1: Add source tests for archive and plain message behavior**

Append this to `tests/discord-endpoint-source.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the source tests and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: FAIL because `archiveThread` and `sendThreadMessage` do not exist.

- [ ] **Step 3: Implement the Discord client functions**

Add this to `lib/discord-sync/discord-client.ts` after `sendDropdownMessage()`:

```ts
export async function sendThreadMessage(threadId: string, content: string): Promise<{ id: string }> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${threadId}/messages`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content }),
  });

  return parseDiscordResponse<{ id: string }>(response, 'Failed to send thread message');
}

export async function archiveThread(threadId: string): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/channels/${threadId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ archived: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to archive thread: ${response.status} ${body}`);
  }
}
```

Update `lib/discord-sync/index.ts` to export both functions:

```ts
export {
  createForumThread,
  sendDropdownMessage,
  sendThreadMessage,
  archiveThread,
  getThreadMessages,
  addMessageReaction,
  getChannel,
  getActiveForumThreads,
} from '@/lib/discord-sync/discord-client';
```

- [ ] **Step 4: Run the source tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/discord-sync/discord-client.ts lib/discord-sync/index.ts tests/discord-endpoint-source.test.mjs
git commit -m "feat: add discord thread archive and message helpers"
```

## Task 3: Notification Schema And Indexed Conti Date

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/turso-schema.ts`
- Modify: `lib/types.ts`
- Add: generated Neon migration SQL under `drizzle/`
- Add: generated Neon migration metadata under `drizzle/meta/`
- Add: generated Turso migration SQL under `drizzle/turso/`
- Add: generated Turso migration metadata under `drizzle/turso/meta/`
- Add: `tests/discord-notification-schema-source.test.mjs`

- [ ] **Step 1: Add source tests for schema shape**

Create `tests/discord-notification-schema-source.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the source test and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs
```

Expected: FAIL because the schema table and indexes do not exist.

- [ ] **Step 3: Modify the Neon schema**

In `lib/db/schema.ts`, change the import line to include `index`:

```ts
import { pgTable, text, integer, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core';
```

Replace the current `contis` definition with:

```ts
export const contis = pgTable('contis', {
  id: text('id').primaryKey(),
  title: text('title'),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  index('contis_date_idx').on(table.date),
]);
```

Add this after `discordInteractionReceipts`:

```ts
export const worshipPrepNotifications = pgTable('worship_prep_notifications', {
  id: text('id').primaryKey(),
  sundayDate: text('sunday_date').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  threadId: text('thread_id'),
  messageId: text('message_id'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('worship_prep_notifications_week_type_unique').on(table.sundayDate, table.type),
]);
```

- [ ] **Step 4: Modify the Turso schema**

In `lib/db/turso-schema.ts`, change the import line to include `index`:

```ts
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
```

Replace the current `contis` definition with:

```ts
export const contis = sqliteTable('contis', {
  id: text('id').primaryKey(),
  title: text('title'),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('contis_date_idx').on(table.date),
]);
```

Add this near the other runtime state tables:

```ts
export const worshipPrepNotifications = sqliteTable('worship_prep_notifications', {
  id: text('id').primaryKey(),
  sundayDate: text('sunday_date').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  threadId: text('thread_id'),
  messageId: text('message_id'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: text('last_attempt_at'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('worship_prep_notifications_week_type_unique').on(table.sundayDate, table.type),
]);
```

- [ ] **Step 5: Update exported types**

In `lib/types.ts`, add `worshipPrepNotifications` to the schema import:

```ts
  discordInteractionReceipts,
  worshipPrepNotifications,
} from './db/schema';
```

Add this type near the Discord state types:

```ts
export type WorshipPrepNotification = InferSelectModel<typeof worshipPrepNotifications>;
```

- [ ] **Step 6: Generate Drizzle migration files and metadata**

Run:

```bash
npx drizzle-kit generate
pnpm db:turso:generate
```

Expected:

```text
New migration SQL appears under drizzle/ and drizzle/turso/.
drizzle/meta/_journal.json and drizzle/turso/meta/_journal.json are updated.
New snapshot JSON files appear under drizzle/meta/ and drizzle/turso/meta/.
```

- [ ] **Step 7: Run the source test and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add lib/db/schema.ts lib/db/turso-schema.ts lib/types.ts drizzle tests/discord-notification-schema-source.test.mjs
git commit -m "feat: add worship prep notification schema"
```

## Task 4: Pure Readiness Helpers

**Files:**
- Create: `lib/discord-sync/worship-prep-readiness.ts`
- Create: `lib/discord-sync/worship-prep-readiness.test.mjs`

- [ ] **Step 1: Add tests for readiness, date, URL, and message helpers**

Create `lib/discord-sync/worship-prep-readiness.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadReadiness() {
  const source = await readFile(new URL('./worship-prep-readiness.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputPath = join(tmpdir(), `worship-prep-readiness-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  await writeFile(outputPath, compiled.outputText);
  return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

const completeRow = {
  date: '2026-06-07',
  preacher: '설교자',
  leader: '인도자',
  worshipLeader: '찬양 인도자',
  title: '설교 제목',
  scripture: '요 3:16',
  songs: ['찬양 1'],
};

test('detects readiness only when sheet fields and conti are complete', async () => {
  const { isWorshipPrepReady } = await loadReadiness();

  assert.equal(isWorshipPrepReady({ row: completeRow, hasLinkedConti: true }), true);
  assert.equal(isWorshipPrepReady({ row: { ...completeRow, title: null }, hasLinkedConti: true }), false);
  assert.equal(isWorshipPrepReady({ row: { ...completeRow, songs: [] }, hasLinkedConti: true }), false);
  assert.equal(isWorshipPrepReady({ row: completeRow, hasLinkedConti: false }), false);
});

test('converts between yymmdd and iso dates', async () => {
  const { toIsoDateFromYYMMDD, toYYMMDDFromIsoDate } = await loadReadiness();

  assert.equal(toIsoDateFromYYMMDD('260607'), '2026-06-07');
  assert.equal(toYYMMDDFromIsoDate('2026-06-07'), '260607');
  assert.throws(() => toIsoDateFromYYMMDD('2026-06-07'), /YYMMDD/);
  assert.throws(() => toIsoDateFromYYMMDD('260230'), /valid calendar date/);
  assert.throws(() => toYYMMDDFromIsoDate('260607'), /YYYY-MM-DD/);
  assert.throws(() => toYYMMDDFromIsoDate('2026-02-30'), /valid calendar date/);
  assert.throws(() => toYYMMDDFromIsoDate('2026-13-01'), /valid calendar date/);
});

test('builds worship prep URL and ready message', async () => {
  const { buildWorshipPrepUrl, buildWorshipPrepReadyMessage } = await loadReadiness();

  const url = buildWorshipPrepUrl('https://storyboard.example.com/', '2026-06-07');
  assert.equal(url, 'https://storyboard.example.com/worship-prep?date=2026-06-07');
  assert.equal(
    buildWorshipPrepReadyMessage(url),
    '광고 외에 PPT 작성 준비가 완료되었습니다. https://storyboard.example.com/worship-prep?date=2026-06-07 에서 작업해주세요.',
  );
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --experimental-strip-types --test lib/discord-sync/worship-prep-readiness.test.mjs
```

Expected: FAIL because `worship-prep-readiness.ts` does not exist.

- [ ] **Step 3: Implement the pure helper file**

Create `lib/discord-sync/worship-prep-readiness.ts`:

```ts
export interface WorshipPrepReadinessRow {
  preacher: string | null;
  leader: string | null;
  worshipLeader: string | null;
  title: string | null;
  scripture: string | null;
  songs: string[];
}

export interface WorshipPrepReadyInput {
  row: WorshipPrepReadinessRow | null;
  hasLinkedConti: boolean;
}

function hasText(value: string | null): boolean {
  return Boolean(value?.trim());
}

export function isWorshipPrepReady(input: WorshipPrepReadyInput): boolean {
  const row = input.row;
  if (!row) {
    return false;
  }

  return (
    hasText(row.preacher) &&
    hasText(row.leader) &&
    hasText(row.worshipLeader) &&
    hasText(row.title) &&
    hasText(row.scripture) &&
    row.songs.length > 0 &&
    input.hasLinkedConti
  );
}

export function toIsoDateFromYYMMDD(sundayDate: string): string {
  if (!/^\d{6}$/.test(sundayDate)) {
    throw new Error(`Expected YYMMDD sundayDate, received: ${sundayDate}`);
  }
  const isoDate = `20${sundayDate.slice(0, 2)}-${sundayDate.slice(2, 4)}-${sundayDate.slice(4, 6)}`;
  assertValidIsoDate(isoDate);
  return isoDate;
}

export function toYYMMDDFromIsoDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Expected YYYY-MM-DD isoDate, received: ${isoDate}`);
  }
  assertValidIsoDate(isoDate);
  return `${isoDate.slice(2, 4)}${isoDate.slice(5, 7)}${isoDate.slice(8, 10)}`;
}

function assertValidIsoDate(isoDate: string): void {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Expected a valid calendar date, received: ${isoDate}`);
  }

  const roundTrip = date.toISOString().slice(0, 10);
  if (roundTrip !== isoDate) {
    throw new Error(`Expected a valid calendar date, received: ${isoDate}`);
  }
}

export function buildWorshipPrepUrl(baseUrl: string, isoDate: string): string {
  const url = new URL('/worship-prep', baseUrl);
  url.searchParams.set('date', isoDate);
  return url.toString();
}

export function buildWorshipPrepReadyMessage(worshipPrepUrl: string): string {
  return `광고 외에 PPT 작성 준비가 완료되었습니다. ${worshipPrepUrl} 에서 작업해주세요.`;
}
```

- [ ] **Step 4: Run the test and verify pass**

Run:

```bash
node --experimental-strip-types --test lib/discord-sync/worship-prep-readiness.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/discord-sync/worship-prep-readiness.ts lib/discord-sync/worship-prep-readiness.test.mjs
git commit -m "feat: add worship prep readiness helpers"
```

## Task 5: Provider-Aware Notification State

**Files:**
- Create: `lib/discord-sync/worship-prep-notification-state.ts`
- Create: `lib/discord-sync/worship-prep-notification-state.test.mjs`
- Modify: `tests/discord-notification-schema-source.test.mjs`

- [ ] **Step 1: Add behavioral tests for notification claim skip logic**

Create `lib/discord-sync/worship-prep-notification-state.test.mjs`:

```js
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
```

- [ ] **Step 2: Add source tests for atomic claim operations**

Append this to `tests/discord-notification-schema-source.test.mjs`:

```js
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
  assert.match(source, /status:\s*'pending'/);
  assert.match(source, /status:\s*'sent'/);
  assert.match(source, /status:\s*'failed'/);
  assert.match(source, /getStoryboardDatabaseProviderName/);
});
```

- [ ] **Step 3: Run the tests and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs lib/discord-sync/worship-prep-notification-state.test.mjs
```

Expected: FAIL because `worship-prep-notification-state.ts` does not exist.

- [ ] **Step 4: Create the notification state store**

Create `lib/discord-sync/worship-prep-notification-state.ts`:

```ts
import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { db as neonDb } from '@/lib/db';
import { getTursoDb } from '@/lib/db/turso';
import { dateToDbText, dbTextToDate } from '@/lib/db/time';
import { generateId } from '@/lib/id';
import { getStoryboardDatabaseProviderName } from '@/lib/repositories/storyboard/provider';
import { worshipPrepNotifications as neonNotifications } from '@/lib/db/schema';
import { worshipPrepNotifications as tursoNotifications } from '@/lib/db/turso-schema';

export const WORSHIP_PREP_READY_NOTIFICATION_TYPE = 'ppt_ready';
export const NOTIFICATION_PENDING_STALE_MS = 10 * 60 * 1000;

export type WorshipPrepNotificationStatus = 'pending' | 'sent' | 'failed';

export interface WorshipPrepNotificationRecord {
  id: string;
  sundayDate: string;
  type: string;
  status: WorshipPrepNotificationStatus;
  threadId: string | null;
  messageId: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationClaimResult {
  claimed: boolean;
  record: WorshipPrepNotificationRecord | null;
  reason: 'claimed' | 'already-sent' | 'recent-pending' | 'lost-race';
}

export interface ClaimExistingNotificationInput {
  threadId: string;
  attempts: number;
  now: Date;
  staleCutoff: Date;
}

export interface WorshipPrepNotificationStateStore {
  get(sundayDate: string, type: string): Promise<WorshipPrepNotificationRecord | null>;
  insertPending(record: WorshipPrepNotificationRecord): Promise<WorshipPrepNotificationRecord | null>;
  claimExisting(
    existing: WorshipPrepNotificationRecord,
    input: ClaimExistingNotificationInput,
  ): Promise<WorshipPrepNotificationRecord | null>;
  markSent(id: string, messageId: string, now: Date): Promise<void>;
  markFailed(id: string, now: Date): Promise<void>;
}

export function getNotificationClaimSkipReason(
  record: WorshipPrepNotificationRecord | null,
  now: Date,
): 'already-sent' | 'recent-pending' | null {
  if (!record) {
    return null;
  }
  if (record.status === 'sent') {
    return 'already-sent';
  }
  if (
    record.status === 'pending' &&
    record.lastAttemptAt &&
    now.getTime() - record.lastAttemptAt.getTime() < NOTIFICATION_PENDING_STALE_MS
  ) {
    return 'recent-pending';
  }
  return null;
}

function mapTursoRecord(row: typeof tursoNotifications.$inferSelect): WorshipPrepNotificationRecord {
  return {
    ...row,
    status: row.status as WorshipPrepNotificationStatus,
    lastAttemptAt: row.lastAttemptAt ? dbTextToDate(row.lastAttemptAt) : null,
    sentAt: row.sentAt ? dbTextToDate(row.sentAt) : null,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapNeonRecord(row: typeof neonNotifications.$inferSelect): WorshipPrepNotificationRecord {
  return {
    ...row,
    status: row.status as WorshipPrepNotificationStatus,
  };
}

export async function getWorshipPrepNotification(
  sundayDate: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
): Promise<WorshipPrepNotificationRecord | null> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    const rows = await getTursoDb()
      .select()
      .from(tursoNotifications)
      .where(and(eq(tursoNotifications.sundayDate, sundayDate), eq(tursoNotifications.type, type)))
      .limit(1);
    return rows[0] ? mapTursoRecord(rows[0]) : null;
  }

  const rows = await neonDb
    .select()
    .from(neonNotifications)
    .where(and(eq(neonNotifications.sundayDate, sundayDate), eq(neonNotifications.type, type)))
    .limit(1);
  return rows[0] ? mapNeonRecord(rows[0]) : null;
}

function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - NOTIFICATION_PENDING_STALE_MS);
}

export async function claimWorshipPrepNotificationWithStore(
  store: WorshipPrepNotificationStateStore,
  sundayDate: string,
  threadId: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  now = new Date(),
): Promise<NotificationClaimResult> {
  const existing = await store.get(sundayDate, type);
  const skipReason = getNotificationClaimSkipReason(existing, now);

  if (skipReason) {
    return { claimed: false, record: existing, reason: skipReason };
  }

  if (!existing) {
    const record: WorshipPrepNotificationRecord = {
      id: generateId(),
      sundayDate,
      type,
      status: 'pending',
      threadId,
      messageId: null,
      attempts: 1,
      lastAttemptAt: now,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await store.insertPending(record);
    if (inserted) {
      return { claimed: true, record: inserted, reason: 'claimed' };
    }

    const raced = await store.get(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const claimed = await store.claimExisting(existing, {
    threadId,
    attempts: existing.attempts + 1,
    now,
    staleCutoff: staleCutoff(now),
  });
  if (claimed) {
    return { claimed: true, record: claimed, reason: 'claimed' };
  }

  const raced = await store.get(sundayDate, type);
  return {
    claimed: false,
    record: raced,
    reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
  };
}

export async function markWorshipPrepNotificationSentWithStore(
  store: WorshipPrepNotificationStateStore,
  id: string,
  messageId: string,
  now = new Date(),
): Promise<void> {
  await store.markSent(id, messageId, now);
}

export async function markWorshipPrepNotificationFailedWithStore(
  store: WorshipPrepNotificationStateStore,
  id: string,
  now = new Date(),
): Promise<void> {
  await store.markFailed(id, now);
}

export async function claimWorshipPrepNotification(
  sundayDate: string,
  threadId: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  now = new Date(),
): Promise<NotificationClaimResult> {
  const existing = await getWorshipPrepNotification(sundayDate, type);
  const skipReason = getNotificationClaimSkipReason(existing, now);

  if (skipReason) {
    return { claimed: false, record: existing, reason: skipReason };
  }

  const provider = getStoryboardDatabaseProviderName();

  if (!existing) {
    const id = generateId();
    if (provider === 'turso') {
      const row = {
        id,
        sundayDate,
        type,
        status: 'pending',
        threadId,
        messageId: null,
        attempts: 1,
        lastAttemptAt: dateToDbText(now),
        sentAt: null,
        createdAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      };
      const inserted = await getTursoDb()
        .insert(tursoNotifications)
        .values(row)
        .onConflictDoNothing({ target: [tursoNotifications.sundayDate, tursoNotifications.type] })
        .returning();
      if (inserted.length > 0) {
        return { claimed: true, record: mapTursoRecord(inserted[0]), reason: 'claimed' };
      }
      const raced = await getWorshipPrepNotification(sundayDate, type);
      return {
        claimed: false,
        record: raced,
        reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
      };
    }

    const row = {
      id,
      sundayDate,
      type,
      status: 'pending',
      threadId,
      messageId: null,
      attempts: 1,
      lastAttemptAt: now,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await neonDb
      .insert(neonNotifications)
      .values(row)
      .onConflictDoNothing({ target: [neonNotifications.sundayDate, neonNotifications.type] })
      .returning();
    if (inserted.length > 0) {
      return { claimed: true, record: mapNeonRecord(inserted[0]), reason: 'claimed' };
    }
    const raced = await getWorshipPrepNotification(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const nextAttempts = existing.attempts + 1;
  const cutoff = staleCutoff(now);
  if (provider === 'turso') {
    const updated = await getTursoDb()
      .update(tursoNotifications)
      .set({
        status: 'pending',
        threadId,
        attempts: nextAttempts,
        lastAttemptAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      })
      .where(and(
        eq(tursoNotifications.id, existing.id),
        or(
          eq(tursoNotifications.status, 'failed'),
          and(
            eq(tursoNotifications.status, 'pending'),
            or(isNull(tursoNotifications.lastAttemptAt), lte(tursoNotifications.lastAttemptAt, dateToDbText(cutoff))),
          ),
        ),
      ))
      .returning();
    if (updated.length > 0) {
      return { claimed: true, record: mapTursoRecord(updated[0]), reason: 'claimed' };
    }

    const raced = await getWorshipPrepNotification(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const updated = await neonDb
    .update(neonNotifications)
    .set({
      status: 'pending',
      threadId,
      attempts: nextAttempts,
      lastAttemptAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(neonNotifications.id, existing.id),
      or(
        eq(neonNotifications.status, 'failed'),
        and(
          eq(neonNotifications.status, 'pending'),
          or(isNull(neonNotifications.lastAttemptAt), lte(neonNotifications.lastAttemptAt, cutoff)),
        ),
      ),
    ))
    .returning();
  if (updated.length > 0) {
    return { claimed: true, record: mapNeonRecord(updated[0]), reason: 'claimed' };
  }

  const raced = await getWorshipPrepNotification(sundayDate, type);
  return {
    claimed: false,
    record: raced,
    reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
  };
}

export async function markWorshipPrepNotificationSent(
  id: string,
  messageId: string,
  now = new Date(),
): Promise<void> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    await getTursoDb()
      .update(tursoNotifications)
      .set({
        status: 'sent',
        messageId,
        sentAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      })
      .where(eq(tursoNotifications.id, id));
    return;
  }

  await neonDb
    .update(neonNotifications)
    .set({
      status: 'sent',
      messageId,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(neonNotifications.id, id));
}

export async function markWorshipPrepNotificationFailed(id: string, now = new Date()): Promise<void> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    await getTursoDb()
      .update(tursoNotifications)
      .set({ status: 'failed', updatedAt: dateToDbText(now) })
      .where(eq(tursoNotifications.id, id));
    return;
  }

  await neonDb
    .update(neonNotifications)
    .set({ status: 'failed', updatedAt: now })
    .where(eq(neonNotifications.id, id));
}
```

- [ ] **Step 5: Run the tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs lib/discord-sync/worship-prep-notification-state.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/discord-sync/worship-prep-notification-state.ts lib/discord-sync/worship-prep-notification-state.test.mjs tests/discord-notification-schema-source.test.mjs
git commit -m "feat: add worship prep notification state store"
```

## Task 6: Notification Orchestration Module

**Files:**
- Create: `lib/discord-sync/worship-prep-notifications.ts`
- Modify: `tests/discord-notification-schema-source.test.mjs`

- [ ] **Step 1: Add source tests for notification orchestration ordering**

Append this to `tests/discord-notification-schema-source.test.mjs`:

```js
test('notification orchestration checks sent state before expensive reads and claims before send', async () => {
  const source = await readFile(
    new URL('../lib/discord-sync/worship-prep-notifications.ts', import.meta.url),
    'utf8',
  );

  const body = source.slice(source.indexOf('export async function checkAndSendWorshipPrepReadyNotification'));
  const stateReadIndex = body.indexOf('getWorshipPrepNotification');
  const skipIndex = body.indexOf('getNotificationClaimSkipReason');
  const sheetReadIndex = body.indexOf('readWorshipDataByDate');
  const claimIndex = body.indexOf('claimWorshipPrepNotification');
  const sendIndex = body.indexOf('sendThreadMessage');
  const sentIndex = body.indexOf('markWorshipPrepNotificationSent');
  const failedIndex = body.indexOf('markWorshipPrepNotificationFailed');

  assert.ok(stateReadIndex !== -1);
  assert.ok(skipIndex !== -1);
  assert.ok(sheetReadIndex !== -1);
  assert.ok(claimIndex !== -1);
  assert.ok(sendIndex !== -1);
  assert.ok(sentIndex !== -1);
  assert.ok(failedIndex !== -1);
  assert.ok(stateReadIndex < sheetReadIndex);
  assert.ok(skipIndex < sheetReadIndex);
  assert.ok(claimIndex < sendIndex);
  assert.ok(sendIndex < sentIndex);
});
```

- [ ] **Step 2: Run the source test and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs
```

Expected: FAIL because `worship-prep-notifications.ts` does not exist.

- [ ] **Step 3: Create the notification module**

Create `lib/discord-sync/worship-prep-notifications.ts`:

```ts
import { getContiByDate } from '@/lib/queries/contis';
import { readWorshipDataByDate } from '@/lib/discord-sync/google-sheets';
import {
  getActiveForumThreads,
  getChannel,
  sendThreadMessage,
} from '@/lib/discord-sync/discord-client';
import {
  resolveGuildId,
  selectWorshipThreadBySundayDate,
} from '@/lib/discord-sync/cron-state';
import {
  buildWorshipPrepReadyMessage,
  buildWorshipPrepUrl,
  isWorshipPrepReady,
  toIsoDateFromYYMMDD,
} from '@/lib/discord-sync/worship-prep-readiness';
import {
  WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  claimWorshipPrepNotification,
  getNotificationClaimSkipReason,
  getWorshipPrepNotification,
  markWorshipPrepNotificationFailed,
  markWorshipPrepNotificationSent,
} from '@/lib/discord-sync/worship-prep-notification-state';

export interface WorshipPrepReadyNotificationResult {
  success: boolean;
  status:
    | 'already-sent'
    | 'not-ready'
    | 'no-thread'
    | 'claimed-by-other'
    | 'sent'
    | 'error';
  error?: string;
  threadId?: string;
  messageId?: string;
}

function resolveAppBaseUrl(origin?: string): string | null {
  const configured = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured;
  }
  return origin?.trim() || null;
}

async function findDiscordThreadForSundayDate(sundayDate: string) {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    throw new Error('DISCORD_CHANNEL_ID must be set');
  }

  const configuredGuildId = process.env.DISCORD_GUILD_ID;
  const guildId = resolveGuildId({
    configuredGuildId,
    channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
  });
  if (!guildId) {
    throw new Error('DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID');
  }

  const threads = await getActiveForumThreads(guildId, channelId);
  return selectWorshipThreadBySundayDate(threads, sundayDate);
}

export async function checkAndSendWorshipPrepReadyNotification({
  sundayDate,
  origin,
}: {
  sundayDate: string;
  origin?: string;
}): Promise<WorshipPrepReadyNotificationResult> {
  try {
    const existing = await getWorshipPrepNotification(sundayDate, WORSHIP_PREP_READY_NOTIFICATION_TYPE);
    const skipReason = getNotificationClaimSkipReason(existing, new Date());
    if (skipReason === 'already-sent') {
      return { success: true, status: 'already-sent', threadId: existing?.threadId ?? undefined, messageId: existing?.messageId ?? undefined };
    }
    if (skipReason === 'recent-pending') {
      return { success: true, status: 'claimed-by-other', threadId: existing?.threadId ?? undefined };
    }

    const isoDate = toIsoDateFromYYMMDD(sundayDate);
    const [row, conti] = await Promise.all([
      readWorshipDataByDate(isoDate),
      getContiByDate(isoDate),
    ]);

    if (!isWorshipPrepReady({ row, hasLinkedConti: Boolean(conti) })) {
      return { success: true, status: 'not-ready' };
    }

    const thread = await findDiscordThreadForSundayDate(sundayDate);
    if (!thread) {
      return { success: true, status: 'no-thread' };
    }

    const baseUrl = resolveAppBaseUrl(origin);
    if (!baseUrl) {
      return { success: false, status: 'error', error: 'APP_BASE_URL or NEXT_PUBLIC_APP_URL must be set' };
    }

    const claim = await claimWorshipPrepNotification(sundayDate, thread.id);
    if (!claim.claimed || !claim.record) {
      return { success: true, status: claim.reason === 'already-sent' ? 'already-sent' : 'claimed-by-other' };
    }

    try {
      const url = buildWorshipPrepUrl(baseUrl, isoDate);
      const message = buildWorshipPrepReadyMessage(url);
      const sent = await sendThreadMessage(thread.id, message);
      await markWorshipPrepNotificationSent(claim.record.id, sent.id);
      return { success: true, status: 'sent', threadId: thread.id, messageId: sent.id };
    } catch (error) {
      await markWorshipPrepNotificationFailed(claim.record.id);
      return {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Discord notification failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Worship prep readiness check failed',
    };
  }
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-notification-schema-source.test.mjs lib/discord-sync/worship-prep-readiness.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/discord-sync/worship-prep-notifications.ts tests/discord-notification-schema-source.test.mjs
git commit -m "feat: add worship prep ready notification flow"
```

## Task 7: Archive Previous Thread In Weekly Create Flow

**Files:**
- Modify: `app/api/cron/discord/create-thread/route.ts`
- Modify: `lib/actions/worship-prep.ts`
- Modify: `tests/discord-endpoint-source.test.mjs`

- [ ] **Step 1: Update source tests for archive-before-create**

Replace the existing `create-thread cron dryRun returns before Discord side effects` test in `tests/discord-endpoint-source.test.mjs` with:

```js
test('create-thread cron dryRun returns before Discord write side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url),
    'utf8',
  );

  const dryRunIndex = source.indexOf('if (dryRun)');
  const archiveIndex = source.indexOf('await archiveThread');
  const createThreadIndex = source.indexOf('await createForumThread');
  const sheetReadIndex = source.indexOf('await readRoleOptionsFromSheet');
  const dropdownIndex = source.indexOf('await sendDropdownMessage');

  assert.notEqual(dryRunIndex, -1);
  assert.notEqual(archiveIndex, -1);
  assert.notEqual(createThreadIndex, -1);
  assert.notEqual(sheetReadIndex, -1);
  assert.notEqual(dropdownIndex, -1);
  assert.ok(dryRunIndex < archiveIndex);
  assert.ok(dryRunIndex < createThreadIndex);
  assert.ok(dryRunIndex < sheetReadIndex);
  assert.ok(dryRunIndex < dropdownIndex);

  const dryRunGuard = source.slice(dryRunIndex, Math.min(archiveIndex, createThreadIndex, sheetReadIndex, dropdownIndex));
  assert.match(dryRunGuard, /return NextResponse\.json/);
  assert.doesNotMatch(dryRunGuard, /archiveThread|createForumThread|sendDropdownMessage|readRoleOptionsFromSheet/);
  assert.match(dryRunGuard, /wouldArchiveThread/);
});
```

Append this to `tests/discord-endpoint-source.test.mjs`:

```js
test('create-thread cron archives previous worship thread before creating the new one', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/create-thread/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /archiveThread/);
  assert.match(source, /selectPreviousWorshipThread/);

  const body = source.slice(source.indexOf('export async function GET'));
  const archiveIndex = body.indexOf('archiveThread');
  const createIndex = body.indexOf('createForumThread');

  assert.ok(archiveIndex !== -1);
  assert.ok(createIndex !== -1);
  assert.ok(archiveIndex < createIndex);
});
```

- [ ] **Step 2: Run the source test and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: FAIL because the create-thread route does not archive a previous thread.

- [ ] **Step 3: Update the cron route imports**

In `app/api/cron/discord/create-thread/route.ts`, replace the Discord imports with:

```ts
import {
  archiveThread,
  createForumThread,
  getActiveForumThreads,
  getChannel,
  sendDropdownMessage,
} from '@/lib/discord-sync/discord-client';
import {
  resolveGuildId,
  selectPreviousWorshipThread,
} from '@/lib/discord-sync/cron-state';
```

- [ ] **Step 4: Insert archive planning into the cron route**

In `app/api/cron/discord/create-thread/route.ts`, after `threadName` is computed and before `if (dryRun)`, add:

```ts
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID is not set');
    }

    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });
    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID');
    }

    const previousThread = selectPreviousWorshipThread(
      await getActiveForumThreads(guildId, channelId),
      yymmdd,
    );
```

Replace the existing `if (dryRun)` block with:

```ts
    if (dryRun) {
      return NextResponse.json({
        success: true,
        message: `Dry run: thread not created: ${threadName}`,
        data: {
          threadId: null,
          threadName,
          sundayDate: yymmdd,
          dryRun: true,
          wouldArchiveThread: previousThread ? { id: previousThread.id, name: previousThread.name } : null,
          wouldCreateThread: true,
          wouldSendDropdowns: true,
        },
      });
    }
```

Remove the later duplicate `const channelId = process.env.DISCORD_CHANNEL_ID` block.

Before `const thread = await createForumThread`, add:

```ts
    if (previousThread) {
      await archiveThread(previousThread.id);
    }
```

- [ ] **Step 5: Add the same archive behavior to the manual action**

In `lib/actions/worship-prep.ts`, include these imports from `@/lib/discord-sync`:

```ts
  archiveThread,
  getActiveForumThreads,
  getChannel,
```

Add these imports:

```ts
import { resolveGuildId, selectPreviousWorshipThread } from '@/lib/discord-sync/cron-state';
```

Inside `createWeeklyWorshipThread()`, after `threadName` is computed and before `createForumThread`, insert:

```ts
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });
    if (!guildId) {
      return { success: false, error: 'DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID' };
    }

    const previousThread = selectPreviousWorshipThread(
      await getActiveForumThreads(guildId, channelId),
      yymmdd,
    );
    if (previousThread) {
      await archiveThread(previousThread.id);
    }
```

- [ ] **Step 6: Run tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs lib/discord-sync/cron-state.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add app/api/cron/discord/create-thread/route.ts lib/actions/worship-prep.ts tests/discord-endpoint-source.test.mjs
git commit -m "feat: archive previous worship prep thread"
```

## Task 8: Event-Driven Readiness Hooks

**Files:**
- Modify: `app/api/discord/interactions/route.ts`
- Modify: `app/api/cron/discord/parse-comments/route.ts`
- Modify: `lib/actions/worship-prep.ts`
- Modify: `lib/actions/contis.ts`
- Modify: `tests/discord-endpoint-source.test.mjs`

- [ ] **Step 1: Add source tests for readiness hook placement**

Append this to `tests/discord-endpoint-source.test.mjs`:

```js
test('discord interactions checks readiness after role sheet update', async () => {
  const source = await readFile(
    new URL('../app/api/discord/interactions/route.ts', import.meta.url),
    'utf8',
  );

  const helperBody = source.slice(source.indexOf('async function safelyCheckWorshipPrepReadyNotification'));
  assert.match(helperBody, /try\s*\{/);
  assert.match(helperBody, /checkAndSendWorshipPrepReadyNotification\(input\)/);
  assert.match(helperBody, /catch \(error\)/);

  const body = source.slice(source.indexOf('await updateRoleSelectionInSheet'));
  assert.match(body, /safelyCheckWorshipPrepReadyNotification/);
  assert.ok(body.indexOf('updateRoleSelectionInSheet') < body.indexOf('safelyCheckWorshipPrepReadyNotification'));
});

test('parse-comments checks readiness after worship sheet update', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/parse-comments/route.ts', import.meta.url),
    'utf8',
  );

  const updateIndex = source.indexOf('await updateWorshipData');
  const afterUpdate = source.slice(updateIndex);
  const notifyIndex = afterUpdate.indexOf('safelyCheckWorshipPrepReadyNotification');
  const helperBody = source.slice(source.indexOf('async function safelyCheckWorshipPrepReadyNotification'));

  assert.ok(updateIndex !== -1);
  assert.ok(notifyIndex !== -1);
  assert.match(helperBody, /try\s*\{/);
  assert.match(helperBody, /checkAndSendWorshipPrepReadyNotification\(input\)/);
  assert.match(helperBody, /catch \(error\)/);
});

test('manual worship-prep parse action checks readiness after worship sheet update', async () => {
  const source = await readFile(
    new URL('../lib/actions/worship-prep.ts', import.meta.url),
    'utf8',
  );

  const helperBody = source.slice(source.indexOf('async function safelyCheckWorshipPrepReadyNotification'));
  assert.match(helperBody, /try\s*\{/);
  assert.match(helperBody, /checkAndSendWorshipPrepReadyNotification\(input\)/);
  assert.match(helperBody, /catch \(error\)/);

  const updateIndex = source.indexOf('await updateWorshipData');
  const afterUpdate = source.slice(updateIndex);
  const notifyIndex = afterUpdate.indexOf('safelyCheckWorshipPrepReadyNotification');

  assert.ok(updateIndex !== -1);
  assert.ok(notifyIndex !== -1);
});

test('conti actions check readiness after create and update', async () => {
  const source = await readFile(new URL('../lib/actions/contis.ts', import.meta.url), 'utf8');

  assert.match(source, /checkAndSendWorshipPrepReadyNotification/);
  assert.match(source, /toYYMMDDFromIsoDate/);
  assert.match(source, /safelyCheckWorshipPrepReadyNotificationForIsoDate/);

  const createBody = source.slice(source.indexOf('export async function createConti'), source.indexOf('export async function updateConti'));
  const updateBody = source.slice(source.indexOf('export async function updateConti'), source.indexOf('export async function deleteConti'));

  assert.match(createBody, /safelyCheckWorshipPrepReadyNotificationForIsoDate/);
  assert.match(updateBody, /safelyCheckWorshipPrepReadyNotificationForIsoDate/);
});
```

- [ ] **Step 2: Run the source test and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: FAIL because readiness hooks are not wired.

- [ ] **Step 3: Add a small safe-call helper pattern to each integration**

Use this pattern at each hook site, with the `origin` field included only in route handlers:

```ts
async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) {
      console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
    }
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}
```

The notification function returns errors instead of throwing for normal operational failures, but the helper also catches unexpected exceptions. A notification failure must not turn a successful role, sheet, or conti update into a failed user action.

- [ ] **Step 4: Wire the Discord interaction hook**

In `app/api/discord/interactions/route.ts`, add:

```ts
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
```

Add this helper near `getInteractionThreadName()`:

```ts
async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) {
      console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
    }
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}
```

After `await updateRoleSelectionInSheet(customId, selectedValue, sundayDate);`, add:

```ts
      await safelyCheckWorshipPrepReadyNotification({
        sundayDate,
        origin: new URL(request.url).origin,
      });
```

- [ ] **Step 5: Wire the parse-comments cron hook**

In `app/api/cron/discord/parse-comments/route.ts`, add:

```ts
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
```

Add this helper below `hasParsedData()`:

```ts
async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) {
      console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
    }
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}
```

After `await updateWorshipData(SHEET_NAME, targetRow, mergedData);`, add:

```ts
      await safelyCheckWorshipPrepReadyNotification({
        sundayDate: activeThread.sundayDate,
        origin: new URL(request.url).origin,
      });
```

- [ ] **Step 6: Wire the manual parse action hook**

In `lib/actions/worship-prep.ts`, add:

```ts
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
```

Add this helper below `toSheetDate()`:

```ts
async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) {
      console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
    }
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}
```

After the manual parse path calls `await updateWorshipData(SHEET_NAME, targetRow, mergedData);`, add:

```ts
      await safelyCheckWorshipPrepReadyNotification({ sundayDate: activeThread.sundayDate });
```

- [ ] **Step 7: Wire conti create and update hooks**

In `lib/actions/contis.ts`, add:

```ts
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
import { toYYMMDDFromIsoDate } from '@/lib/discord-sync/worship-prep-readiness';
```

Add these helpers below `contiSchema`:

```ts
async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) {
      console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
    }
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}

async function safelyCheckWorshipPrepReadyNotificationForIsoDate(isoDate: string) {
  try {
    await safelyCheckWorshipPrepReadyNotification({
      sundayDate: toYYMMDDFromIsoDate(isoDate),
    });
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}
```

In `createConti()`, after `revalidatePath('/contis');`, add:

```ts
    await safelyCheckWorshipPrepReadyNotificationForIsoDate(conti.date);
```

In `updateConti()`, after `revalidatePath('/contis');`, add:

```ts
    if (result) {
      await safelyCheckWorshipPrepReadyNotificationForIsoDate(result.date);
    }
```

- [ ] **Step 8: Run source tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
git add app/api/discord/interactions/route.ts app/api/cron/discord/parse-comments/route.ts lib/actions/worship-prep.ts lib/actions/contis.ts tests/discord-endpoint-source.test.mjs
git commit -m "feat: check worship prep readiness after updates"
```

## Task 9: Ten-Minute Recovery Cron

**Files:**
- Create: `app/api/cron/discord/check-worship-prep-ready/route.ts`
- Modify: `vercel.json`
- Modify: `.env.example`
- Modify: `tests/discord-endpoint-source.test.mjs`

- [ ] **Step 1: Add source tests for recovery cron auth and schedule**

Append this to `tests/discord-endpoint-source.test.mjs`:

```js
test('check-worship-prep-ready cron requires auth before side effects', async () => {
  const source = await readFile(
    new URL('../app/api/cron/discord/check-worship-prep-ready/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /isCronAuthorized/);
  assert.match(source, /getCurrentOrUpcomingSundayDate/);
  assert.match(source, /day === 0 \? 0 : 7 - day/);

  const body = source.slice(source.indexOf('export async function GET'));
  const authIndex = body.indexOf('isCronAuthorized');
  const sideEffectIndexes = [
    body.indexOf('checkAndSendWorshipPrepReadyNotification('),
  ].filter((index) => index !== -1);

  assert.notEqual(authIndex, -1);
  assert.ok(sideEffectIndexes.length > 0);
  assert.ok(sideEffectIndexes.every((index) => authIndex < index));
  assert.match(body, /status:\s*401/);
});

test('vercel config schedules worship prep readiness recovery every 10 minutes', async () => {
  const source = await readFile(new URL('../vercel.json', import.meta.url), 'utf8');
  const config = JSON.parse(source);

  assert.ok(
    config.crons.some(
      (cron) =>
        cron.path === '/api/cron/discord/check-worship-prep-ready' &&
        cron.schedule === '*/10 * * * *',
    ),
  );
});
```

- [ ] **Step 2: Run the source tests and verify failure**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: FAIL because the cron route and schedule do not exist.

- [ ] **Step 3: Create the cron route**

Create `app/api/cron/discord/check-worship-prep-ready/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { formatToYYMMDD } from '@/lib/discord-sync/thread-template';
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';

export const maxDuration = 60;

function getCurrentOrUpcomingSundayDate(baseDate = new Date()): Date {
  const date = new Date(baseDate);
  const day = date.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sundayDate = formatToYYMMDD(getCurrentOrUpcomingSundayDate());
    const result = await checkAndSendWorshipPrepReadyNotification({
      sundayDate,
      origin: new URL(request.url).origin,
    });

    return NextResponse.json({
      success: result.success,
      message: result.status,
      data: {
        threadId: result.threadId ?? null,
        messageId: result.messageId ?? null,
        error: result.error ?? null,
      },
    }, { status: result.success ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Add the Vercel cron schedule**

In `vercel.json`, add this object to the `crons` array:

```json
{
  "path": "/api/cron/discord/check-worship-prep-ready",
  "schedule": "*/10 * * * *"
}
```

- [ ] **Step 5: Document the app URL env var**

In `.env.example`, below `AUTH_SECRET`, add:

```dotenv
# Public base URL used by server-side Discord notifications.
APP_BASE_URL=https://your-storyboard-domain.example
```

- [ ] **Step 6: Run the source tests and verify pass**

Run:

```bash
node --experimental-strip-types --test tests/discord-endpoint-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add app/api/cron/discord/check-worship-prep-ready/route.ts vercel.json .env.example tests/discord-endpoint-source.test.mjs
git commit -m "feat: add worship prep readiness recovery cron"
```

## Task 10: Final Validation

**Files:**
- Verify all modified files from prior tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --experimental-strip-types --test lib/discord-sync/cron-state.test.mjs lib/discord-sync/worship-prep-readiness.test.mjs lib/discord-sync/worship-prep-notification-state.test.mjs tests/discord-endpoint-source.test.mjs tests/discord-notification-schema-source.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the project test subset**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: no unstaged or uncommitted files.

- [ ] **Step 5: Summarize rollout requirements**

Report these deployment requirements to the user:

```text
Set APP_BASE_URL in the deployed environment before relying on server-action-triggered notifications.
Apply the Neon and Turso migrations before enabling the recovery cron in production.
Use /api/cron/discord/create-thread?dryRun=true to confirm the previous thread archive target before the next Monday run.
```

## Self-Review

Spec coverage:

- Monday 09:00 KST weekly creation: covered by Task 7 using the existing `0 0 * * 1` schedule.
- Previous thread archive only: covered by Tasks 1, 2, and 7; `archiveThread()` sends only `archived: true`.
- Readiness includes six sheet fields plus linked conti: covered by Task 4 and Task 6.
- Event-driven checks plus 10-minute polling: covered by Tasks 8 and 9.
- Duplicate prevention with atomic claim-before-send: covered by Tasks 3, 5, and 6.
- Turso row-read concern, `contis.date` index, and Drizzle migration metadata: covered by Task 3.
- URL construction through app base URL and origin fallback: covered by Task 4 and Task 6.
- Testing and rollout: covered by Tasks 1 through 10.

Completeness scan:

- No task leaves an unspecified implementation gap.
- Every code-changing step lists the exact file and concrete code to add or replace.

Type consistency:

- `sundayDate` consistently means `YYMMDD`.
- `isoDate` consistently means `YYYY-MM-DD`.
- Notification type is consistently `ppt_ready`.
- Notification statuses are consistently `pending`, `sent`, and `failed`.
