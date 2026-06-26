# 매시업 콘티 프리셋 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 곡 매시업 프리셋을 하나의 공유 프리셋/PDF 레이아웃으로 만들고, 찬양 라이브러리·콘티·YouTube import·PDF/PPT export에서 하나의 찬양 순서처럼 다룬다.

**Architecture:** `song_presets`는 프리셋 본문을 담는 기준 엔티티로 유지하고, `song_preset_songs` 조인 테이블로 프리셋과 곡의 ordered membership을 표현한다. 콘티에서는 `conti_songs` 두 행을 `mashup_group_id`로 묶고, 표시/export 계층에는 raw row 배열과 별개인 `ArrangementItem` view model을 도입한다. PDF/PPT는 기본적으로 매시업 item을 하나의 순서로 보고, PPT는 UI 옵션으로 raw row 분리 export를 지원한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Neon Postgres, Turso/libSQL, Vitest, shadcn/ui v3 with Base UI, @hugeicons/react.

---

## Baseline

- 현재 worktree: `/Users/user/.codex/worktrees/ddc4/storyboard`
- 현재 상태: linked worktree, detached HEAD, clean.
- `pnpm lint`: exit 0, 기존 warning 26개.
- `pnpm test`: exit 1. 기존 Python PPTX 테스트 5개가 `ModuleNotFoundError: No module named 'lxml'` 또는 `No module named 'pptx'`로 실패한다. `requirements.txt`에는 `python-pptx==1.0.2`, `lxml==6.0.2`가 있으므로 구현 완료 검증 전 Python env를 맞춘 뒤 전체 test를 다시 돌린다.

## File Structure

- Modify `lib/db/schema.ts`: Postgres schema에 `song_preset_songs`, `song_presets.preset_type`, `song_presets.display_title`, `conti_songs.mashup_*` 컬럼 추가.
- Modify `lib/db/turso-schema.ts`: Turso schema에 같은 table/columns 추가.
- Add generated migrations under `drizzle/` and `drizzle/turso/`, then manually add backfill `INSERT INTO song_preset_songs ... SELECT ... FROM song_presets`.
- Modify `lib/types.ts`: preset type, preset members, mashup conti fields, arrangement item, PPT option 타입 추가.
- Modify `lib/repositories/storyboard/types.ts`: snapshot 타입과 repository method 계약 확장.
- Modify `lib/repositories/storyboard/neon-repository.ts` and `lib/repositories/storyboard/turso-repository.ts`: membership 조회, 매시업 프리셋 생성/검색, 콘티 연결/분리, export 조회 구현.
- Modify `lib/repositories/storyboard/neon-snapshot.ts`, `lib/repositories/storyboard/turso-snapshot.ts`, `lib/repositories/storyboard/turso-import.ts`, `lib/repositories/storyboard/verify.ts`, `lib/repositories/storyboard/verify.test.ts`: 새 table/columns snapshot parity.
- Modify `lib/db/insert-helpers.ts`: single preset 생성 시 membership row도 같이 생성.
- Add `lib/utils/arrangement-items.ts` and `lib/utils/arrangement-items.test.ts`: raw `conti.songs`를 표시/export item으로 변환.
- Add `lib/utils/mashup-presets.ts` and `lib/utils/mashup-presets.test.ts`: ordered song pair key, 매시업 membership 검증, 제목 fallback helper.
- Modify `lib/utils/preset-overrides.ts`, `lib/utils/song-preset-draft.ts`, `lib/utils/song-preset-draft.test.ts`: shared preset과 `displayTitle` draft roundtrip.
- Modify `lib/actions/song-presets.ts`: 매시업 프리셋 생성/검색 action 추가, 기존 preset invalidation을 모든 member song으로 확장.
- Modify `lib/actions/conti-songs.ts`: 매시업 연결/분리 action 추가.
- Modify `lib/queries/songs.ts`, `lib/queries/contis.ts`: 새 repository method/cache tag 경유.
- Modify `components/shared/arrangement-editor/types.ts` and `components/shared/arrangement-editor/arrangement-editor.tsx`: optional `displayTitle` 편집 필드 추가.
- Modify `components/songs/preset-list.tsx`, `components/songs/preset-editor.tsx`, `app/(authenticated)/songs/[id]/page.tsx`: 매시업 preset badge, 연결 곡 표시, 매시업 생성 dialog.
- Add `components/songs/mashup-preset-dialog.tsx`: 연결 곡 검색/생성, 현재 곡 앞/뒤 선택, 빈 매시업 preset 생성.
- Modify `components/contis/conti-detail.tsx`, `components/contis/conti-song-summary-table.tsx`, `components/contis/conti-song-editor.tsx`: 매시업 row, 연결 버튼, split confirm, editor preset loading.
- Add `components/contis/mashup-connect-dialog.tsx`: 콘티 인접 두 곡의 매시업 preset 선택/생성.
- Modify `components/contis/youtube-import-model.ts`, `components/contis/youtube-import-model.test.ts`, `components/contis/youtube-import-state.ts`, `components/contis/youtube-import-review.tsx`, `components/contis/youtube-import-dialog.tsx`: import review의 인접 item 매시업 연결.
- Modify `lib/utils/pdf-export-helpers.ts` and add/extend tests: `arrangementItemKey` 우선 layout extraction.
- Modify `components/contis/pdf-export/types.ts`, `components/contis/pdf-export/hooks/use-editor-pages.ts`, `components/contis/pdf-export/hooks/use-auto-save.ts`, `components/contis/pdf-export/hooks/use-pdf-export.ts`, `components/contis/pdf-export/pdf-editor.tsx`: display item 기반 PDF pages.
- Modify `lib/utils/pptx-helpers.ts`, `lib/utils/pptx-helpers.test.mjs`, `lib/actions/pptx-export.ts`, `components/contis/pptx-export-button.tsx`: PPT default merged export와 split option.

---

### Task 1: Schema, Types, And Snapshot Contract

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/turso-schema.ts`
- Modify: `lib/types.ts`
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/repositories/storyboard/verify.test.ts`
- Modify: `lib/repositories/storyboard/verify.ts`
- Modify: `lib/repositories/storyboard/neon-snapshot.ts`
- Modify: `lib/repositories/storyboard/turso-snapshot.ts`
- Modify: `lib/repositories/storyboard/turso-import.ts`
- Create: generated migrations under `drizzle/` and `drizzle/turso/`

- [ ] **Step 1: Write failing snapshot verification tests**

Append these tests to `lib/repositories/storyboard/verify.test.ts`:

```ts
it('fails when songPresetSongs reference a missing preset or song', async () => {
  const base = snapshot({
    songPresetSongs: [
      {
        id: 'preset-song-1',
        presetId: 'missing-preset',
        songId: 'missing-song',
        sortOrder: 0,
        partLabel: null,
      },
    ],
  });

  const result = await verifyStoryboardSnapshots(snapshot(), base);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /songPresetSongs preset-song-1 references missing song preset missing-preset/);
  assert.match(result.errors.join('\n'), /songPresetSongs preset-song-1 references missing song missing-song/);
});

it('fails when contiSongs preMashupPresetId references a missing preset', async () => {
  const turso = snapshot({
    contiSongs: [
      {
        ...snapshot().contiSongs[0],
        mashupGroupId: 'group-1',
        mashupPartOrder: 0,
        preMashupPresetId: 'missing-preset',
      },
    ],
  });

  const result = await verifyStoryboardSnapshots(snapshot(), turso);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /contiSongs conti-song-1 references missing pre-mashup song preset missing-preset/);
});
```

Update the `snapshot()` fixture in the same file so `songPresets[0]` and `contiSongs[0]` include the new columns and the snapshot includes a `songPresetSongs` collection:

```ts
songPresets: [
  {
    id: 'preset-1',
    songId: 'song-1',
    presetType: 'single',
    displayTitle: null,
    name: 'Default',
    keys: '["C"]',
    tempos: '[120]',
    sectionOrder: '["verse"]',
    lyrics: '["lyrics"]',
    sectionLyricsMap: '{"0":[0]}',
    notes: null,
    youtubeReference: null,
    youtubeTitle: null,
    pdfMetadata: null,
    isDefault: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  },
],
songPresetSongs: [
  {
    id: 'preset-song-1',
    presetId: 'preset-1',
    songId: 'song-1',
    sortOrder: 0,
    partLabel: null,
  },
],
contiSongs: [
  {
    id: 'conti-song-1',
    contiId: 'conti-1',
    songId: 'song-1',
    sortOrder: 0,
    keys: '["C"]',
    tempos: '[120]',
    sectionOrder: '["verse"]',
    lyrics: '["lyrics"]',
    sectionLyricsMap: '{"0":[0]}',
    notes: null,
    sheetMusicFileIds: '["sheet-1"]',
    presetId: 'preset-1',
    mashupGroupId: null,
    mashupPartOrder: null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
  },
],
```

- [ ] **Step 2: Run the verification tests to confirm red**

Run:

```bash
pnpm vitest run lib/repositories/storyboard/verify.test.ts
```

Expected: FAIL with TypeScript/runtime errors because `songPresetSongs`, `presetType`, `displayTitle`, and conti mashup fields do not exist in snapshot types or verification collections.

- [ ] **Step 3: Add schema columns and table**

In `lib/db/schema.ts`, update imports if needed and add:

```ts
export const songPresets = pgTable('song_presets', {
  id: text('id').primaryKey(),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  presetType: text('preset_type').notNull().default('single'),
  displayTitle: text('display_title'),
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
  isDefault: boolean('is_default').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const songPresetSongs = pgTable('song_preset_songs', {
  id: text('id').primaryKey(),
  presetId: text('preset_id').notNull().references(() => songPresets.id, { onDelete: 'cascade' }),
  songId: text('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  partLabel: text('part_label'),
}, (table) => [
  uniqueIndex('song_preset_songs_unique').on(table.presetId, table.songId),
  uniqueIndex('song_preset_songs_order_unique').on(table.presetId, table.sortOrder),
  index('song_preset_songs_song_idx').on(table.songId),
]);
```

In the `contiSongs` table in `lib/db/schema.ts`, add these fields after `presetId`:

```ts
  mashupGroupId: text('mashup_group_id'),
  mashupPartOrder: integer('mashup_part_order'),
  preMashupPresetId: text('pre_mashup_preset_id').references(() => songPresets.id, { onDelete: 'set null' }),
```

Mirror the same shape in `lib/db/turso-schema.ts` with `sqliteTable`, `text`, and `integer`.

- [ ] **Step 4: Extend app and snapshot types**

In `lib/types.ts`, add:

```ts
export type SongPresetType = 'single' | 'mashup';

export interface SongPresetMember {
  id: string;
  presetId: string;
  songId: string;
  sortOrder: number;
  partLabel: string | null;
  songName?: string;
}

export interface SongPresetData {
  name: string;
  displayTitle?: string | null;
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
  isDefault: boolean;
  youtubeReference?: string | null;
  youtubeTitle?: string | null;
  sheetMusicFileIds?: string[];
  pdfMetadata?: PresetPdfMetadata | null;
}

export interface SongPresetWithSheetMusic extends SongPreset {
  sheetMusicFileIds: string[];
  members: SongPresetMember[];
}

export interface ArrangementItem {
  key: string;
  type: 'single' | 'mashup';
  displayTitle: string;
  displaySongNames: string[];
  songs: ContiSongWithSong[];
  primarySong: ContiSongWithSong;
  presetId: string | null;
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  tempos: number[];
  keys: string[];
}
```

Keep the existing `SongPresetData` fields and add only `displayTitle`; do not remove compatibility fields.

In `lib/repositories/storyboard/types.ts`, import `songPresetSongs` in type lists and add:

```ts
export interface SnapshotSongPresetSong {
  id: string;
  presetId: string;
  songId: string;
  sortOrder: number;
  partLabel: string | null;
}
```

Then add `songPresetSongs: SnapshotSongPresetSong[]` to `StoryboardSnapshot`, and add the new columns to `SnapshotSongPreset` and `SnapshotContiSong`.

- [ ] **Step 5: Update snapshot verification implementation**

In `lib/repositories/storyboard/verify.ts`, include `songPresetSongs` in `snapshotCollections` immediately after `songPresets`.

In `verifyTursoRelationships`, add:

```ts
for (const presetSong of turso.songPresetSongs) {
  verifyReference(
    errors,
    'songPresetSongs',
    presetSong.id,
    'song preset',
    presetSong.presetId,
    songPresetIds,
  );
  verifyReference(errors, 'songPresetSongs', presetSong.id, 'song', presetSong.songId, songIds);
}
```

Inside the existing `for (const contiSong of turso.contiSongs)` block, add:

```ts
if (contiSong.preMashupPresetId !== null) {
  verifyReference(
    errors,
    'contiSongs',
    contiSong.id,
    'pre-mashup song preset',
    contiSong.preMashupPresetId,
    songPresetIds,
  );
}
```

- [ ] **Step 6: Update snapshots/import/export**

In `lib/repositories/storyboard/neon-snapshot.ts` and `lib/repositories/storyboard/turso-snapshot.ts`, import and select `songPresetSongs` ordered by `id`, and return the collection in `StoryboardSnapshot`.

In `lib/repositories/storyboard/turso-import.ts`, delete/insert `songPresetSongs` after `songPresets` and before `presetSheetMusic`.

- [ ] **Step 7: Generate and adjust migrations**

Run:

```bash
pnpm db:turso:generate
npx drizzle-kit generate
```

Expected: new migration files under both `drizzle/turso/` and `drizzle/`.

Edit both generated migration SQL files to include a backfill after `song_preset_songs` is created:

```sql
INSERT INTO song_preset_songs (id, preset_id, song_id, sort_order, part_label)
SELECT id || ':song:0', id, song_id, 0, NULL
FROM song_presets;
```

Keep Drizzle-generated journal/snapshot files intact except for necessary SQL backfill.

- [ ] **Step 8: Run the verification tests to confirm green**

Run:

```bash
pnpm vitest run lib/repositories/storyboard/verify.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add lib/db/schema.ts lib/db/turso-schema.ts lib/types.ts lib/repositories/storyboard/types.ts lib/repositories/storyboard/verify.ts lib/repositories/storyboard/verify.test.ts lib/repositories/storyboard/neon-snapshot.ts lib/repositories/storyboard/turso-snapshot.ts lib/repositories/storyboard/turso-import.ts drizzle
git commit -m "feat: add mashup preset schema"
```

---

### Task 2: Pure Mashup And Arrangement Helpers

**Files:**
- Create: `lib/utils/mashup-presets.test.ts`
- Create: `lib/utils/mashup-presets.ts`
- Create: `lib/utils/arrangement-items.test.ts`
- Create: `lib/utils/arrangement-items.ts`

- [ ] **Step 1: Write failing tests for ordered preset membership helpers**

Create `lib/utils/mashup-presets.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  assertOrderedMashupPair,
  getMashupDisplayTitle,
  getOrderedSongPairKey,
} from "./mashup-presets.ts";

test("ordered song pair keys preserve front and back song order", () => {
  assert.equal(getOrderedSongPairKey(["song-a", "song-b"]), "song-a→song-b");
  assert.equal(getOrderedSongPairKey(["song-b", "song-a"]), "song-b→song-a");
});

test("assertOrderedMashupPair rejects non-two-song membership", () => {
  assert.throws(() => assertOrderedMashupPair(["song-a"]), /정확히 두 곡/);
  assert.throws(() => assertOrderedMashupPair(["song-a", "song-b", "song-c"]), /정확히 두 곡/);
  assert.doesNotThrow(() => assertOrderedMashupPair(["song-a", "song-b"]));
});

test("mashup display title prefers custom title and falls back to the first song", () => {
  assert.equal(getMashupDisplayTitle("  A+B  ", ["A", "B"]), "A+B");
  assert.equal(getMashupDisplayTitle(null, ["A", "B"]), "A");
  assert.equal(getMashupDisplayTitle(" ", ["A", "B"]), "A");
});
```

- [ ] **Step 2: Run helper tests to confirm red**

Run:

```bash
pnpm vitest run lib/utils/mashup-presets.test.ts
```

Expected: FAIL because `lib/utils/mashup-presets.ts` does not exist.

- [ ] **Step 3: Implement mashup helper functions**

Create `lib/utils/mashup-presets.ts`:

```ts
export function assertOrderedMashupPair(songIds: readonly string[]) {
  if (songIds.length !== 2) {
    throw new Error("매시업 프리셋은 정확히 두 곡이 필요합니다");
  }
}

export function getOrderedSongPairKey(songIds: readonly [string, string] | readonly string[]): string {
  assertOrderedMashupPair(songIds);
  return `${songIds[0]}→${songIds[1]}`;
}

export function getMashupDisplayTitle(
  displayTitle: string | null | undefined,
  songNames: readonly string[],
): string {
  const trimmed = displayTitle?.trim();
  return trimmed || songNames[0] || "매시업";
}
```

- [ ] **Step 4: Run helper tests to confirm green**

Run:

```bash
pnpm vitest run lib/utils/mashup-presets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing tests for arrangement item grouping**

Create `lib/utils/arrangement-items.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { buildArrangementItems } from "./arrangement-items.ts";
import type { ContiSongWithSong } from "@/lib/types.ts";

function contiSong(
  id: string,
  songId: string,
  name: string,
  sortOrder: number,
  overrides: Partial<ContiSongWithSong["overrides"]> = {},
  mashup?: { groupId: string; partOrder: number; presetName?: string; displayTitle?: string | null },
): ContiSongWithSong {
  const now = new Date("2026-06-19T00:00:00Z");
  return {
    id,
    contiId: "conti-1",
    songId,
    sortOrder,
    keys: null,
    tempos: null,
    sectionOrder: null,
    lyrics: null,
    sectionLyricsMap: null,
    notes: null,
    sheetMusicFileIds: null,
    presetId: overrides.presetId ?? null,
    mashupGroupId: mashup?.groupId ?? null,
    mashupPartOrder: mashup?.partOrder ?? null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
    song: { id: songId, name, createdAt: now, updatedAt: now },
    overrides: {
      keys: overrides.keys ?? [],
      tempos: overrides.tempos ?? [],
      sectionOrder: overrides.sectionOrder ?? [],
      lyrics: overrides.lyrics ?? [],
      sectionLyricsMap: overrides.sectionLyricsMap ?? {},
      notes: overrides.notes ?? null,
      sheetMusicFileIds: overrides.sheetMusicFileIds ?? null,
      presetId: overrides.presetId ?? null,
    },
    appliedPreset: mashup
      ? {
          id: overrides.presetId ?? "preset-mashup",
          name: mashup.presetName ?? "Mashup",
          displayTitle: mashup.displayTitle ?? null,
          presetType: "mashup",
          youtubeReference: null,
          youtubeTitle: null,
        }
      : null,
  };
}

test("groups two adjacent mashup rows into one arrangement item", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0, displayTitle: "A / B" }),
    contiSong("cs-2", "song-b", "B", 1, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 1, displayTitle: "A / B" }),
    contiSong("cs-3", "song-c", "C", 2),
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0].key, "mashup:group-1");
  assert.equal(items[0].type, "mashup");
  assert.equal(items[0].displayTitle, "A / B");
  assert.deepEqual(items[0].displaySongNames, ["A", "B"]);
  assert.equal(items[0].primarySong.id, "cs-1");
  assert.equal(items[1].key, "conti-song:cs-3");
});

test("falls back to raw rows when a mashup group is incomplete", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0 }),
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].key, "conti-song:cs-1");
  assert.equal(items[0].type, "single");
});
```

- [ ] **Step 6: Run arrangement item tests to confirm red**

Run:

```bash
pnpm vitest run lib/utils/arrangement-items.test.ts
```

Expected: FAIL because `lib/utils/arrangement-items.ts` does not exist.

- [ ] **Step 7: Implement arrangement item grouping**

Create `lib/utils/arrangement-items.ts`:

```ts
import type { ArrangementItem, ContiSongWithSong } from "@/lib/types";
import { getMashupDisplayTitle } from "@/lib/utils/mashup-presets";

function buildSingleItem(song: ContiSongWithSong): ArrangementItem {
  return {
    key: `conti-song:${song.id}`,
    type: "single",
    displayTitle: song.song.name,
    displaySongNames: [song.song.name],
    songs: [song],
    primarySong: song,
    presetId: song.overrides.presetId,
    sectionOrder: song.overrides.sectionOrder,
    lyrics: song.overrides.lyrics,
    sectionLyricsMap: song.overrides.sectionLyricsMap,
    tempos: song.overrides.tempos,
    keys: song.overrides.keys,
  };
}

export function buildArrangementItems(songs: readonly ContiSongWithSong[]): ArrangementItem[] {
  const ordered = [...songs].sort((left, right) => left.sortOrder - right.sortOrder);
  const byGroup = new Map<string, ContiSongWithSong[]>();
  for (const song of ordered) {
    if (!song.mashupGroupId) continue;
    const group = byGroup.get(song.mashupGroupId) ?? [];
    group.push(song);
    byGroup.set(song.mashupGroupId, group);
  }

  const consumed = new Set<string>();
  const items: ArrangementItem[] = [];

  for (const song of ordered) {
    if (consumed.has(song.id)) continue;

    if (song.mashupGroupId) {
      const group = (byGroup.get(song.mashupGroupId) ?? [])
        .slice()
        .sort((left, right) => (left.mashupPartOrder ?? 0) - (right.mashupPartOrder ?? 0));
      const isValidTwoPartGroup = group.length === 2 && group.every((entry) => entry.overrides.presetId === song.overrides.presetId);

      if (isValidTwoPartGroup) {
        for (const member of group) consumed.add(member.id);
        const primary = group[0];
        const displayTitle = getMashupDisplayTitle(
          primary.appliedPreset && "displayTitle" in primary.appliedPreset
            ? primary.appliedPreset.displayTitle
            : null,
          group.map((entry) => entry.song.name),
        );
        items.push({
          key: `mashup:${song.mashupGroupId}`,
          type: "mashup",
          displayTitle,
          displaySongNames: group.map((entry) => entry.song.name),
          songs: group,
          primarySong: primary,
          presetId: primary.overrides.presetId,
          sectionOrder: primary.overrides.sectionOrder,
          lyrics: primary.overrides.lyrics,
          sectionLyricsMap: primary.overrides.sectionLyricsMap,
          tempos: primary.overrides.tempos,
          keys: primary.overrides.keys,
        });
        continue;
      }
    }

    consumed.add(song.id);
    items.push(buildSingleItem(song));
  }

  return items;
}
```

- [ ] **Step 8: Run both helper tests**

Run:

```bash
pnpm vitest run lib/utils/mashup-presets.test.ts lib/utils/arrangement-items.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add lib/utils/mashup-presets.ts lib/utils/mashup-presets.test.ts lib/utils/arrangement-items.ts lib/utils/arrangement-items.test.ts
git commit -m "feat: add mashup arrangement helpers"
```

---

### Task 3: Repository Membership Reads And Preset Writes

**Files:**
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/db/insert-helpers.ts`
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`
- Modify: `lib/utils/preset-overrides.ts`
- Modify: `lib/utils/preset-overrides.test.ts`

- [ ] **Step 1: Write failing test for preset override compatibility**

Append to `lib/utils/preset-overrides.test.ts`:

```ts
test("copies display-only mashup preset data without changing conti override shape", () => {
  const overrides = songPresetToContiOverrides(
    {
      ...preset,
      presetType: "mashup",
      displayTitle: "A / B",
    },
    ["sheet-1"],
  );

  assert.deepEqual(Object.keys(overrides).sort(), [
    "keys",
    "lyrics",
    "notes",
    "presetId",
    "sectionLyricsMap",
    "sectionOrder",
    "sheetMusicFileIds",
    "tempos",
  ].sort());
  assert.equal(overrides.presetId, "preset-1");
});
```

- [ ] **Step 2: Run test to confirm red or type failure**

Run:

```bash
pnpm vitest run lib/utils/preset-overrides.test.ts
```

Expected: FAIL until `SongPreset` type includes `presetType` and `displayTitle`.

- [ ] **Step 3: Extend repository method contract**

In `lib/repositories/storyboard/types.ts`, add:

```ts
export interface CreateMashupPresetInput {
  songIds: [string, string];
  data: SongPresetData;
}

export interface ApplyMashupToContiInput {
  contiId: string;
  firstContiSongId: string;
  secondContiSongId: string;
  presetId: string;
}

export interface SplitMashupInput {
  contiId: string;
  mashupGroupId: string;
  mode: 'restore' | 'clear';
}
```

Add these methods to `StoryboardRepository`:

```ts
getPresetMembers(presetId: string): Promise<SongPresetMember[]>;
findMashupPresetBySongs(songIds: [string, string]): Promise<SongPresetWithSheetMusic | null>;
createMashupPreset(input: CreateMashupPresetInput, resolvedYoutube: ResolvedYouTubeMetadata | null): Promise<SongPreset>;
applyMashupToContiSongs(input: ApplyMashupToContiInput): Promise<{ mashupGroupId: string }>;
splitMashup(input: SplitMashupInput): Promise<void>;
```

- [ ] **Step 4: Update single preset inserts to create membership rows**

In `lib/db/insert-helpers.ts`, import `songPresetSongs` and after inserting a single preset add:

```ts
await tx.insert(songPresetSongs).values({
  id: `${preset.id}:song:0`,
  presetId: preset.id,
  songId,
  sortOrder: 0,
  partLabel: null,
});
```

Mirror this behavior in `insertTursoSongPreset` in `lib/repositories/storyboard/turso-repository.ts`.

- [ ] **Step 5: Implement membership reads in both repositories**

In both repository files, add a local helper:

```ts
async function getPresetMemberRows(presetId: string): Promise<SongPresetMember[]> {
  const rows = await db
    .select({
      id: songPresetSongs.id,
      presetId: songPresetSongs.presetId,
      songId: songPresetSongs.songId,
      sortOrder: songPresetSongs.sortOrder,
      partLabel: songPresetSongs.partLabel,
      songName: songs.name,
    })
    .from(songPresetSongs)
    .leftJoin(songs, eq(songPresetSongs.songId, songs.id))
    .where(eq(songPresetSongs.presetId, presetId))
    .orderBy(songPresetSongs.sortOrder);

  return rows.map((row) => ({
    id: row.id,
    presetId: row.presetId,
    songId: row.songId,
    sortOrder: row.sortOrder,
    partLabel: row.partLabel,
    songName: row.songName ?? undefined,
  }));
}
```

For Turso, use `tursoDb` and map the same row shape.

Use this helper in `getSongPresetsWithSheetMusic` and `getSongPresetWithSheetMusic`, returning `members`.

- [ ] **Step 6: Query presets by membership instead of legacy `song_id`**

Change `getSongPresets(songId)` in both repositories to join `song_preset_songs`:

```ts
const rows = await db
  .select({ preset: songPresets })
  .from(songPresetSongs)
  .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
  .where(eq(songPresetSongs.songId, songId))
  .orderBy(songPresets.sortOrder);

return rows.map((row) => row.preset);
```

For Turso, map `row.preset` through `mapSongPreset`.

- [ ] **Step 7: Implement ordered mashup search**

In both repositories, implement `findMashupPresetBySongs([firstSongId, secondSongId])` by selecting preset ids whose `presetType` is `mashup`, whose member count is exactly two, and whose ordered member song ids match the pair. A straightforward implementation is acceptable for this small service:

```ts
const candidateRows = await db
  .select({ presetId: songPresetSongs.presetId })
  .from(songPresetSongs)
  .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
  .where(eq(songPresets.presetType, "mashup"));

const candidateIds = Array.from(new Set(candidateRows.map((row) => row.presetId)));
for (const presetId of candidateIds) {
  const members = await this.getPresetMembers(presetId);
  const ordered = members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  if (ordered.length === 2 && ordered[0].songId === firstSongId && ordered[1].songId === secondSongId) {
    return this.getSongPresetWithSheetMusic(presetId);
  }
}
return null;
```

- [ ] **Step 8: Implement mashup preset creation**

In both repositories, `createMashupPreset` must:

1. Validate `songIds.length === 2`.
2. Use `songIds[0]` as legacy `songPresets.songId`.
3. Set `presetType: "mashup"`.
4. Set `displayTitle: data.displayTitle?.trim() || null`.
5. Insert two `song_preset_songs` rows with `sortOrder` 0 and 1.
6. Insert `preset_sheet_music` rows exactly like `createSongPreset`.

Use this record shape:

```ts
const presetRecord = {
  id: generateId(),
  songId: songIds[0],
  presetType: "mashup",
  displayTitle: data.displayTitle?.trim() || null,
  name: data.name,
  keys: JSON.stringify(data.keys),
  tempos: JSON.stringify(data.tempos),
  sectionOrder: JSON.stringify(data.sectionOrder),
  lyrics: JSON.stringify(data.lyrics),
  sectionLyricsMap: JSON.stringify(data.sectionLyricsMap),
  notes: data.notes,
  youtubeReference: resolvedYoutube?.videoId ?? null,
  youtubeTitle: resolvedYoutube?.title ?? null,
  pdfMetadata: data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null,
  isDefault: false,
  sortOrder: maxSort + 1,
  createdAt: now,
  updatedAt: now,
};
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm vitest run lib/utils/preset-overrides.test.ts lib/repositories/storyboard/verify.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add lib/repositories/storyboard/types.ts lib/db/insert-helpers.ts lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts lib/utils/preset-overrides.ts lib/utils/preset-overrides.test.ts
git commit -m "feat: support preset song memberships"
```

---

### Task 4: Conti Mashup Apply And Split Server Actions

**Files:**
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`
- Modify: `lib/actions/conti-songs.ts`
- Modify: `lib/cache/invalidation.ts`

- [ ] **Step 1: Add repository implementation for apply**

Implement `applyMashupToContiSongs(input)` in both repositories:

```ts
const pair = await db
  .select()
  .from(contiSongs)
  .where(inArray(contiSongs.id, [input.firstContiSongId, input.secondContiSongId]))
  .orderBy(asc(contiSongs.sortOrder));

if (pair.length !== 2) throw new Error("MASHUP_PAIR_NOT_FOUND");
if (pair[0].contiId !== input.contiId || pair[1].contiId !== input.contiId) throw new Error("MASHUP_PAIR_NOT_FOUND");
if (pair[0].sortOrder + 1 !== pair[1].sortOrder) throw new Error("MASHUP_REQUIRES_ADJACENT_ROWS");
if (pair[0].mashupGroupId || pair[1].mashupGroupId) throw new Error("MASHUP_ALREADY_GROUPED");

const preset = await this.getSongPresetWithSheetMusic(input.presetId);
if (!preset || preset.presetType !== "mashup") throw new Error("MASHUP_PRESET_NOT_FOUND");
const members = preset.members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
if (members.length !== 2 || members[0].songId !== pair[0].songId || members[1].songId !== pair[1].songId) {
  throw new Error("MASHUP_PRESET_SONGS_MISMATCH");
}

const overrides = songPresetToContiOverrides(preset, preset.sheetMusicFileIds);
const serialized = stringifyContiSongOverrides(overrides);
const mashupGroupId = generateId();

await db.update(contiSongs).set({
  ...serialized,
  mashupGroupId,
  mashupPartOrder: 0,
  preMashupPresetId: pair[0].presetId,
  updatedAt: new Date(),
}).where(eq(contiSongs.id, pair[0].id));

await db.update(contiSongs).set({
  ...serialized,
  mashupGroupId,
  mashupPartOrder: 1,
  preMashupPresetId: pair[1].presetId,
  updatedAt: new Date(),
}).where(eq(contiSongs.id, pair[1].id));

return { mashupGroupId };
```

Use `dateToDbText(new Date())` in Turso.

- [ ] **Step 2: Add repository implementation for split**

Implement `splitMashup(input)` in both repositories:

```ts
const rows = await db
  .select()
  .from(contiSongs)
  .where(and(eq(contiSongs.contiId, input.contiId), eq(contiSongs.mashupGroupId, input.mashupGroupId)))
  .orderBy(asc(contiSongs.mashupPartOrder));

if (rows.length !== 2) throw new Error("MASHUP_GROUP_NOT_FOUND");

for (const row of rows) {
  await db.update(contiSongs).set({
    presetId: input.mode === "restore" ? row.preMashupPresetId : null,
    mashupGroupId: null,
    mashupPartOrder: null,
    preMashupPresetId: null,
    updatedAt: new Date(),
  }).where(eq(contiSongs.id, row.id));
}
```

This intentionally does not delete the mashup preset.

- [ ] **Step 3: Add server action schemas**

In `lib/actions/conti-songs.ts`, add:

```ts
const applyMashupSchema = z.object({
  contiId: z.string().min(1),
  firstContiSongId: z.string().min(1),
  secondContiSongId: z.string().min(1),
  presetId: z.string().min(1),
});

const splitMashupSchema = z.object({
  contiId: z.string().min(1),
  mashupGroupId: z.string().min(1),
  mode: z.enum(["restore", "clear"]),
});
```

Add actions:

```ts
export async function applyMashupToContiSongs(input: z.input<typeof applyMashupSchema>): Promise<ActionResult<{ mashupGroupId: string }>> {
  try {
    const validation = applyMashupSchema.safeParse(input);
    if (!validation.success) return { success: false, error: "매시업 연결 정보가 올바르지 않습니다" };
    const result = await getStoryboardRepository().applyMashupToContiSongs(validation.data);
    invalidateConti(validation.data.contiId);
    revalidatePath("/contis");
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MASHUP_REQUIRES_ADJACENT_ROWS") return { success: false, error: "인접한 두 곡만 매시업으로 연결할 수 있습니다" };
    if (message === "MASHUP_ALREADY_GROUPED") return { success: false, error: "이미 매시업으로 연결된 곡입니다" };
    if (message === "MASHUP_PRESET_SONGS_MISMATCH") return { success: false, error: "선택한 매시업 프리셋의 곡 순서가 현재 콘티와 맞지 않습니다" };
    return { success: false, error: "매시업 연결 중 오류가 발생했습니다" };
  }
}

export async function splitMashup(input: z.input<typeof splitMashupSchema>): Promise<ActionResult> {
  try {
    const validation = splitMashupSchema.safeParse(input);
    if (!validation.success) return { success: false, error: "매시업 분리 정보가 올바르지 않습니다" };
    await getStoryboardRepository().splitMashup(validation.data);
    invalidateConti(validation.data.contiId);
    revalidatePath("/contis");
    return { success: true };
  } catch {
    return { success: false, error: "매시업 분리 중 오류가 발생했습니다" };
  }
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm vitest run lib/utils/arrangement-items.test.ts lib/repositories/storyboard/verify.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts lib/actions/conti-songs.ts lib/cache/invalidation.ts
git commit -m "feat: apply and split conti mashups"
```

---

### Task 5: Song Library Mashup Preset Creation

**Files:**
- Modify: `lib/actions/song-presets.ts`
- Modify: `lib/actions/songs.ts`
- Modify: `lib/queries/songs.ts`
- Modify: `app/(authenticated)/songs/[id]/page.tsx`
- Modify: `components/songs/preset-list.tsx`
- Modify: `components/songs/preset-editor.tsx`
- Create: `components/songs/mashup-preset-dialog.tsx`
- Modify: `components/shared/arrangement-editor/types.ts`
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
- Modify: `lib/utils/song-preset-draft.ts`
- Modify: `lib/utils/song-preset-draft.test.ts`

- [ ] **Step 1: Write failing draft roundtrip test for display title**

Append to `lib/utils/song-preset-draft.test.ts`:

```ts
test("display title roundtrips through preset drafts", () => {
  const draft = songPresetToDraft({
    ...preset,
    presetType: "mashup",
    displayTitle: "A / B",
    members: [
      { id: "member-1", presetId: "preset-1", songId: "song-1", sortOrder: 0, partLabel: null, songName: "A" },
      { id: "member-2", presetId: "preset-1", songId: "song-2", sortOrder: 1, partLabel: null, songName: "B" },
    ],
  });

  assert.equal(draft.displayTitle, "A / B");
  assert.equal(arrangementDraftToSongPresetData(draft).displayTitle, "A / B");
});
```

- [ ] **Step 2: Run draft test to confirm red**

Run:

```bash
pnpm vitest run lib/utils/song-preset-draft.test.ts
```

Expected: FAIL because `ArrangementDraft.displayTitle` is missing.

- [ ] **Step 3: Extend arrangement draft and editor**

In `components/shared/arrangement-editor/types.ts`, add:

```ts
displayTitle: string | null;
```

to `ArrangementDraft`.

In `lib/utils/song-preset-draft.ts`, set:

```ts
displayTitle: preset?.displayTitle ?? null,
```

and return:

```ts
displayTitle: draft.displayTitle?.trim() || null,
```

from `arrangementDraftToSongPresetData`.

In `components/shared/arrangement-editor/arrangement-editor.tsx`, add a compact input near the preset name field when `mode === "preset"`:

```tsx
<Field>
  <FieldLabel>표시/PPT 제목</FieldLabel>
  <Input
    value={draft.displayTitle ?? ""}
    onChange={(event) => updateDraft({ displayTitle: event.target.value })}
    placeholder="비워두면 첫 곡 제목 사용"
  />
</Field>
```

Use the local draft update helper already used by the name/key/tempo fields; keep the field visible for all presets, but only export logic consumes it for mashups.

- [ ] **Step 4: Add song preset actions**

In `lib/actions/song-presets.ts`, extend `presetSchema`:

```ts
displayTitle: z.string().nullable().optional().default(null),
```

Add:

```ts
const createMashupPresetSchema = z.object({
  songIds: z.tuple([z.string().min(1), z.string().min(1)]),
  data: presetSchema,
});
```

Add actions:

```ts
export async function findMashupPresetBySongs(firstSongId: string, secondSongId: string): Promise<ActionResult<SongPresetWithSheetMusic | null>> {
  try {
    const preset = await getStoryboardRepository().findMashupPresetBySongs([firstSongId, secondSongId]);
    return { success: true, data: preset };
  } catch {
    return { success: false, error: "매시업 프리셋을 찾을 수 없습니다" };
  }
}

export async function createMashupPreset(songIds: [string, string], data: SongPresetData): Promise<ActionResult<SongPreset>> {
  try {
    const validation = createMashupPresetSchema.safeParse({ songIds, data });
    if (!validation.success) return { success: false, error: validation.error.issues[0].message };
    const d = validation.data.data as SongPresetData;
    const resolvedYoutube = await resolveYouTubeReferenceMetadata(d.youtubeReference, d.youtubeTitle);
    const preset = await getStoryboardRepository().createMashupPreset({ songIds: validation.data.songIds, data: d }, resolvedYoutube);
    for (const songId of validation.data.songIds) {
      invalidateSongPresets(songId);
      revalidatePath(`/songs/${songId}`);
    }
    return { success: true, data: preset };
  } catch {
    return { success: false, error: "매시업 프리셋 생성 중 오류가 발생했습니다" };
  }
}
```

- [ ] **Step 5: Fetch all songs on song detail page**

In `app/(authenticated)/songs/[id]/page.tsx`, change the data load to:

```ts
const [song, allSongs] = await Promise.all([getSong(id), getSongs()]);
```

Pass `allSongs` to `PresetList`.

- [ ] **Step 6: Add `MashupPresetDialog`**

Create `components/songs/mashup-preset-dialog.tsx` with props:

```ts
interface MashupPresetDialogProps {
  currentSongId: string;
  currentSongName: string;
  allSongs: Song[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Behavior:

1. Search `allSongs` by name, excluding `currentSongId`.
2. If no song matches, allow a new song name with existing `createSong` action.
3. Radio/segmented control: `현재 곡이 앞`, `현재 곡이 뒤`.
4. On submit, create missing song if needed, build ordered `[firstSongId, secondSongId]`.
5. Call `findMashupPresetBySongs`; if result exists, toast `이미 같은 순서의 매시업 프리셋이 있습니다` and close.
6. Otherwise call `createMashupPreset` with empty arrangement:

```ts
{
  name: `${firstSongName} + ${secondSongName}`,
  displayTitle: null,
  keys: [],
  tempos: [],
  sectionOrder: [],
  lyrics: [],
  sectionLyricsMap: {},
  notes: null,
  isDefault: false,
  sheetMusicFileIds: [],
  pdfMetadata: null,
}
```

- [ ] **Step 7: Update preset list UI**

In `components/songs/preset-list.tsx`:

1. Add a second button `매시업 프리셋 추가`.
2. Render `MashupPresetDialog`.
3. For presets with `preset.presetType === "mashup"`, show `<Badge variant="secondary">매시업</Badge>`.
4. Show member names as `A → B` using `preset.members`.
5. Hide or disable default preset button for mashup presets.

- [ ] **Step 8: Run focused tests and lint**

Run:

```bash
pnpm vitest run lib/utils/song-preset-draft.test.ts lib/utils/mashup-presets.test.ts
pnpm lint
```

Expected: tests PASS, lint exit 0.

- [ ] **Step 9: Commit Task 5**

```bash
git add lib/actions/song-presets.ts lib/actions/songs.ts lib/queries/songs.ts app/(authenticated)/songs/[id]/page.tsx components/songs/preset-list.tsx components/songs/preset-editor.tsx components/songs/mashup-preset-dialog.tsx components/shared/arrangement-editor/types.ts components/shared/arrangement-editor/arrangement-editor.tsx lib/utils/song-preset-draft.ts lib/utils/song-preset-draft.test.ts
git commit -m "feat: add mashup presets to song library"
```

---

### Task 6: Conti UI Grouping, Connect, And Split

**Files:**
- Modify: `components/contis/conti-detail.tsx`
- Modify: `components/contis/conti-song-summary-table.tsx`
- Modify: `components/contis/conti-song-editor.tsx`
- Create: `components/contis/mashup-connect-dialog.tsx`
- Modify: `lib/actions/conti-songs.ts`

- [ ] **Step 1: Add connect dialog**

Create `components/contis/mashup-connect-dialog.tsx` with props:

```ts
interface MashupConnectDialogProps {
  contiId: string;
  first: ContiSongWithSong;
  second: ContiSongWithSong;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}
```

Behavior:

1. On open, call `findMashupPresetBySongs(first.songId, second.songId)`.
2. If found, show the preset name/member row and primary action `매시업 연결`.
3. If not found, show `빈 매시업 프리셋 생성 후 연결`.
4. On create path, call `createMashupPreset([first.songId, second.songId], emptyData)`.
5. Then call `applyMashupToContiSongs({ contiId, firstContiSongId: first.id, secondContiSongId: second.id, presetId })`.
6. Toast success and call `onApplied`.

- [ ] **Step 2: Build arrangement items in `ContiDetail`**

In `components/contis/conti-detail.tsx`, import `buildArrangementItems` and compute:

```ts
const arrangementItems = buildArrangementItems(optimisticSongs);
```

Track:

```ts
const [connectPair, setConnectPair] = useState<{ first: ContiSongWithSong; second: ContiSongWithSong } | null>(null);
const [splittingGroup, setSplittingGroup] = useState<{ contiId: string; groupId: string } | null>(null);
```

Pass raw songs plus item callbacks to the summary table.

- [ ] **Step 3: Render grouped rows and gap buttons**

In `components/contis/conti-song-summary-table.tsx`, change props to accept:

```ts
arrangementItems?: ArrangementItem[];
onConnectMashup?: (firstIndex: number) => void;
onSplitMashup?: (mashupGroupId: string) => void;
```

When `arrangementItems` is present:

1. Render each item with display index based on item order.
2. Single item row uses existing row style.
3. Mashup item row uses a thicker border and vertical padding.
4. Inside mashup row, show `매시업` badge, `item.displayTitle`, and member names `A → B`.
5. Add a full-width strip button labeled `이어지는 매시업 프리셋`; clicking it calls `onSplitMashup(groupId)`.
6. Between adjacent raw ungrouped songs, render a small icon button with aria-label `매시업 연결`.

- [ ] **Step 4: Add split confirm with two actions**

In `ContiDetail`, add an `AlertDialog` for `splittingGroup`:

```tsx
<AlertDialog open={splittingGroup !== null} onOpenChange={(open) => !open && setSplittingGroup(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>매시업 분리</AlertDialogTitle>
      <AlertDialogDescription>
        두 곡의 콘티 연결만 해제합니다. 매시업 프리셋은 찬양 라이브러리에 그대로 남습니다.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleSplitMashup("clear")}>
        프리셋 없이 분리
      </AlertDialogAction>
      <AlertDialogAction onClick={() => handleSplitMashup("restore")}>
        원래 프리셋 복원
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

`handleSplitMashup(mode)` calls the server action and refreshes.

- [ ] **Step 5: Run focused tests and lint**

Run:

```bash
pnpm vitest run lib/utils/arrangement-items.test.ts
pnpm lint
```

Expected: test PASS, lint exit 0.

- [ ] **Step 6: Commit Task 6**

```bash
git add components/contis/conti-detail.tsx components/contis/conti-song-summary-table.tsx components/contis/conti-song-editor.tsx components/contis/mashup-connect-dialog.tsx lib/actions/conti-songs.ts
git commit -m "feat: add conti mashup grouping UI"
```

---

### Task 7: PDF Export Arrangement Items

**Files:**
- Modify: `lib/utils/pdf-export-helpers.ts`
- Add or modify: `lib/utils/pdf-export-helpers.test.mjs`
- Modify: `components/contis/pdf-export/types.ts`
- Modify: `components/contis/pdf-export/hooks/use-editor-pages.ts`
- Modify: `components/contis/pdf-export/hooks/use-auto-save.ts`
- Modify: `components/contis/pdf-export/hooks/use-pdf-export.ts`
- Modify: `components/contis/pdf-export/pdf-editor.tsx`
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`

- [ ] **Step 1: Add failing helper tests for arrangement item keys**

Append tests to `lib/utils/pdf-export-helpers.test.mjs` or create it using the same transpile pattern as `lib/utils/pptx-helpers.test.mjs`:

```js
test('extracts preset pdf metadata by arrangement item key before song index', async () => {
  const { extractPresetPdfMetadataFromLayout } = await loadPdfExportHelpersModule();

  const result = extractPresetPdfMetadataFromLayout(
    [
      { pageIndex: 0, songIndex: 0, arrangementItemKey: 'conti-song:old', sheetMusicFileId: 'sheet-old', pdfPageIndex: null, overlays: [] },
      { pageIndex: 1, songIndex: 0, arrangementItemKey: 'mashup:group-1', sheetMusicFileId: 'sheet-new', pdfPageIndex: null, overlays: [{ id: 'songNumber', type: 'songNumber', text: '1', x: 1, y: 1, fontSize: 12 }] },
    ],
    0,
    'mashup:group-1',
  );

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].sheetMusicFileId, 'sheet-new');
});
```

- [ ] **Step 2: Run helper test to confirm red**

Run:

```bash
pnpm vitest run lib/utils/pdf-export-helpers.test.mjs
```

Expected: FAIL because `extractPresetPdfMetadataFromLayout` does not accept `arrangementItemKey`.

- [ ] **Step 3: Extend layout types and helper**

In `lib/types.ts`, add to `PageLayout`:

```ts
arrangementItemKey?: string | null;
```

In `components/contis/pdf-export/types.ts`, add to `EditorPage`:

```ts
arrangementItemKey: string;
displayIndex: number;
primaryContiSongId: string;
```

Update `extractPresetPdfMetadataFromLayout` signature:

```ts
export function extractPresetPdfMetadataFromLayout(
  pageLayouts: PageLayout[],
  songIndex: number,
  arrangementItemKey?: string,
): PresetPdfMetadata | null {
  const songLayouts = pageLayouts.filter((layout) => {
    if (arrangementItemKey && layout.arrangementItemKey) {
      return layout.arrangementItemKey === arrangementItemKey && layout.sheetMusicFileId;
    }
    return layout.songIndex === songIndex && layout.sheetMusicFileId;
  });
  // keep existing body
}
```

- [ ] **Step 4: Build editor pages from arrangement items**

In `use-editor-pages.ts`, import `buildArrangementItems` and replace the `for (let songIdx = 0; songIdx < conti.songs.length; songIdx++)` loop with:

```ts
const arrangementItems = buildArrangementItems(conti.songs);
for (let itemIndex = 0; itemIndex < arrangementItems.length; itemIndex++) {
  const item = arrangementItems[itemIndex];
  const contiSong = item.primarySong;
  const sheetMusic = "sheetMusic" in contiSong ? contiSong.sheetMusic : [];
  const songIdx = itemIndex;
  const arrangementItemKey = item.key;
  // existing page creation body, using item.sectionOrder, item.tempos, item.key
}
```

For saved layout lookup, prefer `arrangementItemKey`:

```ts
const saved = savedLayouts?.find(
  (layout) =>
    layout.arrangementItemKey === arrangementItemKey &&
    layout.sheetMusicFileId === file.id &&
    (layout.pdfPageIndex ?? null) === expectedPdfPageIndex,
) ?? legacySongIndexFallback;
```

- [ ] **Step 5: Save arrangement item keys**

In `use-auto-save.ts`, include:

```ts
arrangementItemKey: p.arrangementItemKey,
songIndex: p.displayIndex,
```

when mapping pages to `PageLayout`.

- [ ] **Step 6: Export per primary song**

In `use-pdf-export.ts`, compute `const arrangementItems = buildArrangementItems(conti.songs);`.

Use `arrangementItems[page.songIndex]` or `page.arrangementItemKey` to find the primary conti song for `pageUploads`. The `presetSnapshot` should use `item.sectionOrder`, `item.lyrics`, `item.tempos`, and `item.keys`.

For filename:

```ts
const songNames = arrangementItems.map((item) => item.displayTitle);
```

- [ ] **Step 7: Sync preset metadata once per arrangement item**

In both repositories, update `syncPresetPdfMetadataFromContiLayout` to:

1. Load `getConti(contiId)`.
2. Build arrangement items.
3. For each item with `item.presetId`, call:

```ts
const metadata = extractPresetPdfMetadataFromLayout(layoutState.pages, itemIndex, item.key);
```

4. Update each preset id once using a `Set<string>`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm vitest run lib/utils/pdf-export-helpers.test.mjs lib/utils/arrangement-items.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 7**

```bash
git add lib/types.ts lib/utils/pdf-export-helpers.ts lib/utils/pdf-export-helpers.test.mjs components/contis/pdf-export/types.ts components/contis/pdf-export/hooks/use-editor-pages.ts components/contis/pdf-export/hooks/use-auto-save.ts components/contis/pdf-export/hooks/use-pdf-export.ts components/contis/pdf-export/pdf-editor.tsx lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts
git commit -m "feat: use arrangement items for pdf export"
```

---

### Task 8: PPT Default Merge And Split Option

**Files:**
- Modify: `lib/utils/pptx-helpers.ts`
- Modify: `lib/utils/pptx-helpers.test.mjs`
- Modify: `lib/actions/pptx-export.ts`
- Modify: `components/contis/pptx-export-button.tsx`

- [ ] **Step 1: Add failing PPT helper tests**

Append to `lib/utils/pptx-helpers.test.mjs`:

```js
test('buildPptxSongData merges mashup rows by default and uses display title', async () => {
  const { buildPptxSongData } = await loadPptxHelpersModule();
  const now = new Date('2026-06-19T00:00:00Z');
  const base = {
    contiId: 'conti-1',
    sortOrder: 0,
    keys: null,
    tempos: null,
    sectionOrder: null,
    lyrics: null,
    sectionLyricsMap: null,
    notes: null,
    sheetMusicFileIds: null,
    presetId: 'preset-m',
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
  };
  const songs = [
    {
      ...base,
      id: 'cs-1',
      songId: 'song-a',
      mashupGroupId: 'group-1',
      mashupPartOrder: 0,
      song: { id: 'song-a', name: 'A', createdAt: now, updatedAt: now },
      overrides: { keys: [], tempos: [], sectionOrder: ['Verse', 'Chorus'], lyrics: ['A'], sectionLyricsMap: { 0: [0] }, notes: null, sheetMusicFileIds: null, presetId: 'preset-m' },
      appliedPreset: { id: 'preset-m', name: 'Mashup', presetType: 'mashup', displayTitle: 'A / B', youtubeReference: null, youtubeTitle: null },
    },
    {
      ...base,
      id: 'cs-2',
      songId: 'song-b',
      sortOrder: 1,
      mashupGroupId: 'group-1',
      mashupPartOrder: 1,
      song: { id: 'song-b', name: 'B', createdAt: now, updatedAt: now },
      overrides: { keys: [], tempos: [], sectionOrder: ['Verse', 'Chorus'], lyrics: ['A'], sectionLyricsMap: { 0: [0] }, notes: null, sheetMusicFileIds: null, presetId: 'preset-m' },
      appliedPreset: { id: 'preset-m', name: 'Mashup', presetType: 'mashup', displayTitle: 'A / B', youtubeReference: null, youtubeTitle: null },
    },
  ];

  const result = buildPptxSongData(songs, '찬양');

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'A / B');
  assert.equal(result[0].section_name, '찬양 1');
});
```

- [ ] **Step 2: Run PPT helper test to confirm red**

Run:

```bash
pnpm vitest run lib/utils/pptx-helpers.test.mjs
```

Expected: FAIL because `buildPptxSongData` currently exports raw rows.

- [ ] **Step 3: Update PPT helper API**

In `lib/utils/pptx-helpers.ts`, change signature:

```ts
export function buildPptxSongData(
  songs: ContiSongWithSong[],
  prefix: string,
  options: { separateMashups?: boolean } = {},
): PptxExportSongData[] {
  const sources = options.separateMashups
    ? songs.map((song) => ({
        title: song.song.name,
        sectionOrder: song.overrides.sectionOrder,
        lyrics: song.overrides.lyrics,
        sectionLyricsMap: song.overrides.sectionLyricsMap,
      }))
    : buildArrangementItems(songs).map((item) => ({
        title: item.displayTitle,
        sectionOrder: item.sectionOrder,
        lyrics: item.lyrics,
        sectionLyricsMap: item.sectionLyricsMap,
      }));

  return sources
    .filter((source) => source.sectionOrder.length > 0)
    .slice(0, 4)
    .map((source, idx) => ({
      title: source.title,
      section_name: `${prefix} ${idx + 1}`,
      section_order: source.sectionOrder,
      lyrics: source.lyrics,
      section_lyrics_map: Object.fromEntries(
        Object.entries(source.sectionLyricsMap).map(([k, v]) => [String(k), v]),
      ),
    }));
}
```

Import `buildArrangementItems`.

- [ ] **Step 4: Add action option**

In `lib/actions/pptx-export.ts`, add `separateMashups?: boolean` to `exportContiToPptx` options and call:

```ts
const songs = buildPptxSongData(conti.songs, SECTION_PREFIX, {
  separateMashups: options.separateMashups ?? false,
});
```

- [ ] **Step 5: Add UI option**

In `components/contis/pptx-export-button.tsx`, add:

```ts
const [separateMashups, setSeparateMashups] = useState(false);
```

In mode select or confirm step, render:

```tsx
<label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
  <input
    type="checkbox"
    checked={separateMashups}
    onChange={(event) => setSeparateMashups(event.target.checked)}
  />
  <span>매시업 분리 내보내기</span>
</label>
```

Pass `separateMashups` to `exportContiToPptx`.

Build `eligibleSongs` and `sectionSummary` using `buildArrangementItems(conti.songs)` when `separateMashups === false`, and raw rows when true.

- [ ] **Step 6: Run PPT helper tests**

Run:

```bash
pnpm vitest run lib/utils/pptx-helpers.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8**

```bash
git add lib/utils/pptx-helpers.ts lib/utils/pptx-helpers.test.mjs lib/actions/pptx-export.ts components/contis/pptx-export-button.tsx
git commit -m "feat: merge mashups in ppt export"
```

---

### Task 9: YouTube Import Mashup Links

**Files:**
- Modify: `components/contis/youtube-import-model.ts`
- Modify: `components/contis/youtube-import-model.test.ts`
- Modify: `components/contis/youtube-import-state.ts`
- Modify: `components/contis/youtube-import-review.tsx`
- Modify: `components/contis/youtube-import-dialog.tsx`
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`
- Modify: `lib/actions/conti-songs.ts`

- [ ] **Step 1: Add failing import payload tests**

Append to `components/contis/youtube-import-model.test.ts`:

```ts
test("buildBatchImportItems keeps adjacent mashup link on the first item", () => {
  const items = buildBatchImportItems(
    [
      {
        ...existingItem,
        id: "yt-1",
        matchedSong: { id: "song-a", name: "A" },
        mashupWithNext: {
          presetId: "preset-m",
          createNewPreset: false,
          presetName: "A + B",
        },
      },
      {
        ...existingItem,
        id: "yt-2",
        matchedSong: { id: "song-b", name: "B" },
        selectedPresetId: null,
      },
    ],
    defaultPresetName,
  );

  assert.deepEqual(items[0].mashupWithNext, {
    presetId: "preset-m",
    createNewPreset: false,
    presetName: "A + B",
  });
  assert.equal(items[1].mashupWithNext, null);
});
```

- [ ] **Step 2: Run import model test to confirm red**

Run:

```bash
pnpm vitest run components/contis/youtube-import-model.test.ts
```

Expected: FAIL because `mashupWithNext` is not in the model.

- [ ] **Step 3: Extend import model types**

In `components/contis/youtube-import-model.ts`, add:

```ts
export interface YouTubeImportMashupLink {
  presetId: string | null;
  createNewPreset: boolean;
  presetName: string;
}
```

Add to `YouTubeImportReviewItem`:

```ts
mashupWithNext: YouTubeImportMashupLink | null;
```

Add to `BatchImportPayloadItem`:

```ts
mashupWithNext: YouTubeImportMashupLink | null;
```

In `buildBatchImportItems`, copy:

```ts
mashupWithNext: item.mashupWithNext,
```

- [ ] **Step 4: Initialize and clear mashup links in state**

In `youtube-import-state.ts`, new playlist items include:

```ts
mashupWithNext: null,
```

When an item is excluded, set any previous item pointing to it and the item itself to `mashupWithNext: null`.

Add handler:

```ts
function toggleMashupWithNext(itemId: string) {
  setItems((prev) => {
    const index = prev.findIndex((item) => item.id === itemId);
    if (index < 0 || index >= prev.length - 1) return prev;
    const current = prev[index];
    const next = prev[index + 1];
    if (current.excluded || next.excluded) return prev;
    return prev.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            mashupWithNext: item.mashupWithNext
              ? null
              : { presetId: null, createNewPreset: true, presetName: `${current.editedName} + ${next.editedName}` },
          }
        : item,
    );
  });
}
```

Return this handler from the hook.

- [ ] **Step 5: Render import review gap button**

In `youtube-import-review.tsx`, render a button between adjacent items:

```tsx
{index < items.length - 1 && !item.excluded && !items[index + 1].excluded && (
  <button
    type="button"
    onClick={() => onToggleMashupWithNext(item.id)}
    className="mx-10 rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
  >
    {item.mashupWithNext ? "매시업 연결됨" : "매시업 연결"}
  </button>
)}
```

Add prop `onToggleMashupWithNext`.

- [ ] **Step 6: Resolve linked presets during batch import**

Extend `BatchImportSongsToContiItem` in repository types with `mashupWithNext`.

In both `batchImportSongsToConti` implementations:

1. Keep an array of inserted or updated conti song ids in import order:

```ts
const importedRows: { item: BatchImportSongsToContiItem; contiSongId: string; songId: string }[] = [];
```

2. When updating `alreadyInConti`, fetch the existing conti song id and push it.
3. When inserting, push the inserted row id.
4. After the main loop, iterate `importedRows` by index. For an item with `mashupWithNext`, use the next imported row.
5. If `presetId` exists, apply it. If not, create a mashup preset with empty arrangement and ordered `[current.songId, next.songId]`.
6. Call the same apply logic as `applyMashupToContiSongs`.

- [ ] **Step 7: Run import tests**

Run:

```bash
pnpm vitest run components/contis/youtube-import-model.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 9**

```bash
git add components/contis/youtube-import-model.ts components/contis/youtube-import-model.test.ts components/contis/youtube-import-state.ts components/contis/youtube-import-review.tsx components/contis/youtube-import-dialog.tsx lib/repositories/storyboard/types.ts lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts lib/actions/conti-songs.ts
git commit -m "feat: support mashups in youtube import"
```

---

### Task 10: Final Verification And Browser QA

**Files:**
- Verify full changed surface.

- [ ] **Step 1: Run focused JS/TS tests**

Run:

```bash
pnpm vitest run \
  lib/utils/mashup-presets.test.ts \
  lib/utils/arrangement-items.test.ts \
  lib/utils/preset-overrides.test.ts \
  lib/utils/song-preset-draft.test.ts \
  lib/utils/pdf-export-helpers.test.mjs \
  lib/utils/pptx-helpers.test.mjs \
  components/contis/youtube-import-model.test.ts \
  lib/repositories/storyboard/verify.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: exit 0. Existing warnings may remain, but no new errors.

- [ ] **Step 3: Run full test suite with Python env fixed**

If Python packages are missing, install according to `requirements.txt` in the active Python environment, then run:

```bash
pnpm test
```

Expected: PASS. If Python dependency installation is not allowed in this environment, report that full test is blocked by missing `lxml`/`pptx` and include the focused JS/TS test result from Step 1.

- [ ] **Step 4: Start dev server**

Run:

```bash
pnpm dev
```

Expected: Next dev server starts and prints a localhost URL.

- [ ] **Step 5: Browser QA**

Using the in-app browser:

1. Open a song detail page.
2. Create a mashup preset by searching/creating a second song.
3. Confirm the same preset appears on both song detail pages with `매시업` badge.
4. Open a conti containing the two songs adjacent.
5. Click the gap connect button and apply the mashup preset.
6. Confirm the row becomes a thick mashup row with member names and `이어지는 매시업 프리셋` strip.
7. Click the strip, choose `원래 프리셋 복원`, and confirm both rows split and the preset remains in song library.
8. Reconnect and open PDF export; confirm one display number/page set is used for the mashup.
9. Open PPT export; confirm summary shows merged mashup by default and `매시업 분리 내보내기` changes summary to raw rows.
10. Open YouTube import review; connect adjacent items and confirm import creates/applies the mashup group.

- [ ] **Step 6: Commit final verification notes if docs changed**

If the implementation updates this plan or adds follow-up notes:

```bash
git add docs/superpowers/plans/2026-06-19-mashup-conti-presets.md
git commit -m "docs: update mashup implementation verification"
```

If no docs changed, do not create a no-op commit.

---

## Self-Review Checklist

- Spec coverage:
  - Shared preset across two songs: Task 1, Task 3, Task 5.
  - Song library creation flow with linked song search/create and front/back order: Task 5.
  - Conti adjacent connect and thick grouped row: Task 4, Task 6.
  - Split confirm with restore/clear and preset retained: Task 4, Task 6.
  - YouTube import adjacent mashup link: Task 9.
  - PDF one layout/page set: Task 2, Task 7.
  - PPT default merged, custom title, split option: Task 5, Task 8.
  - Neon/Turso schema parity and migration snapshot: Task 1, Task 3.
- Placeholder scan:
  - No placeholder tasks are left; every task has concrete file paths, command, and expected result.
- Type consistency:
  - `presetType`, `displayTitle`, `members`, `mashupGroupId`, `mashupPartOrder`, `preMashupPresetId`, `ArrangementItem.key`, and `arrangementItemKey` names are used consistently across tasks.
