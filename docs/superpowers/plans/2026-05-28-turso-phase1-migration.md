# Turso Phase 1 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move structured Storyboard app data from Neon/Vercel Postgres to Turso/libSQL first, with verification tooling that proves Turso matches the current Neon data before production cutover.

**Architecture:** Introduce a Turso/libSQL schema and repository-backed migration path while keeping Neon available for export and verification. Phase 1 changes structured data only; file objects remain in Vercel Blob until the later R2 phase.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Turso/libSQL, Neon serverless for migration reads, Vercel env vars.

---

## Scope

This plan implements Phase 1 from `docs/superpowers/specs/2026-05-28-turso-r2-migration-design.md`.

In scope:

- Turso provider setup and env wiring.
- Turso-compatible Drizzle schema.
- Turso database client.
- Neon export snapshot tooling.
- Turso import tooling.
- Neon-vs-Turso verification tooling.
- Repository boundary for structured data reads/writes used by the app.
- Cutover switch from Neon to Turso after verification.

Out of scope for this plan:

- Moving files from Vercel Blob to Cloudflare R2.
- Rewriting file URLs or file provider metadata for R2.
- Removing Vercel Blob dependency.
- Replacing normal song/conti editing screens with admin JSON editing.

Cloudflare signup and an R2 bucket may be prepared during provider setup so Phase 2 is unblocked, but no app code should write files to R2 in Phase 1.

## File Structure

Create:

- `lib/db/turso-schema.ts`  
  Turso/libSQL Drizzle schema mirroring the current domain tables.

- `lib/db/turso.ts`  
  Turso Drizzle client factory using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

- `lib/db/time.ts`  
  Timestamp conversion helpers shared by schema mappers and tests.

- `lib/repositories/storyboard/types.ts`  
  Stable domain snapshot and repository types independent from provider-specific Drizzle schemas.

- `lib/repositories/storyboard/neon-snapshot.ts`  
  Reads all current Neon tables into a normalized snapshot for migration verification.

- `lib/repositories/storyboard/turso-snapshot.ts`  
  Reads all current Turso tables into the same normalized snapshot shape.

- `lib/repositories/storyboard/turso-import.ts`  
  Imports a normalized snapshot into Turso.

- `lib/repositories/storyboard/verify.ts`  
  Compares Neon and Turso snapshots by counts, stable hashes, and relationship checks.

- `lib/repositories/storyboard/index.ts`  
  Selects the active app repository according to `DATABASE_PROVIDER`.

- `lib/repositories/storyboard/neon-repository.ts`  
  App repository implementation backed by current Neon/Drizzle behavior.

- `lib/repositories/storyboard/turso-repository.ts`  
  App repository implementation backed by Turso/Drizzle.

- `scripts/storyboard-migration/export-neon.mjs`  
  CLI export command for Neon snapshots.

- `scripts/storyboard-migration/import-turso.mjs`  
  CLI import command for Turso.

- `scripts/storyboard-migration/verify-turso.mjs`  
  CLI verification command.

- `lib/repositories/storyboard/verify.test.ts`  
  Node test coverage for snapshot hashing and relationship checks.

- `lib/db/time.test.ts`  
  Node test coverage for timestamp conversions.

Modify:

- `package.json`  
  Add Turso dependency and migration scripts.

- `.env.example`  
  Document Turso provider env vars and reserved Cloudflare R2 env vars.

- `lib/types.ts`  
  Keep public app types stable by exporting domain-facing `Date` values even when Turso stores timestamps as ISO text.

- `lib/queries/songs.ts`  
  Read through `getStoryboardRepository()`.

- `lib/queries/contis.ts`  
  Read through `getStoryboardRepository()`.

- `lib/actions/songs.ts`  
  Write through `getStoryboardRepository()`.

- `lib/actions/contis.ts`  
  Write through `getStoryboardRepository()`.

- `lib/actions/sheet-music.ts`  
  Keep file upload/delete in Vercel Blob, but write metadata through `getStoryboardRepository()`.

- `lib/actions/song-presets.ts`  
  Write preset data through `getStoryboardRepository()`.

- `lib/actions/conti-songs.ts`  
  Write conti-song data through `getStoryboardRepository()`.

- `lib/actions/conti-pdf-exports.ts`  
  Keep PDF file storage in Vercel Blob, but write export metadata through `getStoryboardRepository()`.

- `lib/actions/song-page-images.ts`  
  Keep generated image storage in Vercel Blob, but write image metadata through `getStoryboardRepository()`.

## Task 1: Provider Setup And Env Contract

**Files:**
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Open provider signup pages in the browser**

Use the in-app browser to open:

```text
https://turso.tech/
https://dash.cloudflare.com/
```

Ask the user to complete account signup and login if required. Do not enter passwords, payment card data, or one-time codes for the user.

- [ ] **Step 2: Create provider resources**

In Turso, create a database with these settings:

```text
Database name: storyboard
Region: closest available Asia region to Seoul, preferring Tokyo or Singapore
```

In Cloudflare, create or prepare an R2 bucket for Phase 2:

```text
Bucket name: storyboard-assets
Public access: disabled unless a custom public delivery domain is configured later
```

Record only non-secret identifiers in notes:

```text
Turso database name
Turso database URL
Cloudflare account id
R2 bucket name
R2 jurisdiction/region setting if shown
```

- [ ] **Step 3: Update `.env.example` with provider variables**

Edit `.env.example` so the provider section includes:

```bash
# Database provider
# Use "neon" before cutover and "turso" after verification passes.
DATABASE_PROVIDER=neon

# Neon / Vercel Postgres
POSTGRES_URL=postgresql://user:password@host/dbname

# Turso / libSQL
TURSO_DATABASE_URL=libsql://your-database-org.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# Cloudflare R2, reserved for Phase 2 file migration
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=storyboard-assets
R2_PUBLIC_BASE_URL=https://assets.example.com
```

- [ ] **Step 4: Add package scripts for migration commands**

Update `package.json` scripts:

```json
{
  "db:export:neon": "node scripts/storyboard-migration/export-neon.mjs",
  "db:import:turso": "node scripts/storyboard-migration/import-turso.mjs",
  "db:verify:turso": "node scripts/storyboard-migration/verify-turso.mjs"
}
```

Keep existing scripts unchanged.

- [ ] **Step 5: Install Turso dependency**

Run:

```bash
pnpm add @libsql/client
```

Expected:

```text
dependencies:
+ @libsql/client
```

- [ ] **Step 6: Commit provider env contract**

Run:

```bash
git add .env.example package.json pnpm-lock.yaml
git commit -m "chore: add turso migration env contract"
```

## Task 2: Turso Schema And Client

**Files:**
- Create: `lib/db/turso-schema.ts`
- Create: `lib/db/turso.ts`
- Create: `lib/db/time.ts`
- Create: `lib/db/time.test.ts`

- [ ] **Step 1: Write timestamp helper tests**

Create `lib/db/time.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateToDbText, dbTextToDate } from './time';

describe('database timestamp helpers', () => {
  it('serializes Date values as ISO strings', () => {
    const date = new Date('2026-05-28T03:04:05.678Z');
    assert.equal(dateToDbText(date), '2026-05-28T03:04:05.678Z');
  });

  it('parses ISO strings into Date values', () => {
    const date = dbTextToDate('2026-05-28T03:04:05.678Z');
    assert.equal(date.toISOString(), '2026-05-28T03:04:05.678Z');
  });
});
```

- [ ] **Step 2: Run timestamp tests and verify failure**

Run:

```bash
node --experimental-strip-types --test lib/db/time.test.ts
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

because `lib/db/time.ts` does not exist yet.

- [ ] **Step 3: Implement timestamp helpers**

Create `lib/db/time.ts`:

```ts
export function dateToDbText(value: Date): string {
  return value.toISOString();
}

export function dbTextToDate(value: string): Date {
  return new Date(value);
}

export function nowDbText(): string {
  return dateToDbText(new Date());
}
```

- [ ] **Step 4: Run timestamp tests and verify pass**

Run:

```bash
node --experimental-strip-types --test lib/db/time.test.ts
```

Expected:

```text
pass 2
```

- [ ] **Step 5: Create Turso schema**

Create `lib/db/turso-schema.ts`:

```ts
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sheetMusicFiles = sqliteTable('sheet_music_files', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const songPresets = sqliteTable('song_presets', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  youtubeReference: text('youtube_reference'),
  youtubeTitle: text('youtube_title'),
  pdfMetadata: text('pdf_metadata'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const presetSheetMusic = sqliteTable('preset_sheet_music', {
  id: text('id').primaryKey(),
  presetId: text('preset_id').notNull().references(() => songPresets.id, { onDelete: 'cascade' }),
  sheetMusicFileId: text('sheet_music_file_id').notNull().references(() => sheetMusicFiles.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  uniqueIndex('preset_sheet_music_unique').on(table.presetId, table.sheetMusicFileId),
]);

export const contis = sqliteTable('contis', {
  id: text('id').primaryKey(),
  title: text('title'),
  date: text('date').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const contiSongs = sqliteTable('conti_songs', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  sortOrder: integer('sort_order').notNull(),
  keys: text('keys'),
  tempos: text('tempos'),
  sectionOrder: text('section_order'),
  lyrics: text('lyrics'),
  sectionLyricsMap: text('section_lyrics_map'),
  notes: text('notes'),
  sheetMusicFileIds: text('sheet_music_file_ids'),
  presetId: text('preset_id').references(() => songPresets.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_song_unique').on(table.contiId, table.songId),
]);

export const contiPdfExports = sqliteTable('conti_pdf_exports', {
  id: text('id').primaryKey(),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  pdfUrl: text('pdf_url'),
  layoutState: text('layout_state'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('conti_pdf_export_unique').on(table.contiId),
]);

export const songPageImages = sqliteTable('song_page_images', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  contiId: text('conti_id').notNull().references(() => contis.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  pageIndex: integer('page_index').notNull(),
  sheetMusicFileId: text('sheet_music_file_id').references(() => sheetMusicFiles.id, { onDelete: 'set null' }),
  pdfPageIndex: integer('pdf_page_index'),
  presetSnapshot: text('preset_snapshot'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

Do not add Discord state tables to the Turso app schema in Phase 1 because the frequent cron was intentionally made DB-free and those old tables are not part of the target app source of truth.

- [ ] **Step 6: Create Turso client**

Create `lib/db/turso.ts`:

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@/lib/db/turso-schema';

export function createTursoClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required when DATABASE_PROVIDER=turso');
  }

  return createClient({ url, authToken });
}

export function createTursoDb() {
  return drizzle(createTursoClient(), { schema });
}

export const tursoDb = createTursoDb();
```

- [ ] **Step 7: Run typecheck for new schema/client**

Run:

```bash
pnpm lint
```

Expected:

```text
No lint errors from lib/db/turso-schema.ts, lib/db/turso.ts, or lib/db/time.ts
```

- [ ] **Step 8: Commit schema/client work**

Run:

```bash
git add lib/db/turso-schema.ts lib/db/turso.ts lib/db/time.ts lib/db/time.test.ts
git commit -m "feat: add turso schema and client"
```

## Task 3: Snapshot Types And Verifier

**Files:**
- Create: `lib/repositories/storyboard/types.ts`
- Create: `lib/repositories/storyboard/verify.ts`
- Create: `lib/repositories/storyboard/verify.test.ts`

- [ ] **Step 1: Write verifier tests**

Create `lib/repositories/storyboard/verify.test.ts`:

```ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StoryboardSnapshot } from './types';
import { verifyStoryboardSnapshots } from './verify';

function baseSnapshot(): StoryboardSnapshot {
  return {
    songs: [{ id: 'song-1', name: '비 준비하시니', createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    sheetMusicFiles: [{ id: 'sheet-1', songId: 'song-1', fileUrl: 'https://blob.example/sheet.pdf', fileName: 'sheet.pdf', fileType: 'application/pdf', sortOrder: 0, createdAt: '2026-05-01T00:00:00.000Z' }],
    songPresets: [{ id: 'preset-1', songId: 'song-1', name: '기본', keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}', notes: null, youtubeReference: null, youtubeTitle: null, pdfMetadata: null, isDefault: true, sortOrder: 0, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    presetSheetMusic: [{ id: 'psm-1', presetId: 'preset-1', sheetMusicFileId: 'sheet-1', sortOrder: 0 }],
    contis: [{ id: 'conti-1', title: '주일예배', date: '2026-05-31', description: null, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    contiSongs: [{ id: 'conti-song-1', contiId: 'conti-1', songId: 'song-1', sortOrder: 0, keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}', notes: null, sheetMusicFileIds: null, presetId: 'preset-1', createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    contiPdfExports: [{ id: 'export-1', contiId: 'conti-1', pdfUrl: null, layoutState: null, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    songPageImages: [{ id: 'image-1', songId: 'song-1', contiId: 'conti-1', imageUrl: 'https://blob.example/image.jpg', pageIndex: 0, sheetMusicFileId: 'sheet-1', pdfPageIndex: null, presetSnapshot: null, createdAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
  };
}

describe('verifyStoryboardSnapshots', () => {
  it('passes equal snapshots', async () => {
    const result = await verifyStoryboardSnapshots(baseSnapshot(), baseSnapshot());
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('fails when entity counts differ', async () => {
    const turso = baseSnapshot();
    turso.songs = [];
    const result = await verifyStoryboardSnapshots(baseSnapshot(), turso);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('songs count mismatch')));
  });

  it('fails when relationships are orphaned', async () => {
    const turso = baseSnapshot();
    turso.contiSongs[0].songId = 'missing-song';
    const result = await verifyStoryboardSnapshots(baseSnapshot(), turso);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('contiSongs conti-song-1 references missing song missing-song')));
  });
});
```

- [ ] **Step 2: Run verifier tests and verify failure**

Run:

```bash
node --experimental-strip-types --test lib/repositories/storyboard/verify.test.ts
```

Expected:

```text
ERR_MODULE_NOT_FOUND
```

because `types.ts` and `verify.ts` do not exist yet.

- [ ] **Step 3: Create snapshot types**

Create `lib/repositories/storyboard/types.ts`:

```ts
export interface SnapshotSong {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSheetMusicFile {
  id: string;
  songId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sortOrder: number;
  createdAt: string;
}

export interface SnapshotSongPreset {
  id: string;
  songId: string;
  name: string;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  youtubeReference: string | null;
  youtubeTitle: string | null;
  pdfMetadata: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotPresetSheetMusic {
  id: string;
  presetId: string;
  sheetMusicFileId: string;
  sortOrder: number;
}

export interface SnapshotConti {
  id: string;
  title: string | null;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiSong {
  id: string;
  contiId: string;
  songId: string;
  sortOrder: number;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  sheetMusicFileIds: string | null;
  presetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiPdfExport {
  id: string;
  contiId: string;
  pdfUrl: string | null;
  layoutState: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSongPageImage {
  id: string;
  songId: string;
  contiId: string;
  imageUrl: string;
  pageIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex: number | null;
  presetSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSnapshot {
  songs: SnapshotSong[];
  sheetMusicFiles: SnapshotSheetMusicFile[];
  songPresets: SnapshotSongPreset[];
  presetSheetMusic: SnapshotPresetSheetMusic[];
  contis: SnapshotConti[];
  contiSongs: SnapshotContiSong[];
  contiPdfExports: SnapshotContiPdfExport[];
  songPageImages: SnapshotSongPageImage[];
}

export interface VerificationResult {
  ok: boolean;
  counts: Record<keyof StoryboardSnapshot, { neon: number; turso: number }>;
  errors: string[];
}
```

- [ ] **Step 4: Implement verifier**

Create `lib/repositories/storyboard/verify.ts`:

```ts
import type { StoryboardSnapshot, VerificationResult } from './types';

const snapshotKeys = [
  'songs',
  'sheetMusicFiles',
  'songPresets',
  'presetSheetMusic',
  'contis',
  'contiSongs',
  'contiPdfExports',
  'songPageImages',
] as const;

function ids<T extends { id: string }>(rows: T[]) {
  return new Set(rows.map((row) => row.id));
}

function sortedJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(JSON.parse(JSON.stringify(value))).sort());
}

function stableRows<T extends { id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id));
}

function assertSameRows<T extends { id: string }>(
  errors: string[],
  key: string,
  neonRows: T[],
  tursoRows: T[],
) {
  const neonById = new Map(neonRows.map((row) => [row.id, row]));
  const tursoById = new Map(tursoRows.map((row) => [row.id, row]));

  for (const id of neonById.keys()) {
    if (!tursoById.has(id)) {
      errors.push(`${key} missing in turso: ${id}`);
    }
  }

  for (const id of tursoById.keys()) {
    if (!neonById.has(id)) {
      errors.push(`${key} extra in turso: ${id}`);
    }
  }

  for (const row of stableRows(neonRows)) {
    const other = tursoById.get(row.id);
    if (other && sortedJson(row) !== sortedJson(other)) {
      errors.push(`${key} row mismatch: ${row.id}`);
    }
  }
}

function verifyRelationships(snapshot: StoryboardSnapshot, errors: string[]) {
  const songIds = ids(snapshot.songs);
  const contiIds = ids(snapshot.contis);
  const presetIds = ids(snapshot.songPresets);
  const sheetMusicIds = ids(snapshot.sheetMusicFiles);

  for (const row of snapshot.sheetMusicFiles) {
    if (!songIds.has(row.songId)) errors.push(`sheetMusicFiles ${row.id} references missing song ${row.songId}`);
  }

  for (const row of snapshot.songPresets) {
    if (!songIds.has(row.songId)) errors.push(`songPresets ${row.id} references missing song ${row.songId}`);
  }

  for (const row of snapshot.presetSheetMusic) {
    if (!presetIds.has(row.presetId)) errors.push(`presetSheetMusic ${row.id} references missing preset ${row.presetId}`);
    if (!sheetMusicIds.has(row.sheetMusicFileId)) errors.push(`presetSheetMusic ${row.id} references missing sheet music ${row.sheetMusicFileId}`);
  }

  for (const row of snapshot.contiSongs) {
    if (!contiIds.has(row.contiId)) errors.push(`contiSongs ${row.id} references missing conti ${row.contiId}`);
    if (!songIds.has(row.songId)) errors.push(`contiSongs ${row.id} references missing song ${row.songId}`);
    if (row.presetId && !presetIds.has(row.presetId)) errors.push(`contiSongs ${row.id} references missing preset ${row.presetId}`);
  }

  for (const row of snapshot.contiPdfExports) {
    if (!contiIds.has(row.contiId)) errors.push(`contiPdfExports ${row.id} references missing conti ${row.contiId}`);
  }

  for (const row of snapshot.songPageImages) {
    if (!songIds.has(row.songId)) errors.push(`songPageImages ${row.id} references missing song ${row.songId}`);
    if (!contiIds.has(row.contiId)) errors.push(`songPageImages ${row.id} references missing conti ${row.contiId}`);
    if (row.sheetMusicFileId && !sheetMusicIds.has(row.sheetMusicFileId)) {
      errors.push(`songPageImages ${row.id} references missing sheet music ${row.sheetMusicFileId}`);
    }
  }
}

export async function verifyStoryboardSnapshots(
  neon: StoryboardSnapshot,
  turso: StoryboardSnapshot,
): Promise<VerificationResult> {
  const errors: string[] = [];
  const counts = {} as VerificationResult['counts'];

  for (const key of snapshotKeys) {
    counts[key] = { neon: neon[key].length, turso: turso[key].length };
    if (neon[key].length !== turso[key].length) {
      errors.push(`${key} count mismatch: neon=${neon[key].length} turso=${turso[key].length}`);
    }
    assertSameRows(errors, key, neon[key] as Array<{ id: string }>, turso[key] as Array<{ id: string }>);
  }

  verifyRelationships(turso, errors);

  return {
    ok: errors.length === 0,
    counts,
    errors,
  };
}
```

- [ ] **Step 5: Run verifier tests and verify pass**

Run:

```bash
node --experimental-strip-types --test lib/repositories/storyboard/verify.test.ts
```

Expected:

```text
pass 3
```

- [ ] **Step 6: Commit snapshot verifier**

Run:

```bash
git add lib/repositories/storyboard/types.ts lib/repositories/storyboard/verify.ts lib/repositories/storyboard/verify.test.ts
git commit -m "feat: add storyboard migration verifier"
```

## Task 4: Neon And Turso Snapshot Readers

**Files:**
- Create: `lib/repositories/storyboard/neon-snapshot.ts`
- Create: `lib/repositories/storyboard/turso-snapshot.ts`

- [ ] **Step 1: Implement Neon snapshot reader**

Create `lib/repositories/storyboard/neon-snapshot.ts`:

```ts
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  songs,
  sheetMusicFiles,
  songPresets,
  presetSheetMusic,
  contis,
  contiSongs,
  contiPdfExports,
  songPageImages,
} from '@/lib/db/schema';
import { dateToDbText } from '@/lib/db/time';
import type { StoryboardSnapshot } from './types';

export async function readNeonSnapshot(): Promise<StoryboardSnapshot> {
  const [
    songRows,
    sheetMusicRows,
    presetRows,
    presetSheetMusicRows,
    contiRows,
    contiSongRows,
    exportRows,
    imageRows,
  ] = await Promise.all([
    db.select().from(songs).orderBy(asc(songs.id)),
    db.select().from(sheetMusicFiles).orderBy(asc(sheetMusicFiles.id)),
    db.select().from(songPresets).orderBy(asc(songPresets.id)),
    db.select().from(presetSheetMusic).orderBy(asc(presetSheetMusic.id)),
    db.select().from(contis).orderBy(asc(contis.id)),
    db.select().from(contiSongs).orderBy(asc(contiSongs.id)),
    db.select().from(contiPdfExports).orderBy(asc(contiPdfExports.id)),
    db.select().from(songPageImages).orderBy(asc(songPageImages.id)),
  ]);

  return {
    songs: songRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
    sheetMusicFiles: sheetMusicRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt) })),
    songPresets: presetRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
    presetSheetMusic: presetSheetMusicRows,
    contis: contiRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
    contiSongs: contiSongRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
    contiPdfExports: exportRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
    songPageImages: imageRows.map((row) => ({ ...row, createdAt: dateToDbText(row.createdAt), updatedAt: dateToDbText(row.updatedAt) })),
  };
}
```

- [ ] **Step 2: Implement Turso snapshot reader**

Create `lib/repositories/storyboard/turso-snapshot.ts`:

```ts
import { asc } from 'drizzle-orm';
import { tursoDb } from '@/lib/db/turso';
import {
  songs,
  sheetMusicFiles,
  songPresets,
  presetSheetMusic,
  contis,
  contiSongs,
  contiPdfExports,
  songPageImages,
} from '@/lib/db/turso-schema';
import type { StoryboardSnapshot } from './types';

export async function readTursoSnapshot(): Promise<StoryboardSnapshot> {
  const [
    songRows,
    sheetMusicRows,
    presetRows,
    presetSheetMusicRows,
    contiRows,
    contiSongRows,
    exportRows,
    imageRows,
  ] = await Promise.all([
    tursoDb.select().from(songs).orderBy(asc(songs.id)),
    tursoDb.select().from(sheetMusicFiles).orderBy(asc(sheetMusicFiles.id)),
    tursoDb.select().from(songPresets).orderBy(asc(songPresets.id)),
    tursoDb.select().from(presetSheetMusic).orderBy(asc(presetSheetMusic.id)),
    tursoDb.select().from(contis).orderBy(asc(contis.id)),
    tursoDb.select().from(contiSongs).orderBy(asc(contiSongs.id)),
    tursoDb.select().from(contiPdfExports).orderBy(asc(contiPdfExports.id)),
    tursoDb.select().from(songPageImages).orderBy(asc(songPageImages.id)),
  ]);

  return {
    songs: songRows,
    sheetMusicFiles: sheetMusicRows,
    songPresets: presetRows,
    presetSheetMusic: presetSheetMusicRows,
    contis: contiRows,
    contiSongs: contiSongRows,
    contiPdfExports: exportRows,
    songPageImages: imageRows,
  };
}
```

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected:

```text
No lint errors from neon-snapshot.ts or turso-snapshot.ts
```

- [ ] **Step 4: Commit snapshot readers**

Run:

```bash
git add lib/repositories/storyboard/neon-snapshot.ts lib/repositories/storyboard/turso-snapshot.ts
git commit -m "feat: add storyboard snapshot readers"
```

## Task 5: Turso Import And Migration Scripts

**Files:**
- Create: `lib/repositories/storyboard/turso-import.ts`
- Create: `scripts/storyboard-migration/export-neon.mjs`
- Create: `scripts/storyboard-migration/import-turso.mjs`
- Create: `scripts/storyboard-migration/verify-turso.mjs`

- [ ] **Step 1: Implement Turso import helper**

Create `lib/repositories/storyboard/turso-import.ts`:

```ts
import { tursoDb } from '@/lib/db/turso';
import {
  songs,
  sheetMusicFiles,
  songPresets,
  presetSheetMusic,
  contis,
  contiSongs,
  contiPdfExports,
  songPageImages,
} from '@/lib/db/turso-schema';
import type { StoryboardSnapshot } from './types';

export async function importSnapshotToTurso(snapshot: StoryboardSnapshot) {
  await tursoDb.delete(songPageImages);
  await tursoDb.delete(contiPdfExports);
  await tursoDb.delete(presetSheetMusic);
  await tursoDb.delete(contiSongs);
  await tursoDb.delete(songPresets);
  await tursoDb.delete(sheetMusicFiles);
  await tursoDb.delete(contis);
  await tursoDb.delete(songs);

  if (snapshot.songs.length > 0) await tursoDb.insert(songs).values(snapshot.songs);
  if (snapshot.contis.length > 0) await tursoDb.insert(contis).values(snapshot.contis);
  if (snapshot.sheetMusicFiles.length > 0) await tursoDb.insert(sheetMusicFiles).values(snapshot.sheetMusicFiles);
  if (snapshot.songPresets.length > 0) await tursoDb.insert(songPresets).values(snapshot.songPresets);
  if (snapshot.contiSongs.length > 0) await tursoDb.insert(contiSongs).values(snapshot.contiSongs);
  if (snapshot.presetSheetMusic.length > 0) await tursoDb.insert(presetSheetMusic).values(snapshot.presetSheetMusic);
  if (snapshot.contiPdfExports.length > 0) await tursoDb.insert(contiPdfExports).values(snapshot.contiPdfExports);
  if (snapshot.songPageImages.length > 0) await tursoDb.insert(songPageImages).values(snapshot.songPageImages);
}
```

- [ ] **Step 2: Create export script**

Create `scripts/storyboard-migration/export-neon.mjs`:

```js
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { readNeonSnapshot } = await import('../../lib/repositories/storyboard/neon-snapshot.ts');

const outDir = resolve('tmp/storyboard-migration');
const outFile = resolve(outDir, 'neon-snapshot.json');
await mkdir(outDir, { recursive: true });

const snapshot = await readNeonSnapshot();
await writeFile(outFile, JSON.stringify(snapshot, null, 2));

console.log(`Wrote ${outFile}`);
console.log(JSON.stringify({
  songs: snapshot.songs.length,
  contis: snapshot.contis.length,
  contiSongs: snapshot.contiSongs.length,
  sheetMusicFiles: snapshot.sheetMusicFiles.length,
}, null, 2));
```

- [ ] **Step 3: Create import script**

Create `scripts/storyboard-migration/import-turso.mjs`:

```js
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { importSnapshotToTurso } = await import('../../lib/repositories/storyboard/turso-import.ts');

const inputFile = resolve('tmp/storyboard-migration/neon-snapshot.json');
const snapshot = JSON.parse(await readFile(inputFile, 'utf8'));
await importSnapshotToTurso(snapshot);

console.log(`Imported ${inputFile} into Turso`);
```

- [ ] **Step 4: Create verification script**

Create `scripts/storyboard-migration/verify-turso.mjs`:

```js
const { readNeonSnapshot } = await import('../../lib/repositories/storyboard/neon-snapshot.ts');
const { readTursoSnapshot } = await import('../../lib/repositories/storyboard/turso-snapshot.ts');
const { verifyStoryboardSnapshots } = await import('../../lib/repositories/storyboard/verify.ts');

const neon = await readNeonSnapshot();
const turso = await readTursoSnapshot();
const result = await verifyStoryboardSnapshots(neon, turso);

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
```

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected:

```text
No lint errors from turso-import.ts
```

- [ ] **Step 6: Commit migration scripts**

Run:

```bash
git add lib/repositories/storyboard/turso-import.ts scripts/storyboard-migration/export-neon.mjs scripts/storyboard-migration/import-turso.mjs scripts/storyboard-migration/verify-turso.mjs
git commit -m "feat: add turso migration scripts"
```

## Task 6: App Repository Boundary

**Files:**
- Create: `lib/repositories/storyboard/index.ts`
- Create: `lib/repositories/storyboard/neon-repository.ts`
- Create: `lib/repositories/storyboard/turso-repository.ts`
- Modify: `lib/queries/songs.ts`
- Modify: `lib/queries/contis.ts`

- [ ] **Step 1: Create repository selector**

Create `lib/repositories/storyboard/index.ts`:

```ts
import { neonStoryboardRepository } from './neon-repository';
import { tursoStoryboardRepository } from './turso-repository';

export function getStoryboardRepository() {
  const provider = process.env.DATABASE_PROVIDER ?? 'neon';

  if (provider === 'turso') {
    return tursoStoryboardRepository;
  }

  if (provider === 'neon') {
    return neonStoryboardRepository;
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
}
```

- [ ] **Step 2: Create Neon read repository by moving current query bodies**

Create `lib/repositories/storyboard/neon-repository.ts` by moving the current exported read functions from `lib/queries/songs.ts` and `lib/queries/contis.ts` into methods:

```ts
import { db } from '@/lib/db';
import { songs, sheetMusicFiles, songPresets, presetSheetMusic, contis, contiSongs, contiPdfExports } from '@/lib/db/schema';
import { eq, desc, inArray, ilike } from 'drizzle-orm';
import { parseContiSongOverrides, parsePresetPdfMetadata } from '@/lib/db/helpers';
import type { ContiPdfExport, ContiWithSongSummaries, ContiWithSongs, ContiWithSongsAndSheetMusic, PresetPdfMetadata, SongPresetWithSheetMusic, SongWithSheetMusic } from '@/lib/types';

export const neonStoryboardRepository = {
  async getSongs() {
    return db.select().from(songs).orderBy(desc(songs.createdAt));
  },

  async getSong(id: string): Promise<SongWithSheetMusic | null> {
    const song = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (song.length === 0) return null;
    const sheetMusic = await db.select().from(sheetMusicFiles).where(eq(sheetMusicFiles.songId, id)).orderBy(sheetMusicFiles.sortOrder);
    const presets = await this.getSongPresetsWithSheetMusic(id);
    return { ...song[0], sheetMusic, presets };
  },

  async getSongPresets(songId: string) {
    return db.select().from(songPresets).where(eq(songPresets.songId, songId)).orderBy(songPresets.sortOrder);
  },

  async searchSongs(query: string) {
    return db.select().from(songs).where(ilike(songs.name, `%${query}%`)).orderBy(desc(songs.createdAt));
  },

  async getSongPresetsWithSheetMusic(songId: string): Promise<SongPresetWithSheetMusic[]> {
    const presets = await this.getSongPresets(songId);
    return Promise.all(presets.map(async (preset) => {
      const rows = await db.select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId }).from(presetSheetMusic).where(eq(presetSheetMusic.presetId, preset.id)).orderBy(presetSheetMusic.sortOrder);
      return { ...preset, sheetMusicFileIds: rows.map((row) => row.sheetMusicFileId) };
    }));
  },

  async getContis() {
    return db.select().from(contis).orderBy(desc(contis.date));
  },

  async getContiByDate(date: string) {
    const result = await db.select().from(contis).where(eq(contis.date, date)).limit(1);
    return result[0] ?? null;
  },

  async getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
    const contiRows = await this.getContis();
    if (contiRows.length === 0) return [];
    const contiIds = contiRows.map((conti) => conti.id);
    const rows = await db.select({
      contiSong: contiSongs,
      songName: songs.name,
      presetName: songPresets.name,
      youtubeReference: songPresets.youtubeReference,
      youtubeTitle: songPresets.youtubeTitle,
    }).from(contiSongs)
      .leftJoin(songs, eq(contiSongs.songId, songs.id))
      .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
      .where(inArray(contiSongs.contiId, contiIds))
      .orderBy(contiSongs.sortOrder);
    const byContiId = new Map<string, ContiWithSongSummaries['songSummaries']>();
    for (const row of rows) {
      const parsed = parseContiSongOverrides({
        keys: row.contiSong.keys,
        tempos: row.contiSong.tempos,
        sectionOrder: row.contiSong.sectionOrder,
        lyrics: row.contiSong.lyrics,
        sectionLyricsMap: row.contiSong.sectionLyricsMap,
        notes: row.contiSong.notes,
        sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
        presetId: row.contiSong.presetId,
      });
      const summaries = byContiId.get(row.contiSong.contiId) ?? [];
      summaries.push({
        id: row.contiSong.id,
        songId: row.contiSong.songId,
        sortOrder: row.contiSong.sortOrder,
        songName: row.songName ?? '알 수 없는 곡',
        keys: parsed.keys,
        tempos: parsed.tempos,
        sectionOrder: parsed.sectionOrder,
        presetId: parsed.presetId,
        presetName: row.presetName ?? null,
        youtubeReference: row.youtubeReference ?? null,
        youtubeTitle: row.youtubeTitle ?? null,
        hasSheetMusicSelection: parsed.sheetMusicFileIds !== null && parsed.sheetMusicFileIds.length > 0,
      });
      byContiId.set(row.contiSong.contiId, summaries);
    }
    return contiRows.map((conti) => {
      const songSummaries = byContiId.get(conti.id) ?? [];
      return { ...conti, songSummaries, songCount: songSummaries.length };
    });
  },

  async getConti(id: string): Promise<ContiWithSongs | null> {
    const conti = await db.select().from(contis).where(eq(contis.id, id)).limit(1);
    if (conti.length === 0) return null;
    const rows = await db.select({
      contiSong: contiSongs,
      song: songs,
      preset: {
        id: songPresets.id,
        name: songPresets.name,
        youtubeReference: songPresets.youtubeReference,
        youtubeTitle: songPresets.youtubeTitle,
      },
    }).from(contiSongs)
      .leftJoin(songs, eq(contiSongs.songId, songs.id))
      .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
      .where(eq(contiSongs.contiId, id))
      .orderBy(contiSongs.sortOrder);
    return {
      ...conti[0],
      songs: rows.map((row) => ({
        ...row.contiSong,
        song: row.song!,
        overrides: parseContiSongOverrides({
          keys: row.contiSong.keys,
          tempos: row.contiSong.tempos,
          sectionOrder: row.contiSong.sectionOrder,
          lyrics: row.contiSong.lyrics,
          sectionLyricsMap: row.contiSong.sectionLyricsMap,
          notes: row.contiSong.notes,
          sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
          presetId: row.contiSong.presetId,
        }),
        appliedPreset: row.preset?.id ? row.preset : null,
      })),
    };
  },

  async getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
    const conti = await this.getConti(id);
    if (!conti) return null;
    const presetIds = Array.from(new Set(conti.songs.map((contiSong) => contiSong.overrides.presetId).filter((value): value is string => Boolean(value))));
    const presetRows = presetIds.length > 0
      ? await db.select({ id: songPresets.id, pdfMetadata: songPresets.pdfMetadata }).from(songPresets).where(inArray(songPresets.id, presetIds))
      : [];
    const presetPdfMetadataById = new Map(presetRows.map((row) => [row.id, parsePresetPdfMetadata<PresetPdfMetadata>(row.pdfMetadata)]));
    const songsWithSheetMusic = await Promise.all(conti.songs.map(async (contiSong) => {
      const selectedIds = contiSong.overrides.sheetMusicFileIds;
      let sheetMusic;
      if (selectedIds && selectedIds.length > 0) {
        sheetMusic = await db.select().from(sheetMusicFiles).where(inArray(sheetMusicFiles.id, selectedIds));
        const idOrder = new Map(selectedIds.map((smId, index) => [smId, index]));
        sheetMusic.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      } else {
        sheetMusic = await db.select().from(sheetMusicFiles).where(eq(sheetMusicFiles.songId, contiSong.songId)).orderBy(sheetMusicFiles.sortOrder);
      }
      return {
        ...contiSong,
        sheetMusic,
        presetPdfMetadata: contiSong.overrides.presetId ? presetPdfMetadataById.get(contiSong.overrides.presetId) ?? null : null,
      };
    }));
    return { ...conti, songs: songsWithSheetMusic };
  },

  async getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
    const result = await db.select().from(contiPdfExports).where(eq(contiPdfExports.contiId, contiId)).limit(1);
    return result[0] ?? null;
  },
};
```

- [ ] **Step 3: Create Turso read repository**

Create `lib/repositories/storyboard/turso-repository.ts` by copying the full `neonStoryboardRepository` object and applying these exact provider changes:

```text
db                              -> tursoDb
@/lib/db/schema                 -> @/lib/db/turso-schema
ilike(songs.name, `%${query}%`) -> sql`lower(${songs.name}) like lower(${`%${query}%`})`
Date-returning rows             -> map createdAt/updatedAt through dbTextToDate
Date write values               -> map through dateToDbText before insert/update
```

Use SQLite search in `searchSongs`:

```ts
import { sql, eq, desc, inArray } from 'drizzle-orm';

// inside searchSongs(query)
return tursoDb
  .select()
  .from(songs)
  .where(sql`lower(${songs.name}) like lower(${`%${query}%`})`)
  .orderBy(desc(songs.createdAt));
```

Every method exported by `neonStoryboardRepository` in Step 2 must exist in `tursoStoryboardRepository`. Every returned row with `createdAt` or `updatedAt` must be mapped through `dbTextToDate` so existing components keep receiving `Date` values.

- [ ] **Step 4: Replace query modules with repository calls**

Modify `lib/queries/songs.ts` to:

```ts
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getSongs() {
  return getStoryboardRepository().getSongs();
}

export async function getSong(id: string) {
  return getStoryboardRepository().getSong(id);
}

export async function getSongPresets(songId: string) {
  return getStoryboardRepository().getSongPresets(songId);
}

export async function searchSongs(query: string) {
  return getStoryboardRepository().searchSongs(query);
}

export async function getSongPresetsWithSheetMusic(songId: string) {
  return getStoryboardRepository().getSongPresetsWithSheetMusic(songId);
}
```

Modify `lib/queries/contis.ts` to export the existing function names by delegating to `getStoryboardRepository()`.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected:

```text
No lint errors in repository selector or query modules
```

- [ ] **Step 6: Commit read repository boundary**

Run:

```bash
git add lib/repositories/storyboard/index.ts lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts lib/queries/songs.ts lib/queries/contis.ts
git commit -m "feat: add storyboard read repository"
```

## Task 7: Write Repository Methods And Action Wiring

**Files:**
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`
- Modify: `lib/actions/songs.ts`
- Modify: `lib/actions/contis.ts`
- Modify: `lib/actions/sheet-music.ts`
- Modify: `lib/actions/song-presets.ts`
- Modify: `lib/actions/conti-songs.ts`
- Modify: `lib/actions/conti-pdf-exports.ts`
- Modify: `lib/actions/song-page-images.ts`

- [ ] **Step 1: Add write method signatures to both repositories**

Add methods matching current action needs:

```ts
createSong(name: string): Promise<Song>
updateSong(id: string, data: { name: string }): Promise<Song>
deleteSong(id: string): Promise<{ blockedByConti: boolean }>
createConti(data: { title: string | null; date: string; description: string | null }): Promise<Conti>
updateConti(id: string, data: { title: string | null; date: string; description: string | null }): Promise<Conti>
deleteConti(id: string): Promise<void>
createSheetMusicFile(data: Omit<SheetMusicFile, 'sortOrder'>): Promise<SheetMusicFile>
deleteSheetMusicFile(fileId: string): Promise<SheetMusicFile | null>
reorderSheetMusic(songId: string, orderedIds: string[]): Promise<void>
```

Add the remaining write methods required by the current action files:

```ts
addSongToConti(contiId: string, songId: string): Promise<void>
removeContiSong(contiSongId: string): Promise<void>
updateContiSong(contiSongId: string, data: Record<string, unknown>): Promise<void>
reorderContiSongs(contiId: string, orderedIds: string[]): Promise<void>
createSongPreset(songId: string, data: Record<string, unknown>): Promise<SongPreset>
updateSongPreset(presetId: string, data: Record<string, unknown>): Promise<SongPreset>
deleteSongPreset(presetId: string): Promise<{ songId: string | null }>
setDefaultSongPreset(songId: string, presetId: string): Promise<void>
replacePresetSheetMusic(presetId: string, sheetMusicFileIds: string[]): Promise<void>
upsertContiPdfExport(contiId: string, data: Record<string, unknown>): Promise<ContiPdfExport>
deleteContiPdfExport(exportId: string): Promise<ContiPdfExport | null>
createSongPageImage(data: Omit<SongPageImage, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date }): Promise<SongPageImage>
deletePageImagesForConti(contiId: string): Promise<SongPageImage[]>
getPageImagesForSong(songId: string): Promise<SongPageImage[]>
```

After adding those methods, all direct `db` imports in `lib/actions/*` should be removable except migration-only modules.

- [ ] **Step 2: Wire `lib/actions/songs.ts`**

Replace direct `db` usage with:

```ts
const repository = getStoryboardRepository();
const song = await repository.createSong(validation.data.name);
```

For delete:

```ts
const result = await repository.deleteSong(id);
if (result.blockedByConti) {
  return { success: false, error: '이 곡은 콘티에서 사용 중이므로 삭제할 수 없습니다' };
}
```

- [ ] **Step 3: Wire `lib/actions/contis.ts`**

Replace direct `db` usage with:

```ts
const conti = await getStoryboardRepository().createConti({
  title: validation.data.title,
  date: validation.data.date,
  description: validation.data.description || null,
});
```

Use the same repository for update and delete.

- [ ] **Step 4: Wire file metadata actions while keeping Vercel Blob**

In `lib/actions/sheet-music.ts`, keep:

```ts
const blob = await put(file.name, file, { access: 'public' });
```

Replace metadata insertion with repository calls:

```ts
const sheetMusicFile = await getStoryboardRepository().createSheetMusicFile({
  id: generateId(),
  songId,
  fileUrl: blob.url,
  fileName: file.name,
  fileType: file.type,
  createdAt: new Date(),
});
```

Apply the same pattern to `conti-pdf-exports.ts` and `song-page-images.ts`.

- [ ] **Step 5: Confirm no action imports `@/lib/db`**

Run:

```bash
rg -n "from ['\\\"]@/lib/db|import \\{ db \\}" lib/actions
```

Expected:

```text
No matches in lib/actions
```

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected:

```text
No lint errors in lib/actions or lib/repositories
```

- [ ] **Step 7: Commit write repository wiring**

Run:

```bash
git add lib/repositories/storyboard lib/actions
git commit -m "feat: route app writes through storyboard repository"
```

## Task 8: Turso Schema Push And Data Verification

**Files:**
- Modify: `package.json`
- Create: `drizzle.turso.config.ts`

- [ ] **Step 1: Add Turso Drizzle config**

Create `drizzle.turso.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/turso-schema.ts',
  out: './drizzle/turso',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

- [ ] **Step 2: Add Turso migration scripts**

Add to `package.json` scripts:

```json
{
  "db:turso:generate": "drizzle-kit generate --config drizzle.turso.config.ts",
  "db:turso:push": "drizzle-kit push --config drizzle.turso.config.ts"
}
```

- [ ] **Step 3: Generate Turso migration**

Run:

```bash
pnpm db:turso:generate
```

Expected:

```text
drizzle/turso contains a generated migration for the Turso schema
```

- [ ] **Step 4: Push schema to Turso**

Run after Turso env vars are present:

```bash
pnpm db:turso:push
```

Expected:

```text
Changes applied
```

- [ ] **Step 5: Export Neon snapshot**

Run:

```bash
pnpm db:export:neon
```

Expected:

```text
tmp/storyboard-migration/neon-snapshot.json exists
```

- [ ] **Step 6: Import snapshot into Turso**

Run:

```bash
pnpm db:import:turso
```

Expected:

```text
Imported tmp/storyboard-migration/neon-snapshot.json into Turso
```

- [ ] **Step 7: Verify Turso data**

Run:

```bash
pnpm db:verify:turso
```

Expected:

```json
{
  "ok": true,
  "errors": []
}
```

- [ ] **Step 8: Commit Turso migration config**

Run:

```bash
git add drizzle.turso.config.ts drizzle/turso package.json pnpm-lock.yaml
git commit -m "feat: add turso migration config"
```

## Task 9: Cutover Switch And Final Verification

**Files:**
- Modify: `.env.example`
- Modify: provider env vars in Vercel project through dashboard or CLI

- [ ] **Step 1: Run app tests against Neon provider**

Run:

```bash
DATABASE_PROVIDER=neon pnpm test
```

Expected:

```text
All existing tests pass
```

- [ ] **Step 2: Run app tests against Turso provider**

Run:

```bash
DATABASE_PROVIDER=turso pnpm test
```

Expected:

```text
All existing tests pass
```

- [ ] **Step 3: Run lint and build**

Run:

```bash
pnpm lint
pnpm build
```

Expected:

```text
Lint passes
Build exits with code 0
```

- [ ] **Step 4: Set preview env to Turso**

In Vercel project settings, set:

```text
DATABASE_PROVIDER=turso
TURSO_DATABASE_URL=<created Turso database URL>
TURSO_AUTH_TOKEN=<created Turso auth token>
```

Keep `POSTGRES_URL` present during the observation window for verification scripts.

- [ ] **Step 5: Smoke test preview deployment**

Verify in the browser:

```text
/contis loads
/songs loads
song detail loads
conti detail loads
create a test song succeeds
delete the test song succeeds
```

- [ ] **Step 6: Set production env to Turso after preview passes**

In Vercel project settings, set the same Turso env vars for production:

```text
DATABASE_PROVIDER=turso
TURSO_DATABASE_URL=<created Turso database URL>
TURSO_AUTH_TOKEN=<created Turso auth token>
```

- [ ] **Step 7: Commit cutover notes**

If any env or manual setup notes were created, commit them:

```bash
git add docs/superpowers/plans/2026-05-28-turso-phase1-migration.md
git commit -m "docs: record turso cutover plan"
```

## Task 10: Neon Observation And Fadeout

**Files:**
- Modify: `.env.example`
- Modify: `package.json`
- Modify: repository and migration files after observation passes

- [ ] **Step 1: Observe production for one normal usage window**

Check:

```text
Turso dashboard shows app reads/writes
Neon compute no longer wakes due to app page usage
Vercel function logs show no Turso auth errors
Core pages and mutations work
```

- [ ] **Step 2: Run final Neon-vs-Turso verification**

Run:

```bash
pnpm db:verify:turso
```

Expected:

```json
{
  "ok": true,
  "errors": []
}
```

- [ ] **Step 3: Remove permanent Neon app path**

After observation passes, remove `NeonStoryboardRepository` from the runtime selector so `DATABASE_PROVIDER=neon` is no longer a production mode. Keep migration scripts only if a rollback window is still open.

- [ ] **Step 4: Remove Neon dependency after rollback window closes**

Run:

```bash
pnpm remove @neondatabase/serverless
```

Only do this after no runtime code imports `@/lib/db` or `@neondatabase/serverless`.

- [ ] **Step 5: Confirm no runtime Neon imports remain**

Run:

```bash
rg -n "@neondatabase/serverless|drizzle-orm/neon-http|POSTGRES_URL|@/lib/db" app components lib --glob '!lib/repositories/storyboard/neon-snapshot.ts'
```

Expected:

```text
Only migration-retained files match, or no matches after migration files are removed
```

- [ ] **Step 6: Commit Neon fadeout**

Run:

```bash
git add package.json pnpm-lock.yaml .env.example lib app components
git commit -m "chore: fade out neon runtime path"
```

## Final Verification

Run:

```bash
pnpm test
pnpm lint
pnpm build
pnpm db:verify:turso
```

Expected:

```text
Tests pass
Lint passes
Build passes
Turso verification reports ok=true and errors=[]
```

## Handoff Notes

- Provider signup requires the user for authentication, payment, one-time codes, and account-level consent.
- The agent can create databases, buckets, tokens, env vars, and migration resources after the user is logged in and the action is visible in the provider dashboard.
- Do not print Turso auth tokens, Cloudflare secret keys, or Vercel env var secret values into chat or committed files.
- The R2 bucket created during provider setup is intentionally unused by Phase 1 runtime code.
