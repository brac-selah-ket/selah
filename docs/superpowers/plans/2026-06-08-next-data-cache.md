# Next 데이터 캐시 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴 이동 시 반복 데이터 조회를 줄이고, 앱 내부 수정 직후에는 최신 데이터가 바로 보이도록 Next 서버 데이터 캐시와 태그 무효화를 도입한다.

**Architecture:** 캐시는 repository provider 위의 `lib/queries/*` 계층에 적용한다. `lib/cache/tags.ts`가 태그 문자열의 단일 출처가 되고, `lib/cache/invalidation.ts`가 Server Action과 Route Handler에서 쓸 무효화 helper를 제공한다. Neon/Turso repository는 원본 데이터 read/write 책임만 유지한다.

**Tech Stack:** Next.js 16 Cache Components, `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag`, React Server Components, Server Actions, Drizzle repository boundary, Node test source guards.

---

## 병렬 실행 전략

공통 인프라가 먼저 필요하므로 Task 1은 선행 작업이다. Task 1이 끝난 뒤 Task 2, Task 3, Task 4는 write set이 분리되어 병렬 worker로 진행할 수 있다.

- Task 2 write set: `songs` query/action/test 파일.
- Task 3 write set: `contis` query/action/repository/test 파일.
- Task 4 write set: `worship-prep`, Discord route/test 파일.

병렬 worker는 서로의 변경을 되돌리지 않는다. 충돌이 생기면 공통 helper의 현재 API에 맞춰 자기 슬라이스를 조정한다.

## 파일 구조

- Create: `lib/cache/tags.ts`
  - cache tag 문자열과 날짜 변환 helper를 제공한다.
- Create: `lib/cache/invalidation.ts`
  - Server Action용 `updateTag` helper와 Route Handler용 `revalidateTag(..., { expire: 0 })` helper를 제공한다.
- Modify: `next.config.ts`
  - `cacheComponents: true`를 활성화한다.
- Modify: `app/(authenticated)/layout.tsx`
  - 인증 라우트 전체의 `force-dynamic`을 제거한다.
- Modify: `lib/queries/songs.ts`
  - 곡/프리셋 query에 `use cache`, `cacheLife`, `cacheTag`를 적용한다.
- Modify: `lib/queries/contis.ts`
  - 콘티 list/detail/date/export query에 캐시를 적용한다.
- Modify: `lib/queries/worship-prep.ts`
  - Google Sheets query에 60초 cache profile과 tag를 적용한다.
- Modify: `lib/actions/*.ts`
  - mutation 성공 후 관련 invalidation helper를 호출한다.
- Modify: `app/api/cron/discord/parse-comments/route.ts`, `app/api/discord/interactions/route.ts`
  - Route Handler에서 Google Sheets 수정 후 cache tag를 즉시 만료한다.
- Modify: `lib/repositories/storyboard/types.ts`, `neon-repository.ts`, `turso-repository.ts`
  - `contiSongId`만 받는 action이 `contiId`를 알 수 있도록 `getContiSong()` read method를 추가한다.
- Create: `tests/cache-infrastructure-source.test.mjs`
- Create: `tests/cache-songs-source.test.mjs`
- Create: `tests/cache-contis-source.test.mjs`
- Create: `tests/cache-worship-prep-source.test.mjs`

---

### Task 1: 공통 캐시 인프라

**Files:**
- Create: `tests/cache-infrastructure-source.test.mjs`
- Create: `lib/cache/tags.ts`
- Create: `lib/cache/invalidation.ts`
- Modify: `next.config.ts`
- Modify: `app/(authenticated)/layout.tsx`

- [ ] **Step 1: 실패하는 source guard test 작성**

Create `tests/cache-infrastructure-source.test.mjs`:

```js
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('next config enables cache components', async () => {
  const source = await read('next.config.ts');
  assert.match(source, /cacheComponents:\s*true/);
});

test('authenticated layout does not force every page dynamic', async () => {
  const source = await read('app/(authenticated)/layout.tsx');
  assert.doesNotMatch(source, /dynamic\s*=\s*["']force-dynamic["']/);
});

test('cache tag helpers define stable storyboard tags', async () => {
  const source = await read('lib/cache/tags.ts');
  for (const expected of [
    'songs',
    'song:',
    'song-presets:',
    'contis',
    'conti:',
    'conti-by-date:',
    'worship-prep:',
    'worship-prep-list',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('invalidation helpers use immediate action and route invalidation APIs', async () => {
  const source = await read('lib/cache/invalidation.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /\bupdateTag\b/);
  assert.match(source, /\brevalidateTag\b/);
  assert.match(source, /expire:\s*0/);
  assert.match(source, /invalidateSong/);
  assert.match(source, /invalidateConti/);
  assert.match(source, /invalidateWorshipPrepDate/);
});
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs
```

Expected: FAIL. `lib/cache/tags.ts` 또는 `cacheComponents: true`가 없다는 assertion 실패가 나와야 한다.

- [ ] **Step 3: `next.config.ts`에 Cache Components 활성화**

Modify `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
```

- [ ] **Step 4: 인증 layout의 전역 dynamic 제거**

Modify `app/(authenticated)/layout.tsx` by deleting this line:

```ts
export const dynamic = "force-dynamic"
```

Leave the rest of the layout unchanged.

- [ ] **Step 5: cache tag helper 작성**

Create `lib/cache/tags.ts`:

```ts
export const cacheTags = {
  songs: () => 'songs',
  song: (songId: string) => `song:${songId}`,
  songPresets: (songId: string) => `song-presets:${songId}`,
  contis: () => 'contis',
  conti: (contiId: string) => `conti:${contiId}`,
  contiByDate: (date: string) => `conti-by-date:${date}`,
  worshipPrep: (date: string) => `worship-prep:${date}`,
  worshipPrepList: () => 'worship-prep-list',
};

export function toIsoDateFromYYMMDD(value: string): string {
  if (!/^\d{6}$/.test(value)) {
    return value;
  }

  return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}
```

- [ ] **Step 6: invalidation helper 작성**

Create `lib/cache/invalidation.ts`:

```ts
import { revalidateTag, updateTag } from 'next/cache';
import { cacheTags, toIsoDateFromYYMMDD } from '@/lib/cache/tags';

function unique(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean)));
}

export function updateCacheTags(...tags: string[]) {
  for (const tag of unique(tags)) {
    updateTag(tag);
  }
}

export function expireCacheTags(...tags: string[]) {
  for (const tag of unique(tags)) {
    revalidateTag(tag, { expire: 0 });
  }
}

export function invalidateSongs() {
  updateCacheTags(cacheTags.songs());
}

export function invalidateSong(songId: string) {
  updateCacheTags(cacheTags.songs(), cacheTags.song(songId), cacheTags.contis());
}

export function invalidateSongDetail(songId: string) {
  updateCacheTags(cacheTags.song(songId));
}

export function invalidateSongPresets(songId: string) {
  updateCacheTags(cacheTags.song(songId), cacheTags.songPresets(songId), cacheTags.contis());
}

export function invalidateContis() {
  updateCacheTags(cacheTags.contis());
}

export function invalidateConti(contiId: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.conti(contiId));
}

export function invalidateContiDate(date: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.contiByDate(date));
}

export function invalidateContiWithDate(contiId: string, date: string) {
  updateCacheTags(cacheTags.contis(), cacheTags.conti(contiId), cacheTags.contiByDate(date));
}

export function invalidateWorshipPrepDate(date: string) {
  updateCacheTags(cacheTags.worshipPrep(date), cacheTags.worshipPrepList());
}

export function invalidateWorshipPrepSundayDate(sundayDate: string) {
  invalidateWorshipPrepDate(toIsoDateFromYYMMDD(sundayDate));
}

export function expireWorshipPrepDate(date: string) {
  expireCacheTags(cacheTags.worshipPrep(date), cacheTags.worshipPrepList());
}

export function expireWorshipPrepSundayDate(sundayDate: string) {
  expireWorshipPrepDate(toIsoDateFromYYMMDD(sundayDate));
}
```

- [ ] **Step 7: infrastructure test 통과 확인**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs
```

Expected: PASS.

- [ ] **Step 8: commit**

```bash
git add tests/cache-infrastructure-source.test.mjs lib/cache/tags.ts lib/cache/invalidation.ts next.config.ts 'app/(authenticated)/layout.tsx'
git commit -m "feat: add next cache infrastructure"
```

---

### Task 2: 곡과 프리셋 캐시

**Files:**
- Create: `tests/cache-songs-source.test.mjs`
- Modify: `lib/queries/songs.ts`
- Modify: `lib/actions/songs.ts`
- Modify: `lib/actions/sheet-music.ts`
- Modify: `lib/actions/song-presets.ts`

- [ ] **Step 1: 실패하는 source guard test 작성**

Create `tests/cache-songs-source.test.mjs`:

```js
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('song queries use cache components tags and lifetimes', async () => {
  const source = await read('lib/queries/songs.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /cacheLife\(['"]hours['"]\)/);
  assert.match(source, /cacheTag\(cacheTags\.songs\(\)\)/);
  assert.match(source, /cacheTag\(cacheTags\.song\(id\)\)/);
  assert.match(source, /cacheTag\(cacheTags\.songPresets\(songId\)\)/);
});

test('song mutations invalidate song cache tags after successful writes', async () => {
  const songsAction = await read('lib/actions/songs.ts');
  assert.match(songsAction, /invalidateSongs/);
  assert.match(songsAction, /invalidateSong\(id\)/);

  const sheetMusicAction = await read('lib/actions/sheet-music.ts');
  assert.match(sheetMusicAction, /invalidateSongDetail\(songId\)/);
  assert.match(sheetMusicAction, /invalidateSongDetail\(file\.songId\)/);

  const presetAction = await read('lib/actions/song-presets.ts');
  assert.match(presetAction, /invalidateSongPresets\(songId\)/);
  assert.match(presetAction, /invalidateSongPresets\(updatedPreset\.songId\)/);
  assert.match(presetAction, /invalidateSongPresets\(existing\.songId\)/);
});
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/cache-songs-source.test.mjs
```

Expected: FAIL because song query/actions do not import cache helpers yet.

- [ ] **Step 3: `lib/queries/songs.ts`에 캐시 적용**

Replace `lib/queries/songs.ts` with:

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache/tags';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getSongs() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songs());

  return getStoryboardRepository().getSongs();
}

export async function getSong(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.song(id));

  return getStoryboardRepository().getSong(id);
}

export async function getSongPresets(songId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songPresets(songId));

  return getStoryboardRepository().getSongPresets(songId);
}

export async function searchSongs(query: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songs());

  return getStoryboardRepository().searchSongs(query);
}

export async function getSongPresetsWithSheetMusic(songId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.song(songId), cacheTags.songPresets(songId));

  return getStoryboardRepository().getSongPresetsWithSheetMusic(songId);
}
```

- [ ] **Step 4: song actions에 invalidation 추가**

Modify `lib/actions/songs.ts`:

```ts
import { invalidateSong, invalidateSongs } from '@/lib/cache/invalidation';
```

After create succeeds:

```ts
const song = await getStoryboardRepository().createSong(validation.data.name);
invalidateSongs();
revalidatePath('/songs');
```

After update succeeds:

```ts
const result = await getStoryboardRepository().updateSong(id, { name: validation.data.name });
invalidateSong(id);
revalidatePath('/songs');
```

After delete succeeds:

```ts
invalidateSong(id);
revalidatePath('/songs');
```

- [ ] **Step 5: sheet music actions에 invalidation 추가**

Modify `lib/actions/sheet-music.ts`:

```ts
import { invalidateSongDetail } from '@/lib/cache/invalidation';
```

After upload creates DB row:

```ts
const sheetMusicFile = await getStoryboardRepository().createSheetMusicFile({
  songId,
  fileUrl: object.url,
  fileName: file.name,
  fileType: file.type,
});
invalidateSongDetail(songId);
revalidatePath('/songs');
```

After delete:

```ts
await repository.deleteSheetMusicFile(fileId);
invalidateSongDetail(file.songId);
revalidatePath('/songs');
```

After reorder:

```ts
await getStoryboardRepository().reorderSheetMusic(songId, orderedIds);
invalidateSongDetail(songId);
revalidatePath('/songs');
```

- [ ] **Step 6: song preset actions에 invalidation 추가**

Modify `lib/actions/song-presets.ts`:

```ts
import { invalidateSongPresets } from '@/lib/cache/invalidation';
```

After create:

```ts
const preset = await getStoryboardRepository().createSongPreset(songId, d, resolvedYoutube);
invalidateSongPresets(songId);
revalidatePath(`/songs/${songId}`);
```

After update:

```ts
invalidateSongPresets(updatedPreset.songId);
revalidatePath(`/songs/${updatedPreset.songId}`);
```

After delete:

```ts
invalidateSongPresets(existing.songId);
revalidatePath(`/songs/${existing.songId}`);
```

After set default:

```ts
await getStoryboardRepository().setDefaultPreset(songId, presetId);
invalidateSongPresets(songId);
revalidatePath(`/songs/${songId}`);
```

- [ ] **Step 7: song cache tests 통과 확인**

Run:

```bash
pnpm test tests/cache-songs-source.test.mjs
```

Expected: PASS.

- [ ] **Step 8: 관련 기존 source tests 실행**

Run:

```bash
pnpm test tests/song-preset-refresh-source.test.mjs tests/sheet-music-preview-loading-source.test.mjs
```

Expected: PASS.

- [ ] **Step 9: commit**

```bash
git add tests/cache-songs-source.test.mjs lib/queries/songs.ts lib/actions/songs.ts lib/actions/sheet-music.ts lib/actions/song-presets.ts
git commit -m "feat: cache song queries"
```

---

### Task 3: 콘티 캐시와 콘티 곡 식별자 보강

**Files:**
- Create: `tests/cache-contis-source.test.mjs`
- Modify: `lib/queries/contis.ts`
- Modify: `lib/actions/contis.ts`
- Modify: `lib/actions/conti-songs.ts`
- Modify: `lib/actions/conti-pdf-exports.ts`
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`

- [ ] **Step 1: 실패하는 source guard test 작성**

Create `tests/cache-contis-source.test.mjs`:

```js
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('conti queries use cache tags and lifetimes', async () => {
  const source = await read('lib/queries/contis.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /cacheLife\(['"]hours['"]\)/);
  assert.match(source, /cacheTag\(cacheTags\.contis\(\)\)/);
  assert.match(source, /cacheTag\(cacheTags\.conti\(id\)\)/);
  assert.match(source, /cacheTag\(cacheTags\.contiByDate\(date\)\)/);
});

test('repository exposes conti song lookup for exact invalidation', async () => {
  const types = await read('lib/repositories/storyboard/types.ts');
  assert.match(types, /getContiSong\(contiSongId: string\): Promise<ContiSong \| null>/);

  const neon = await read('lib/repositories/storyboard/neon-repository.ts');
  assert.match(neon, /async getContiSong\(contiSongId: string\)/);

  const turso = await read('lib/repositories/storyboard/turso-repository.ts');
  assert.match(turso, /async getContiSong\(contiSongId: string\)/);
});

test('conti mutations invalidate conti cache tags after successful writes', async () => {
  const contisAction = await read('lib/actions/contis.ts');
  assert.match(contisAction, /invalidateContiWithDate\(conti\.id, conti\.date\)/);
  assert.match(contisAction, /existing\?\.date/);
  assert.match(contisAction, /invalidateContiDate\(existing\.date\)/);

  const contiSongsAction = await read('lib/actions/conti-songs.ts');
  assert.match(contiSongsAction, /getContiSong\(contiSongId\)/);
  assert.match(contiSongsAction, /invalidateConti\(source\.contiId\)/);
  assert.match(contiSongsAction, /invalidateSong\(songId\)/);

  const pdfAction = await read('lib/actions/conti-pdf-exports.ts');
  assert.match(pdfAction, /invalidateConti\(contiId\)/);
  assert.match(pdfAction, /invalidateConti\(existing\.contiId\)/);
});
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/cache-contis-source.test.mjs
```

Expected: FAIL because conti cache helpers and `getContiSong()` do not exist yet.

- [ ] **Step 3: `lib/queries/contis.ts`에 캐시 적용**

Replace `lib/queries/contis.ts` with:

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache/tags';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getContis() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis());

  return getStoryboardRepository().getContis();
}

export async function getContisWithSongSummaries() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis());

  return getStoryboardRepository().getContisWithSongSummaries();
}

export async function getContiByDate(date: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contiByDate(date));

  return getStoryboardRepository().getContiByDate(date);
}

export async function getConti(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.conti(id));

  return getStoryboardRepository().getConti(id);
}

export async function getContiForExport(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.conti(id));

  return getStoryboardRepository().getContiForExport(id);
}

export async function getContiPdfExport(contiId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.conti(contiId));

  return getStoryboardRepository().getContiPdfExport(contiId);
}
```

- [ ] **Step 4: repository interface에 `getContiSong()` 추가**

Modify `lib/repositories/storyboard/types.ts` in `StoryboardRepository` read section:

```ts
getContiSong(contiSongId: string): Promise<ContiSong | null>;
```

- [ ] **Step 5: Neon repository에 `getContiSong()` 구현**

Add to `neonStoryboardRepository` near other conti reads:

```ts
async getContiSong(contiSongId: string) {
  const result = await db
    .select()
    .from(contiSongs)
    .where(eq(contiSongs.id, contiSongId))
    .limit(1);

  return result[0] ?? null;
},
```

- [ ] **Step 6: Turso repository에 `getContiSong()` 구현**

Add to `tursoStoryboardRepository` near other conti reads:

```ts
async getContiSong(contiSongId: string) {
  const tursoDb = getTursoDb();
  const result = await tursoDb
    .select()
    .from(contiSongs)
    .where(eq(contiSongs.id, contiSongId))
    .limit(1);

  return result[0] ? mapContiSong(result[0]) : null;
},
```

- [ ] **Step 7: conti actions에 날짜 기반 invalidation 추가**

Modify `lib/actions/contis.ts`:

```ts
import { invalidateContiDate, invalidateContiWithDate } from '@/lib/cache/invalidation';
```

After create:

```ts
const conti = await getStoryboardRepository().createConti({
  title: validation.data.title,
  date: validation.data.date,
  description: validation.data.description || null,
});
invalidateContiWithDate(conti.id, conti.date);
revalidatePath('/contis');
```

For update, fetch old value before writing:

```ts
const repository = getStoryboardRepository();
const existing = await repository.getConti(id);
const result = await repository.updateConti(id, {
  title: validation.data.title,
  date: validation.data.date,
  description: validation.data.description || null,
});
if (result) {
  invalidateContiWithDate(result.id, result.date);
  if (existing?.date && existing.date !== result.date) {
    invalidateContiDate(existing.date);
  }
}
revalidatePath('/contis');
```

For delete, fetch old value before deleting:

```ts
const repository = getStoryboardRepository();
const existing = await repository.getConti(id);
await repository.deleteConti(id);
if (existing) {
  invalidateContiWithDate(existing.id, existing.date);
}
revalidatePath('/contis');
```

- [ ] **Step 8: conti song actions에 exact invalidation 추가**

Modify `lib/actions/conti-songs.ts`:

```ts
import { invalidateConti, invalidateSong, invalidateSongs } from '@/lib/cache/invalidation';
```

After add:

```ts
const contiSong = await getStoryboardRepository().addSongToConti(contiId, songId, initialOverrides);
invalidateConti(contiId);
revalidatePath('/contis');
```

Before remove/update, read source:

```ts
const repository = getStoryboardRepository();
const source = await repository.getContiSong(contiSongId);
await repository.removeContiSong(contiSongId);
if (source) {
  invalidateConti(source.contiId);
}
```

```ts
const repository = getStoryboardRepository();
const source = await repository.getContiSong(contiSongId);
await repository.updateContiSong(contiSongId, data);
if (source) {
  invalidateConti(source.contiId);
}
```

After reorder:

```ts
await getStoryboardRepository().reorderContiSongs(contiId, orderedIds);
invalidateConti(contiId);
revalidatePath('/contis');
```

After batch import:

```ts
const result = await getStoryboardRepository().batchImportSongsToConti(contiId, validatedItems);
invalidateConti(contiId);
invalidateSongs();
for (const songId of new Set(validatedItems.map((item) => item.songId).filter((value): value is string => Boolean(value)))) {
  invalidateSong(songId);
}
revalidatePath('/contis');
revalidatePath('/songs');
```

- [ ] **Step 9: PDF export actions에 conti invalidation 추가**

Modify `lib/actions/conti-pdf-exports.ts`:

```ts
import { invalidateConti } from '@/lib/cache/invalidation';
```

After layout save:

```ts
const pdfExport = await getStoryboardRepository().upsertContiPdfExport(contiId, {
  layoutState,
});
invalidateConti(contiId);
```

After PDF export:

```ts
await repository.upsertContiPdfExport(contiId, { pdfUrl: object.url });
invalidateConti(contiId);
revalidatePath('/contis');
```

After delete:

```ts
await repository.deleteContiPdfExport(exportId);
invalidateConti(existing.contiId);
revalidatePath('/contis');
```

- [ ] **Step 10: conti cache tests 통과 확인**

Run:

```bash
pnpm test tests/cache-contis-source.test.mjs
```

Expected: PASS.

- [ ] **Step 11: repository/provider tests 실행**

Run:

```bash
node --experimental-strip-types --test lib/actions/provider-boundary.test.ts lib/repositories/storyboard/verify.test.ts
```

Expected: PASS.

- [ ] **Step 12: commit**

```bash
git add tests/cache-contis-source.test.mjs lib/queries/contis.ts lib/actions/contis.ts lib/actions/conti-songs.ts lib/actions/conti-pdf-exports.ts lib/repositories/storyboard/types.ts lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts
git commit -m "feat: cache conti queries"
```

---

### Task 4: 예배 준비와 Discord/Sheets 캐시

**Files:**
- Create: `tests/cache-worship-prep-source.test.mjs`
- Modify: `lib/queries/worship-prep.ts`
- Modify: `lib/actions/worship-prep.ts`
- Modify: `app/api/cron/discord/parse-comments/route.ts`
- Modify: `app/api/discord/interactions/route.ts`
- Modify: `app/(authenticated)/worship-prep/page.tsx`
- Modify: `app/(authenticated)/worship-prep/[date]/page.tsx`

- [ ] **Step 1: 실패하는 source guard test 작성**

Create `tests/cache-worship-prep-source.test.mjs`:

```js
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('worship prep queries use short cache lifetime and date tags', async () => {
  const source = await read('lib/queries/worship-prep.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /cacheLife\(\{\s*stale:\s*60,\s*revalidate:\s*60,\s*expire:\s*300,\s*\}\)/s);
  assert.match(source, /cacheTag\(cacheTags\.worshipPrep\(isoDate\)\)/);
  assert.match(source, /cacheTag\(cacheTags\.worshipPrepList\(\)\)/);
});

test('worship prep server action invalidates updated sheet rows', async () => {
  const source = await read('lib/actions/worship-prep.ts');
  assert.match(source, /invalidateWorshipPrepSundayDate\(activeThread\.sundayDate\)/);
  assert.match(source, /invalidateWorshipPrepSundayDate\(yymmdd\)/);
});

test('discord route handlers expire worship prep tags after sheet updates', async () => {
  const cron = await read('app/api/cron/discord/parse-comments/route.ts');
  assert.match(cron, /expireWorshipPrepSundayDate\(activeThread\.sundayDate\)/);

  const interactions = await read('app/api/discord/interactions/route.ts');
  assert.match(interactions, /expireWorshipPrepSundayDate\(sundayDate\)/);
});

test('worship prep pages do not force dynamic rendering after query-level cache', async () => {
  const indexPage = await read('app/(authenticated)/worship-prep/page.tsx');
  const detailPage = await read('app/(authenticated)/worship-prep/[date]/page.tsx');
  assert.doesNotMatch(indexPage, /dynamic\s*=\s*['"]force-dynamic['"]/);
  assert.doesNotMatch(detailPage, /dynamic\s*=\s*['"]force-dynamic['"]/);
});
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/cache-worship-prep-source.test.mjs
```

Expected: FAIL because worship prep query and route handlers do not use cache helpers yet.

- [ ] **Step 3: `lib/queries/worship-prep.ts`에 짧은 캐시 적용**

Modify imports:

```ts
import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache/tags';
```

Add this helper:

```ts
function cacheWorshipPrepForExternalSheetChanges() {
  cacheLife({
    stale: 60,
    revalidate: 60,
    expire: 300,
  });
}
```

Update list query:

```ts
export async function getWorshipPrepList(weeks = 8): Promise<WorshipPrepSummary[]> {
  'use cache';
  cacheWorshipPrepForExternalSheetChanges();
  cacheTag(cacheTags.worshipPrepList());

  const rows = await readRecentWorshipData(weeks);
  return rows.map((row) => ({
    ...row,
    status: toStatus(row),
  }));
}
```

Update detail query:

```ts
export async function getWorshipPrepDetail(isoDate: string): Promise<WorshipPrepSummary | null> {
  'use cache';
  cacheWorshipPrepForExternalSheetChanges();
  cacheTag(cacheTags.worshipPrep(isoDate));

  const row = await readWorshipDataByDate(isoDate);
  if (!row) {
    return null;
  }

  return {
    ...row,
    status: toStatus(row),
  };
}
```

- [ ] **Step 4: worship-prep Server Action에 invalidation 추가**

Modify `lib/actions/worship-prep.ts`:

```ts
import { invalidateWorshipPrepSundayDate } from '@/lib/cache/invalidation';
```

After weekly thread creation succeeds:

```ts
await setActiveThread(thread.id, yymmdd);
invalidateWorshipPrepSundayDate(yymmdd);
revalidatePath('/worship-prep');
```

After parser updates Google Sheets:

```ts
await updateWorshipData(SHEET_NAME, targetRow, mergedData);
invalidateWorshipPrepSundayDate(activeThread.sundayDate);
await safelyCheckWorshipPrepReadyNotification({ sundayDate: activeThread.sundayDate });
```

- [ ] **Step 5: cron parse route에 route invalidation 추가**

Modify `app/api/cron/discord/parse-comments/route.ts`:

```ts
import { expireWorshipPrepSundayDate } from '@/lib/cache/invalidation';
```

After `updateWorshipData`:

```ts
await updateWorshipData(SHEET_NAME, targetRow, mergedData);
expireWorshipPrepSundayDate(activeThread.sundayDate);
await safelyCheckWorshipPrepReadyNotification({ sundayDate: activeThread.sundayDate, origin: new URL(request.url).origin });
```

- [ ] **Step 6: Discord interaction route에 route invalidation 추가**

Modify `app/api/discord/interactions/route.ts`:

```ts
import { expireWorshipPrepSundayDate } from '@/lib/cache/invalidation';
```

After role selection sheet update:

```ts
await updateRoleSelectionInSheet(customId, selectedValue, sundayDate);
expireWorshipPrepSundayDate(sundayDate);
```

- [ ] **Step 7: worship-prep page dynamic flag 제거**

Delete these lines where present:

```ts
export const dynamic = 'force-dynamic';
```

Files:

- `app/(authenticated)/worship-prep/page.tsx`
- `app/(authenticated)/worship-prep/[date]/page.tsx`

- [ ] **Step 8: worship prep cache tests 통과 확인**

Run:

```bash
pnpm test tests/cache-worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 9: 관련 기존 worship tests 실행**

Run:

```bash
pnpm test tests/worship-prep-source.test.mjs tests/worship-prep-loading-source.test.mjs tests/worship-prep-default-date.test.ts
```

Expected: PASS.

- [ ] **Step 10: commit**

```bash
git add tests/cache-worship-prep-source.test.mjs lib/queries/worship-prep.ts lib/actions/worship-prep.ts app/api/cron/discord/parse-comments/route.ts app/api/discord/interactions/route.ts 'app/(authenticated)/worship-prep/page.tsx' 'app/(authenticated)/worship-prep/[date]/page.tsx'
git commit -m "feat: cache worship prep queries"
```

---

### Task 5: 통합 검증과 캐시 컴포넌트 빌드 확인

**Files:**
- Modify only if verification exposes compile or cache directive issues.

- [ ] **Step 1: 모든 신규 source guard test 실행**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs tests/cache-songs-source.test.mjs tests/cache-contis-source.test.mjs tests/cache-worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 2: 전체 test 실행**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: lint 실행**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: production build 실행**

Run:

```bash
pnpm build
```

Expected: PASS. If Cache Components reports an uncached runtime data error, keep repository/query caching intact and fix the specific route by either moving cached data behind a cached function or preserving a narrowly scoped dynamic boundary. Do not restore `force-dynamic` on the entire authenticated layout.

- [ ] **Step 5: 최종 diff 검토**

Run:

```bash
git diff --stat HEAD
git diff --check
```

Expected: no whitespace errors. Diff should be limited to cache helpers, query/action invalidation, route invalidation, tests, and any minimal build fixes.

- [ ] **Step 6: verification result 정리**

Run:

```bash
git status --short
```

Expected: no uncommitted files. If `pnpm build` exposes a Cache Components compile issue, stop Task 5 and report the exact error to the controller instead of making an unplanned broad fix.

---

## 자체 리뷰 체크리스트

- Spec coverage: 캐시 계층, 태그 정책, 즉시 반영, Google Sheets 60초 TTL, 전역 `force-dynamic` 제거, repository provider 경계 유지가 모두 Task 1-5에 매핑되어 있다.
- Placeholder scan: 이 계획에는 미정 항목이나 대체 경로 없는 추상 지시를 두지 않는다.
- Type consistency: `cacheTags.songPresets(songId)`, `invalidateSongPresets(songId)`, `expireWorshipPrepSundayDate(sundayDate)`, `getContiSong(contiSongId)` 이름을 모든 task에서 동일하게 사용한다.
- Parallel safety: Task 2, Task 3, Task 4는 Task 1 이후 서로 다른 파일을 수정한다. 병렬 worker는 공통 helper API를 변경하지 않는다.
- Verification: source guard, 기존 관련 tests, `pnpm test`, `pnpm lint`, `pnpm build`가 포함되어 있다.
