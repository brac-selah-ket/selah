# Worship Prep Phase 2 QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/worship-prep`를 예배 준비 랜딩 화면답게 정리하고, 말씀 본문 모달과 프리셋 편집 안정성 문제를 해결한다.

**Architecture:** 기존 Next.js App Router, 서버 액션, shadcn/base-ui 컴포넌트 구조를 유지한다. Worship prep 카드는 한 클라이언트 컴포넌트 안에서 클릭/모달 상태를 처리하고, 말씀 fetch는 기존 scripture provider 위의 얇은 helper/server action으로 분리한다. 프리셋 문제는 draft 변환 helper를 분리해 테스트 가능하게 만들고, song preset editor의 refresh/preview-loading/dirty-state 경계를 안정화한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Base UI Dialog, Node test runner, Drizzle repository layer.

---

## 작업 분할과 소유권

Subagent-driven 방식으로 실행할 때는 다음처럼 파일 소유권을 나눈다.

- Worker A: worship-prep 레이아웃/카드/출처 표시/콘티 카드 클릭.
- Worker B: 말씀 preview helper, server action, scripture modal.
- Worker C: song preset draft helper, preset save/reload refresh, round-trip 테스트.
- Worker D: sheet-music preview loading contract, dirty-state 재현/보강, browser QA.

동시에 같은 파일을 수정하지 않는다. 특히 `components/worship-prep/prep-element-cards.tsx`는 Worker A가 먼저 카드 구조를 정리한 뒤 Worker B가 scripture modal을 얹는다.

## Task 1: Worship Prep 레이아웃과 카드 위계 정리

**Files:**
- Modify: `app/(authenticated)/worship-prep/page.tsx`
- Modify: `components/worship-prep/prep-element-cards.tsx`
- Test: `tests/worship-prep-phase2-source.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: source test를 추가해 카드 요구사항을 고정한다**

Create `tests/worship-prep-phase2-source.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('worship prep cards render source labels and compact value hierarchy', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/prep-element-cards.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /"use client"/);
  assert.match(source, /sourceLabel/);
  assert.match(source, /구글 시트/);
  assert.match(source, /콘티/);
  assert.match(source, /valueClassName/);
  assert.match(source, /gap-2/);
});

test('connected conti card is a single clickable link when conti exists', async () => {
  const source = await readFile(
    new URL('../components/worship-prep/prep-element-cards.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /href=\{`\/contis\/\$\{conti\.id\}`\}/);
  assert.doesNotMatch(source, /<Link[\s\S]+<Link/);
});

test('worship prep page uses tighter vertical rhythm after the header', async () => {
  const source = await readFile(
    new URL('../app/(authenticated)/worship-prep/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /flex flex-col gap-5/);
  assert.match(source, /<div className='space-y-4'>[\s\S]+<WorshipDateSelector/);
});
```

- [ ] **Step 2: 새 source test가 실패하는지 확인한다**

Run:

```bash
node --test tests/worship-prep-phase2-source.test.mjs
```

Expected: FAIL. 현재 `prep-element-cards.tsx`는 서버 컴포넌트이고 `sourceLabel`, `valueClassName`, 단일 clickable conti card 구조가 없다.

- [ ] **Step 3: test script에 새 source test를 추가한다**

Modify `package.json` `scripts.test` command by appending:

```json
tests/worship-prep-phase2-source.test.mjs
```

Do not replace the whole command. Add the new file path to the existing space-separated `node --experimental-strip-types --test` file list.

- [ ] **Step 4: worship-prep page spacing을 줄인다**

Modify `app/(authenticated)/worship-prep/page.tsx`.

Replace:

```tsx
return (
  <div className='flex flex-col gap-6'>
```

with:

```tsx
return (
  <div className='flex flex-col gap-5'>
```

Wrap the date selector and automation panel:

```tsx
<div className='space-y-4'>
  <WorshipDateSelector selectedDate={selectedDate} />
  <PrepAutomationPanel />
</div>
```

Keep the `PageHeader` block unchanged except for surrounding spacing.

- [ ] **Step 5: 카드 데이터를 배열로 만들고 source label을 추가한다**

Modify `components/worship-prep/prep-element-cards.tsx`.

Add client directive and imports:

```tsx
"use client"

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Conti } from '@/lib/types';
import type { WorshipPrepSummary } from '@/lib/queries/worship-prep';
```

Replace the repeated card JSX with this structure:

```tsx
type PrepCardItem = {
  id: string;
  category: string;
  title: string;
  value: string;
  hasValue: boolean;
  sourceLabel: '구글 시트' | '콘티';
  href?: string;
};

const valueClassName = 'text-base font-semibold leading-snug text-foreground';

function statusBadge(hasValue: boolean) {
  return <Badge variant={hasValue ? 'default' : 'outline'}>{hasValue ? '완료' : '미입력'}</Badge>;
}

function valueOrDash(value: string | null): string {
  return value && value.trim() ? value : '-';
}

function SourceBadge({ label }: { label: PrepCardItem['sourceLabel'] }) {
  return (
    <Badge variant='outline' className='h-6 bg-background/70 text-xs text-muted-foreground'>
      {label}
    </Badge>
  );
}

function PrepCard({ card }: { card: PrepCardItem }) {
  const content = (
    <Card
      size='sm'
      className={cn(
        'h-full transition-colors',
        card.href && 'hover:border-primary/35 hover:bg-muted/35',
      )}
    >
      <CardContent className='space-y-3'>
        <div className='flex items-start justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>{card.category}</p>
          <SourceBadge label={card.sourceLabel} />
        </div>
        <div className='space-y-1'>
          <h3 className='text-lg font-medium leading-snug'>{card.title}</h3>
          <p className={cn(valueClassName, card.href && 'text-primary underline-offset-4 group-hover:underline')}>
            {card.value}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {statusBadge(card.hasValue)}
        </div>
      </CardContent>
    </Card>
  );

  if (!card.href) return content;

  return (
    <Link href={card.href} className='group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45'>
      {content}
    </Link>
  );
}
```

Inside `PrepElementCards`, build the card array:

```tsx
const contiLabel = conti ? conti.title || `${conti.date} 콘티` : '연결된 콘티 없음';
const cards: PrepCardItem[] = [
  {
    id: 'preacher',
    category: '역할',
    title: '설교자',
    value: valueOrDash(item.preacher),
    hasValue: Boolean(item.preacher),
    sourceLabel: '구글 시트',
  },
  {
    id: 'leader',
    category: '역할',
    title: '인도자',
    value: valueOrDash(item.leader),
    hasValue: Boolean(item.leader),
    sourceLabel: '구글 시트',
  },
  {
    id: 'worshipLeader',
    category: '역할',
    title: '찬양 인도자',
    value: valueOrDash(item.worshipLeader),
    hasValue: Boolean(item.worshipLeader),
    sourceLabel: '구글 시트',
  },
  {
    id: 'sermonTitle',
    category: '설교',
    title: '설교 제목',
    value: valueOrDash(item.title),
    hasValue: Boolean(item.title),
    sourceLabel: '구글 시트',
  },
  {
    id: 'scripture',
    category: '설교',
    title: '말씀 본문',
    value: valueOrDash(item.scripture),
    hasValue: Boolean(item.scripture),
    sourceLabel: '구글 시트',
  },
  {
    id: 'songs',
    category: '찬양',
    title: '찬양 목록',
    value: item.songs.length > 0 ? item.songs.join(', ') : '-',
    hasValue: item.songs.length > 0,
    sourceLabel: '구글 시트',
  },
  {
    id: 'conti',
    category: '연결',
    title: '콘티',
    value: contiLabel,
    hasValue: Boolean(conti),
    sourceLabel: '콘티',
    href: conti ? `/contis/${conti.id}` : undefined,
  },
];
```

Render:

```tsx
return (
  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
    {cards.map((card) => (
      <PrepCard key={card.id} card={card} />
    ))}
  </div>
);
```

- [ ] **Step 6: Task 1 test를 통과시킨다**

Run:

```bash
node --test tests/worship-prep-phase2-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Task 1 변경을 커밋한다**

Run:

```bash
git add "app/(authenticated)/worship-prep/page.tsx" components/worship-prep/prep-element-cards.tsx tests/worship-prep-phase2-source.test.mjs package.json
git commit -m "fix: polish worship prep cards"
```

## Task 2: 말씀 본문 preview helper, server action, modal 추가

**Files:**
- Create: `lib/scripture/preview.ts`
- Test: `lib/scripture/preview.test.ts`
- Create: `lib/actions/scripture.ts`
- Create: `components/worship-prep/scripture-preview-dialog.tsx`
- Modify: `components/worship-prep/prep-element-cards.tsx`
- Modify: `package.json`

- [ ] **Step 1: scripture preview helper test를 작성한다**

Create `lib/scripture/preview.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { ScriptureVerse } from './types.ts';
import { buildScripturePreview } from './preview.ts';

const romans = { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' };

test('buildScripturePreview normalizes reference and returns verse labels', async () => {
  const verses: ScriptureVerse[] = [
    { book: romans, chapter: 6, verse: 1, text: '그런즉 우리가 무슨 말 하리요' },
    { book: romans, chapter: 6, verse: 2, text: '그럴 수 없느니라' },
  ];

  const result = await buildScripturePreview('로마서 6:1-2', async () => verses);

  assert.equal(result.reference, '롬 6:1~2');
  assert.deepEqual(result.verses, [
    { label: '롬 6:1', text: '그런즉 우리가 무슨 말 하리요' },
    { label: '롬 6:2', text: '그럴 수 없느니라' },
  ]);
});

test('buildScripturePreview rejects empty references', async () => {
  await assert.rejects(
    () => buildScripturePreview(' ', async () => []),
    /말씀 본문을 입력해 주세요/,
  );
});
```

- [ ] **Step 2: helper test가 실패하는지 확인한다**

Run:

```bash
node --experimental-strip-types --test lib/scripture/preview.test.ts
```

Expected: FAIL because `lib/scripture/preview.ts` does not exist.

- [ ] **Step 3: scripture preview helper를 구현한다**

Create `lib/scripture/preview.ts`:

```ts
import { fetchScriptureVerses } from './provider';
import { formatScriptureReference, formatVerseLabel, parseScriptureReference } from './reference';
import type { ScriptureReference, ScriptureVerse } from './types';

export interface ScripturePreviewVerse {
  label: string;
  text: string;
}

export interface ScripturePreviewResult {
  reference: string;
  verses: ScripturePreviewVerse[];
}

type ScriptureVerseFetcher = (reference: ScriptureReference) => Promise<ScriptureVerse[]>;

export async function buildScripturePreview(
  scriptureReference: string,
  fetcher: ScriptureVerseFetcher = fetchScriptureVerses,
): Promise<ScripturePreviewResult> {
  const trimmed = scriptureReference.trim();
  if (!trimmed) {
    throw new Error('말씀 본문을 입력해 주세요');
  }

  const parsedReference = parseScriptureReference(trimmed);
  const verses = await fetcher(parsedReference);

  if (verses.length === 0) {
    throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
  }

  return {
    reference: formatScriptureReference(parsedReference),
    verses: verses.map((verse) => ({
      label: formatVerseLabel(parsedReference, verse),
      text: verse.text,
    })),
  };
}
```

- [ ] **Step 4: server action을 추가한다**

Create `lib/actions/scripture.ts`:

```ts
'use server';

import type { ActionResult } from '@/lib/types';
import { buildScripturePreview, type ScripturePreviewResult } from '@/lib/scripture/preview';

export async function previewScriptureReference(
  scriptureReference: string,
): Promise<ActionResult<ScripturePreviewResult>> {
  try {
    const data = await buildScripturePreview(scriptureReference);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : '말씀 본문을 불러오는 중 오류가 발생했습니다',
    };
  }
}
```

- [ ] **Step 5: scripture modal 컴포넌트를 만든다**

Create `components/worship-prep/scripture-preview-dialog.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { previewScriptureReference } from '@/lib/actions/scripture';
import type { ScripturePreviewResult } from '@/lib/scripture/preview';

interface ScripturePreviewDialogProps {
  open: boolean;
  reference: string | null;
  onOpenChange: (open: boolean) => void;
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ScripturePreviewResult }
  | { status: 'error'; error: string };

const scriptureCache = new Map<string, ScripturePreviewResult>();

function cacheKey(reference: string) {
  return reference.trim().replace(/\s+/g, ' ');
}

export function ScripturePreviewDialog({
  open,
  reference,
  onOpenChange,
}: ScripturePreviewDialogProps) {
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const requestIdRef = useRef(0);
  const normalizedReference = reference ? cacheKey(reference) : '';

  async function load(options: { force?: boolean } = {}) {
    if (!normalizedReference) return;

    if (!options.force) {
      const cached = scriptureCache.get(normalizedReference);
      if (cached) {
        setState({ status: 'success', data: cached });
        return;
      }
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState({ status: 'loading' });

    const result = await previewScriptureReference(normalizedReference);
    if (requestIdRef.current !== requestId) return;

    if (result.success && result.data) {
      scriptureCache.set(normalizedReference, result.data);
      setState({ status: 'success', data: result.data });
      return;
    }

    setState({ status: 'error', error: result.error ?? '말씀 본문을 불러오지 못했습니다' });
  }

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, normalizedReference]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg' className='max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{state.status === 'success' ? state.data.reference : normalizedReference || '말씀 본문'}</DialogTitle>
          <DialogDescription>개역개정 본문을 불러옵니다.</DialogDescription>
        </DialogHeader>

        {state.status === 'loading' && (
          <p className='py-8 text-center text-sm text-muted-foreground'>말씀 본문 불러오는 중...</p>
        )}

        {state.status === 'error' && (
          <div className='rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive'>
            {state.error}
          </div>
        )}

        {state.status === 'success' && (
          <div className='space-y-3'>
            {state.data.verses.map((verse) => (
              <p key={verse.label} className='grid gap-2 text-base leading-7 sm:grid-cols-[4.5rem_1fr]'>
                <span className='font-semibold text-primary'>{verse.label}</span>
                <span>{verse.text}</span>
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => void load({ force: true })} disabled={!normalizedReference || state.status === 'loading'}>
            다시 불러오기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: 말씀 카드 클릭 시 modal을 열도록 연결한다**

Modify `components/worship-prep/prep-element-cards.tsx`.

Add imports:

```tsx
import { useState } from 'react';
import { ScripturePreviewDialog } from '@/components/worship-prep/scripture-preview-dialog';
```

Extend `PrepCardItem`:

```ts
onClick?: () => void;
buttonLabel?: string;
```

Update `PrepCard` before link handling:

```tsx
if (card.onClick) {
  return (
    <button
      type='button'
      onClick={card.onClick}
      className='group block h-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45'
      aria-label={card.buttonLabel ?? `${card.title} 열기`}
    >
      {content}
    </button>
  );
}
```

Inside `PrepElementCards`, add state:

```tsx
const [scriptureDialogOpen, setScriptureDialogOpen] = useState(false);
const scriptureReference = item.scripture?.trim() || null;
```

Set scripture card fields:

```tsx
onClick: scriptureReference ? () => setScriptureDialogOpen(true) : undefined,
buttonLabel: scriptureReference ? `${scriptureReference} 본문 보기` : undefined,
```

Return fragment:

```tsx
return (
  <>
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {cards.map((card) => (
        <PrepCard key={card.id} card={card} />
      ))}
    </div>
    <ScripturePreviewDialog
      open={scriptureDialogOpen}
      reference={scriptureReference}
      onOpenChange={setScriptureDialogOpen}
    />
  </>
);
```

- [ ] **Step 7: test script에 scripture preview test를 추가한다**

Modify `package.json` `scripts.test` command by appending:

```json
lib/scripture/preview.test.ts
```

- [ ] **Step 8: Task 2 tests를 실행한다**

Run:

```bash
node --experimental-strip-types --test lib/scripture/preview.test.ts
node --test tests/worship-prep-phase2-source.test.mjs
```

Expected: both PASS.

- [ ] **Step 9: Task 2 변경을 커밋한다**

Run:

```bash
git add lib/scripture/preview.ts lib/scripture/preview.test.ts lib/actions/scripture.ts components/worship-prep/scripture-preview-dialog.tsx components/worship-prep/prep-element-cards.tsx package.json
git commit -m "feat: add scripture preview modal"
```

## Task 3: Song preset draft 변환 분리와 저장 후 refresh

**Files:**
- Create: `lib/utils/song-preset-draft.ts`
- Test: `lib/utils/song-preset-draft.test.ts`
- Modify: `components/songs/preset-editor.tsx`
- Modify: `components/songs/preset-list.tsx`
- Modify: `package.json`

- [ ] **Step 1: preset draft round-trip test를 작성한다**

Create `lib/utils/song-preset-draft.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { SongPresetWithSheetMusic } from '../types.ts';
import { arrangementDraftToSongPresetData, songPresetToDraft } from './song-preset-draft.ts';

const preset: SongPresetWithSheetMusic = {
  id: 'preset-1',
  songId: 'song-1',
  name: '2026-03-08',
  keys: JSON.stringify(['G', 'A']),
  tempos: JSON.stringify([72, 84]),
  sectionOrder: JSON.stringify(['Intro', 'V', 'C']),
  lyrics: JSON.stringify(['line 1', 'line 2']),
  sectionLyricsMap: JSON.stringify({ 0: [0], 2: [1] }),
  notes: 'soft intro',
  youtubeReference: 'W1uussHIX9o',
  youtubeTitle: 'Invitation',
  pdfMetadata: JSON.stringify({
    files: [{ sheetMusicFileId: 'sheet-1', pages: [{ pdfPageIndex: 0, overlays: [] }] }],
  }),
  isDefault: true,
  sortOrder: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  sheetMusicFileIds: ['sheet-1'],
};

test('songPresetToDraft restores all arrangement fields', () => {
  const draft = songPresetToDraft(preset);

  assert.deepEqual(draft.keys, ['G', 'A']);
  assert.deepEqual(draft.tempos, [72, 84]);
  assert.deepEqual(draft.sectionOrder, ['Intro', 'V', 'C']);
  assert.deepEqual(draft.lyrics, ['line 1', 'line 2']);
  assert.deepEqual(draft.sectionLyricsMap, { 0: [0], 2: [1] });
  assert.equal(draft.notes, 'soft intro');
  assert.deepEqual(draft.sheetMusicFileIds, ['sheet-1']);
  assert.equal(draft.youtubeReference, 'https://www.youtube.com/watch?v=W1uussHIX9o');
  assert.equal(draft.youtubeTitle, 'Invitation');
  assert.equal(draft.isDefault, true);
  assert.equal(draft.appliedPresetId, 'preset-1');
  assert.equal(draft.pdfMetadata?.files[0]?.sheetMusicFileId, 'sheet-1');
});

test('arrangementDraftToSongPresetData preserves edited arrangement fields', () => {
  const draft = songPresetToDraft(preset);
  const data = arrangementDraftToSongPresetData({
    ...draft,
    name: ' updated ',
    youtubeReference: 'https://youtu.be/W1uussHIX9o',
  });

  assert.equal(data.name, 'updated');
  assert.deepEqual(data.keys, ['G', 'A']);
  assert.deepEqual(data.tempos, [72, 84]);
  assert.deepEqual(data.sectionOrder, ['Intro', 'V', 'C']);
  assert.deepEqual(data.lyrics, ['line 1', 'line 2']);
  assert.deepEqual(data.sectionLyricsMap, { 0: [0], 2: [1] });
  assert.deepEqual(data.sheetMusicFileIds, ['sheet-1']);
  assert.equal(data.youtubeReference, 'W1uussHIX9o');
  assert.equal(data.youtubeTitle, 'Invitation');
});

test('empty preset sheet music rows mean all sheet music in the editor', () => {
  const draft = songPresetToDraft({ ...preset, sheetMusicFileIds: [] });

  assert.equal(draft.sheetMusicFileIds, null);
});
```

- [ ] **Step 2: round-trip test가 실패하는지 확인한다**

Run:

```bash
node --experimental-strip-types --test lib/utils/song-preset-draft.test.ts
```

Expected: FAIL because `lib/utils/song-preset-draft.ts` does not exist.

- [ ] **Step 3: draft helper를 구현한다**

Create `lib/utils/song-preset-draft.ts`:

```ts
import type { ArrangementDraft } from '../../components/shared/arrangement-editor/types';
import type { SongPresetData, SongPresetWithSheetMusic } from '../types';
import { normalizeYouTubeReference, toYouTubeInputValue } from './youtube';

function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback;
  try {
    return JSON.parse(field) as T;
  } catch {
    return fallback;
  }
}

export function songPresetToDraft(preset: SongPresetWithSheetMusic | undefined): ArrangementDraft {
  return {
    name: preset?.name ?? '',
    keys: parseJsonField<string[]>(preset?.keys ?? null, []),
    tempos: parseJsonField<number[]>(preset?.tempos ?? null, []),
    sectionOrder: parseJsonField<string[]>(preset?.sectionOrder ?? null, []),
    lyrics: parseJsonField<string[]>(preset?.lyrics ?? null, []),
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(preset?.sectionLyricsMap ?? null, {}),
    notes: preset?.notes ?? null,
    sheetMusicFileIds: preset?.sheetMusicFileIds?.length ? preset.sheetMusicFileIds : null,
    pdfMetadata: parseJsonField(preset?.pdfMetadata ?? null, null),
    youtubeReference: toYouTubeInputValue(preset?.youtubeReference),
    youtubeTitle: preset?.youtubeTitle ?? null,
    isDefault: preset?.isDefault ?? false,
    appliedPresetId: preset?.id ?? null,
  };
}

export function arrangementDraftToSongPresetData(draft: ArrangementDraft): SongPresetData {
  const normalized = draft.youtubeReference
    ? normalizeYouTubeReference(draft.youtubeReference)
    : null;

  return {
    name: draft.name.trim(),
    keys: draft.keys,
    tempos: draft.tempos,
    sectionOrder: draft.sectionOrder,
    lyrics: draft.lyrics,
    sectionLyricsMap: draft.sectionLyricsMap,
    notes: draft.notes?.trim() || null,
    isDefault: draft.isDefault,
    youtubeReference: normalized?.videoId ?? null,
    youtubeTitle: normalized ? draft.youtubeTitle : null,
    sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
    pdfMetadata: draft.pdfMetadata,
  };
}
```

- [ ] **Step 4: PresetEditor에서 local 변환 함수를 제거하고 helper를 사용한다**

Modify `components/songs/preset-editor.tsx`.

Remove local `parseJsonField`, `presetToDraft`, `draftToPresetData`, and `normalizeYouTubeReference` / `toYouTubeInputValue` imports.

Add:

```tsx
import { useRouter } from "next/navigation"
import {
  arrangementDraftToSongPresetData,
  songPresetToDraft,
} from "@/lib/utils/song-preset-draft"
```

Inside `PresetEditor`:

```tsx
const router = useRouter()
```

Use the helper:

```tsx
initialDraft={songPresetToDraft(preset)}
```

Update `onSave`:

```tsx
onSave={async (draft) => {
  const data = arrangementDraftToSongPresetData(draft)
  const result = preset
    ? await updateSongPreset(preset.id, data)
    : await createSongPreset(songId, data)

  if (result.success) {
    router.refresh()
  }

  return { success: result.success, error: result.error }
}}
```

- [ ] **Step 5: PresetList의 delete/default 후에도 최신 서버 데이터를 refresh한다**

Modify `components/songs/preset-list.tsx`.

Add:

```tsx
import { useRouter } from "next/navigation"
```

Inside `PresetList`:

```tsx
const router = useRouter()
```

After successful delete:

```tsx
router.refresh()
```

After successful default update:

```tsx
router.refresh()
```

- [ ] **Step 6: test script에 draft test를 추가한다**

Modify `package.json` `scripts.test` command by appending:

```json
lib/utils/song-preset-draft.test.ts
```

- [ ] **Step 7: Task 3 tests를 실행한다**

Run:

```bash
node --experimental-strip-types --test lib/utils/song-preset-draft.test.ts
node --experimental-strip-types --test components/shared/arrangement-editor/dirty-state.test.ts
```

Expected: both PASS.

- [ ] **Step 8: Task 3 변경을 커밋한다**

Run:

```bash
git add lib/utils/song-preset-draft.ts lib/utils/song-preset-draft.test.ts components/songs/preset-editor.tsx components/songs/preset-list.tsx package.json
git commit -m "fix: stabilize song preset draft reload"
```

## Task 4: 악보 preview loading과 untouched dirty-state 안정화

**Files:**
- Modify: `components/songs/sheet-music-gallery.tsx`
- Modify: `components/songs/preset-editor.tsx`
- Modify: `components/contis/conti-song-editor.tsx`
- Test: `tests/sheet-music-preview-loading-source.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: source test로 loading 계약을 고정한다**

Create `tests/sheet-music-preview-loading-source.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sheet music gallery reports controlled preview loading to parents', async () => {
  const source = await readFile(
    new URL('../components/songs/sheet-music-gallery.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /onPreviewLoadingChange\?: \(loading: boolean\) => void/);
  assert.match(source, /previewLoadingChangeRef/);
  assert.match(source, /previewLoadingChangeRef\.current\?\.\(true\)/);
  assert.match(source, /previewLoadingChangeRef\.current\?\.\(false\)/);
});

test('song preset editor passes sheet music loading into ArrangementEditor', async () => {
  const source = await readFile(
    new URL('../components/songs/preset-editor.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const \[sheetMusicLoading, setSheetMusicLoading\] = useState/);
  assert.match(source, /sheetMusicLoading=\{sheetMusicLoading\}/);
  assert.match(source, /onPreviewLoadingChange=\{setSheetMusicLoading\}/);
});

test('conti song editor combines fetched sheet music loading with preview loading', async () => {
  const source = await readFile(
    new URL('../components/contis/conti-song-editor.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const \[sheetMusicPreviewLoading, setSheetMusicPreviewLoading\] = useState/);
  assert.match(source, /sheetMusicLoading=\{sheetMusicLoading \|\| sheetMusicPreviewLoading\}/);
  assert.match(source, /onPreviewLoadingChange=\{setSheetMusicPreviewLoading\}/);
});
```

- [ ] **Step 2: loading source test가 실패하는지 확인한다**

Run:

```bash
node --test tests/sheet-music-preview-loading-source.test.mjs
```

Expected: FAIL because `onPreviewLoadingChange` does not exist.

- [ ] **Step 3: SheetMusicGallery에 loading callback을 추가한다**

Modify `components/songs/sheet-music-gallery.tsx`.

Extend props:

```tsx
onPreviewLoadingChange?: (loading: boolean) => void;
```

Destructure:

```tsx
onPreviewLoadingChange,
```

Add ref:

```tsx
const previewLoadingChangeRef = useRef(onPreviewLoadingChange);
```

Sync callback:

```tsx
useEffect(() => {
  previewLoadingChangeRef.current = onPreviewLoadingChange;
}, [onPreviewLoadingChange]);
```

At the start of `buildItems()`:

```tsx
if (previewMode === "controlled") {
  previewLoadingChangeRef.current?.(currentFiles.length > 0);
}
```

Before every non-cancelled completion path, set false:

```tsx
if (!cancelled && previewMode === "controlled") {
  previewLoadingChangeRef.current?.(false);
}
```

Place that immediately before the final:

```tsx
setItems(result);
syncControlledPreview(result);
```

Also call false in the cleanup path:

```tsx
return () => {
  cancelled = true;
  if (previewMode === "controlled") {
    previewLoadingChangeRef.current?.(false);
  }
};
```

- [ ] **Step 4: Song preset editor에서 loading 상태를 넘긴다**

Modify `components/songs/preset-editor.tsx`.

Add state:

```tsx
const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
```

Reset when closing:

```tsx
if (!open) {
  setSheetMusicLoading(false)
}
```

Pass to `ArrangementEditor`:

```tsx
sheetMusicLoading={sheetMusicLoading}
```

Pass to gallery:

```tsx
onPreviewLoadingChange={setSheetMusicLoading}
```

- [ ] **Step 5: Conti song editor에서도 preview rendering loading을 합친다**

Modify `components/contis/conti-song-editor.tsx`.

Add state:

```tsx
const [sheetMusicPreviewLoading, setSheetMusicPreviewLoading] = useState(false)
```

Reset when song changes:

```tsx
setSheetMusicPreviewLoading(false)
```

Pass combined loading:

```tsx
sheetMusicLoading={sheetMusicLoading || sheetMusicPreviewLoading}
```

Pass callback to `SheetMusicGallery`:

```tsx
onPreviewLoadingChange={setSheetMusicPreviewLoading}
```

- [ ] **Step 6: untouched dirty-state를 재검증한다**

Run:

```bash
node --experimental-strip-types --test components/shared/arrangement-editor/dirty-state.test.ts
node --test tests/sheet-music-preview-loading-source.test.mjs
```

Expected: both PASS.

If browser QA still shows an unsaved confirm without edits, inspect whether `SectionLyricsMapper` auto-prunes `sectionLyricsMap` on mount. If confirmed, modify `components/contis/section-lyrics-mapper.tsx` so auto-pruning during initial hydration does not call `onChange`; user toggles still call `onChange`.

Use this exact guard:

```tsx
const skipNextEmitRef = useRef(false)

useEffect(() => {
  setSectionLyricsMap(prev => {
    const next: Record<number, number[]> = {}
    let changed = false
    for (const [key, indices] of Object.entries(prev)) {
      const filtered = indices.filter(i => i < lyrics.length)
      if (filtered.length !== indices.length) changed = true
      if (filtered.length > 0) next[Number(key)] = filtered
      else { changed = true }
    }
    if (changed) {
      skipNextEmitRef.current = true
      return next
    }
    return prev
  })
}, [lyrics.length])

useEffect(() => {
  if (isFirstRender.current) {
    isFirstRender.current = false
    return
  }
  if (skipNextEmitRef.current) {
    skipNextEmitRef.current = false
    return
  }
  onChangeRef.current({ sectionLyricsMap })
}, [sectionLyricsMap])
```

- [ ] **Step 7: test script에 loading source test를 추가한다**

Modify `package.json` `scripts.test` command by appending:

```json
tests/sheet-music-preview-loading-source.test.mjs
```

- [ ] **Step 8: Task 4 변경을 커밋한다**

Run:

```bash
git add components/songs/sheet-music-gallery.tsx components/songs/preset-editor.tsx components/contis/conti-song-editor.tsx components/contis/section-lyrics-mapper.tsx tests/sheet-music-preview-loading-source.test.mjs package.json
git commit -m "fix: show sheet music loading in preset editor"
```

If `section-lyrics-mapper.tsx` was not changed because the browser QA did not reproduce that root cause, omit it from `git add`.

## Task 5: 통합 검증과 브라우저 QA

**Files:**
- No new files expected.
- Verify all touched files.

- [ ] **Step 1: 전체 test script를 실행한다**

Run:

```bash
pnpm test
```

Expected: PASS. If any source test fails due formatting-only differences, update the regex only after confirming the actual behavior still matches the requirement.

- [ ] **Step 2: lint를 실행한다**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: local server를 실행 상태로 둔다**

If `http://localhost:3000` is not responding, run:

```bash
pnpm dev
```

Expected: Next.js dev server starts on port 3000.

- [ ] **Step 4: Browser QA - worship prep**

Open `http://localhost:3000/worship-prep`.

Verify:

- 상단 `예배 준비` header와 날짜 선택기 사이 여백이 이전보다 자연스럽다.
- 카드 값이 title 바로 아래에서 더 강하게 보인다.
- 모든 카드 우측 상단에 `구글 시트` 또는 `콘티` source marker가 있다.
- `완료` badge와 값이 붙어 보이지 않는다.
- 연결 콘티 카드 전체를 클릭하면 예시로 `http://localhost:3000/contis/9HnGhhp11yfw` 같은 해당 콘티 상세 URL로 이동한다.

- [ ] **Step 5: Browser QA - scripture modal**

Open `http://localhost:3000/worship-prep`.

Verify:

- 말씀 본문 카드 클릭 시 modal이 열린다.
- 처음 열 때 `말씀 본문 불러오는 중...`이 보인다.
- 본문 절 번호와 텍스트가 표시된다.
- 닫았다가 다시 열면 cached result가 즉시 보인다.
- `다시 불러오기` 버튼이 다시 fetch한다.
- outside click으로 modal이 닫힌다.

- [ ] **Step 6: Browser QA - song preset editor**

Open a song detail page with sheet music and presets, for example `http://localhost:3000/songs/kIPVTzwXQyEK`.

Verify:

- 프리셋 편집 drawer 최초 로딩 중에는 `악보 불러오는 중...`이 보이고, 준비 전 `미리볼 악보를 선택하세요.`가 나오지 않는다.
- 아무 수정 없이 닫을 때 unsaved confirmation이 나오지 않는다.
- 실제로 key/tempo/section을 수정하면 닫을 때 unsaved confirmation이 나온다.

- [ ] **Step 7: Browser QA - conti-to-preset round-trip**

Open a conti detail page, edit a conti song, set key/tempo/section/lyrics, then save to an existing or new preset.

Verify:

- 저장 toast가 표시된다.
- song detail page로 이동해 해당 preset을 열면 저장한 key/tempo/section/lyrics가 그대로 보인다.
- YouTube reference는 기존 정책대로 유지/저장된다.

- [ ] **Step 8: 워크트리 상태를 확인한다**

Run:

```bash
git status --short
```

Expected: no output. If there are uncommitted files, return to the task that owns those files, run that task's focused verification again, and commit the exact files using that task's commit message pattern. Do not create a catch-all final commit.

## 최종 완료 기준

- `pnpm test` PASS.
- `pnpm lint` PASS.
- Browser QA 항목이 모두 확인됨.
- 작업 단위별 커밋이 만들어짐.
- 구현 후 필요하면 `superpowers:requesting-code-review`로 리뷰를 요청한다.
