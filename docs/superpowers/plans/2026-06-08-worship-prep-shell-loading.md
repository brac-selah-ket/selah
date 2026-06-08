# Worship Prep Shell Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예배준비 탭 진입 시 전체 화면 스켈레톤 대신 고정 shell을 즉시 보여주고, Google Sheets/콘티 데이터 카드 영역만 스켈레톤으로 대기하게 만든다.

**Architecture:** `/worship-prep/page.tsx`를 request-time data와 current-time 계산을 직접 수행하는 페이지에서 정적 shell + Suspense data region 구조로 바꾼다. 날짜 선택기는 client component가 URL query와 기본 날짜를 직접 계산하되 local Suspense fallback을 가져 shell 전체가 사라지지 않게 한다. 서버 데이터는 Suspense 아래 async children에서 React `cache()` helper를 통해 공유하고, route-level `loading.tsx`는 제거해 카드 전용 skeleton fallback만 페이지 내부에 남긴다.

**Tech Stack:** Next.js 16 App Router, React Suspense, React `cache`, React Server Components, Client Component `useSearchParams`, Vitest source guard tests, shadcn/base-ui Button, Hugeicons.

---

## 병렬 실행 전략

이 작업은 `app/(authenticated)/worship-prep/page.tsx`와 `components/worship-prep/worship-date-selector.tsx`가 서로 맞물리므로 구현 worker를 동시에 여러 명 띄우면 충돌 가능성이 높다. 따라서 구현은 Task 1 → Task 2 → Task 3 순서로 진행한다.

리뷰는 최대한 병렬화한다. 각 task 완료 후 spec compliance review와 code quality review를 순차 품질 게이트로 두되, Task 3 이후에는 최종 통합 리뷰와 전체 검증을 병렬로 진행할 수 있다.

## 파일 구조

- Modify: `components/worship-prep/worship-date-selector.tsx`
  - `selectedDate`를 필수 server prop으로 받지 않는다.
  - client-side `useSearchParams()`에서 현재 URL의 `date` query를 읽고, query가 없거나 잘못되면 client-side `getDefaultWorshipPrepIsoDate()`로 기본 날짜를 계산한다.
- Modify: `app/(authenticated)/worship-prep/page.tsx`
  - Task 1에서는 `WorshipDateSelector`를 prop 없이 렌더하고 selector-local Suspense fallback을 추가한다.
  - Task 2에서는 shell, memoized data helper, header action, data panel, card skeleton fallback을 한 파일 안의 작은 서버 컴포넌트들로 분리한다.
- Delete: `app/(authenticated)/worship-prep/loading.tsx`
  - route-level 전체 fallback을 제거한다.
- Modify: `tests/worship-prep-loading-source.test.mjs`
  - 기존 route-level loading 검증을 shell/Suspense/card skeleton 검증으로 교체한다.
- Modify: `tests/worship-prep-source.test.mjs`
  - 날짜 선택기 테스트를 client-side query 기반 선택 날짜 계산 구조에 맞게 갱신한다.
- Modify: `tests/worship-prep-phase2-source.test.mjs`
  - 페이지 control grouping 테스트가 prop 없는 selector와 local Suspense boundary를 허용하도록 갱신한다.

---

### Task 1: 날짜 선택기를 client-side URL query 기반으로 전환

**Files:**
- Modify: `tests/worship-prep-source.test.mjs`
- Modify: `tests/worship-prep-phase2-source.test.mjs`
- Modify: `components/worship-prep/worship-date-selector.tsx`
- Modify: `app/(authenticated)/worship-prep/page.tsx`

- [ ] **Step 1: 날짜 선택기 source guard를 먼저 실패하도록 수정**

Modify the existing test named `worship prep date selector refreshes immediately on calendar change` in `tests/worship-prep-source.test.mjs`:

```js
test('worship prep date selector reads the selected date from the URL query on the client', async () => {
  const pageSource = await readFile(
    new URL('../app/(authenticated)/worship-prep/page.tsx', import.meta.url),
    'utf8',
  );
  const selectorSource = await readFile(
    new URL('../components/worship-prep/worship-date-selector.tsx', import.meta.url),
    'utf8',
  );

  assert.match(pageSource, /import \{ WorshipDateSelector \}/);
  assert.match(pageSource, /import \{[^}]*\bSuspense\b[^}]*\} from ["']react["']/);
  assert.match(pageSource, /function WorshipDateSelectorFallback/);
  assert.match(pageSource, /<Suspense fallback=\{<WorshipDateSelectorFallback \/>\}>/);
  assert.match(pageSource, /<WorshipDateSelector \/>/);
  assert.doesNotMatch(pageSource, /<WorshipDateSelector selectedDate=\{selectedDate\} \/>/);
  assert.doesNotMatch(pageSource, /<WorshipDateSelector defaultDate=\{defaultDate\} \/>/);
  assert.doesNotMatch(pageSource, /<form[\s\S]+method='GET'/);
  assert.doesNotMatch(pageSource, /주차 변경/);

  assert.match(selectorSource, /"use client"/);
  assert.match(selectorSource, /getDefaultWorshipPrepIsoDate/);
  assert.match(selectorSource, /useSearchParams\(\)/);
  assert.match(selectorSource, /searchParams\.get\(["']date["']\)/);
  assert.match(selectorSource, /normalizeDate/);
  assert.match(selectorSource, /DatePicker/);
  assert.match(selectorSource, /value=\{selectedDate\}/);
  assert.match(selectorSource, /onChange=\{handleChange\}/);
  assert.match(selectorSource, /router\.push\(`\$\{pathname\}\?\$\{params\.toString\(\)\}`\)/);
});
```

- [ ] **Step 2: phase2 source guard도 새 selector 구조를 허용하도록 수정**

Modify the test named `worship prep page uses tighter section spacing and groups controls` in `tests/worship-prep-phase2-source.test.mjs`:

```js
test("worship prep page uses tighter section spacing and groups controls", async () => {
  const source = await readFile(
    new URL("../app/(authenticated)/worship-prep/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /className=["']flex flex-col gap-5["']/)
  assert.match(
    source,
    /<div className=["']space-y-4["']>[\s\S]*<Suspense fallback=\{<WorshipDateSelectorFallback \/>\}>[\s\S]*<WorshipDateSelector \/>[\s\S]*<\/Suspense>[\s\S]*<PrepAutomationPanel \/>[\s\S]*<\/div>/,
  )
  assert.doesNotMatch(source, /<WorshipDateSelector selectedDate=\{selectedDate\} \/>/)
  assert.doesNotMatch(source, /<WorshipDateSelector defaultDate=\{defaultDate\} \/>/)
})
```

- [ ] **Step 3: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/worship-prep-source.test.mjs tests/worship-prep-phase2-source.test.mjs
```

Expected: FAIL. The current page still renders `<WorshipDateSelector selectedDate={selectedDate} />`, does not define `WorshipDateSelectorFallback`, and the selector does not compute its own default date.

- [ ] **Step 4: `WorshipDateSelector`를 URL query 기반으로 수정**

Replace `components/worship-prep/worship-date-selector.tsx` with:

```tsx
"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DatePicker } from "@/components/ui/date-picker"
import { getDefaultWorshipPrepIsoDate } from "@/lib/worship-prep/default-date"

function normalizeDate(value: string | null, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  return fallback
}

export function WorshipDateSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedDate = normalizeDate(searchParams.get("date"), getDefaultWorshipPrepIsoDate())

  function handleChange(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", nextDate)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-xs">
      <DatePicker value={selectedDate} onChange={handleChange} className="h-9" />
    </div>
  )
}
```

- [ ] **Step 5: `page.tsx`가 selector에 local fallback을 제공하도록 최소 수정**

Add imports to `app/(authenticated)/worship-prep/page.tsx`:

```ts
import { Suspense } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
```

Modify the top of `app/(authenticated)/worship-prep/page.tsx` so `normalizeDate()` accepts a fallback:

```ts
function normalizeDate(value: string | undefined, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return fallback;
}
```

Add this selector fallback below `normalizeDate()`:

```tsx
function WorshipDateSelectorFallback() {
  return (
    <div className="w-full max-w-xs">
      <Button disabled variant="outline" className="h-9 w-full justify-start font-normal">
        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} data-icon="inline-start" />
        날짜 선택
      </Button>
    </div>
  );
}
```

Update the selector render:

```tsx
        <Suspense fallback={<WorshipDateSelectorFallback />}>
          <WorshipDateSelector />
        </Suspense>
```

Update the existing selected date calculation so the new `normalizeDate()` signature is satisfied:

```ts
  const params = await searchParams;
  const selectedDate = normalizeDate(params.date, getDefaultWorshipPrepIsoDate());
```

- [ ] **Step 6: 날짜 선택기 test 통과 확인**

Run:

```bash
pnpm test tests/worship-prep-source.test.mjs tests/worship-prep-phase2-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: commit**

Run:

```bash
git add tests/worship-prep-source.test.mjs tests/worship-prep-phase2-source.test.mjs components/worship-prep/worship-date-selector.tsx 'app/(authenticated)/worship-prep/page.tsx'
git commit -m "refactor: derive worship prep date on client"
```

---

### Task 2: 예배준비 페이지를 shell + Suspense data region으로 분리

**Files:**
- Modify: `tests/worship-prep-loading-source.test.mjs`
- Modify: `app/(authenticated)/worship-prep/page.tsx`
- Delete: `app/(authenticated)/worship-prep/loading.tsx`

- [ ] **Step 1: route-level loading test를 shell/Suspense source guard로 교체**

Replace `tests/worship-prep-loading-source.test.mjs` with:

```js
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("worship prep page renders a stable shell and moves data loading under Suspense", async () => {
  const source = await read("app/(authenticated)/worship-prep/page.tsx")

  assert.match(source, /import \{[^}]*\bSuspense\b[^}]*\} from ["']react["']/)
  assert.match(source, /import \{[^}]*\bcache\b[^}]*\} from ["']react["']/)
  assert.match(source, /function WorshipPrepCardsSkeleton/)
  assert.match(source, /function DisabledWorshipPptxExportButton/)
  assert.match(source, /const getWorshipPrepPageData = cache\(async \(/)
  assert.match(source, /async function WorshipPrepHeaderAction/)
  assert.match(source, /async function WorshipPrepDataPanel/)
  assert.match(source, /export default function WorshipPrepPage/)
  assert.doesNotMatch(source, /export default async function WorshipPrepPage/)
  assert.doesNotMatch(source, /const dataPromise = getWorshipPrepPageData\(searchParams, defaultDate\)/)
  assert.doesNotMatch(source, /const defaultDate = getDefaultWorshipPrepIsoDate\(\)/)
  assert.match(source, /const params = await searchParams;[\s\S]*getDefaultWorshipPrepIsoDate\(\)/)
  assert.match(source, /<WorshipDateSelector \/>/)
  assert.doesNotMatch(source, /<WorshipDateSelector defaultDate=\{defaultDate\} \/>/)
  assert.match(source, /<PrepAutomationPanel \/>/)
  assert.match(source, /<Suspense fallback=\{<DisabledWorshipPptxExportButton \/>\}>/)
  assert.match(source, /<WorshipPrepHeaderAction searchParams=\{searchParams\} \/>/)
  assert.match(source, /<Suspense fallback=\{<WorshipPrepCardsSkeleton \/>\}>/)
  assert.match(source, /<WorshipPrepDataPanel searchParams=\{searchParams\} \/>/)
  assert.match(source, /Array\.from\(\{ length: 6 \}\)/)
  assert.match(source, /data-slot="worship-prep-cards-loading"/)
  assert.match(source, /<Button disabled>/)
})

test("worship prep route no longer has a route-level full page loading fallback", async () => {
  await assert.rejects(
    access(new URL("../app/(authenticated)/worship-prep/loading.tsx", import.meta.url), constants.F_OK),
    /ENOENT/,
  )
})
```

- [ ] **Step 2: test가 실패하는지 확인**

Run:

```bash
pnpm test tests/worship-prep-loading-source.test.mjs
```

Expected: FAIL. The current page does not define the new shell/data components, and `loading.tsx` still exists.

- [ ] **Step 3: `page.tsx`를 shell + data region 구조로 교체**

Replace `app/(authenticated)/worship-prep/page.tsx` with:

```tsx
import { Suspense, cache } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon, FileExportIcon } from '@hugeicons/core-free-icons';
import { PageHeader } from '@/components/layout/page-header';
import { PrepAutomationPanel } from '@/components/worship-prep/prep-automation-panel';
import { PrepElementCards } from '@/components/worship-prep/prep-element-cards';
import { WorshipDateSelector } from '@/components/worship-prep/worship-date-selector';
import { WorshipPptxExportButton } from '@/components/worship-prep/worship-pptx-export-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getWorshipPrepDetail, type WorshipPrepSummary } from '@/lib/queries/worship-prep';
import { getConti, getContiByDate, getContis } from '@/lib/queries/contis';
import { getDefaultWorshipPrepIsoDate } from '@/lib/worship-prep/default-date';
import type { Conti, ContiWithSongs } from '@/lib/types';

type WorshipPrepSearchParams = Promise<{ date?: string }>;

interface WorshipPrepPageData {
  item: WorshipPrepSummary | null;
  conti: Conti | null;
  contis: Conti[];
  defaultConti: ContiWithSongs | null;
}

function normalizeDate(value: string | undefined, fallback: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return fallback;
}

function WorshipDateSelectorFallback() {
  return (
    <div className="w-full max-w-xs">
      <Button disabled variant="outline" className="h-9 w-full justify-start font-normal">
        <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} data-icon="inline-start" />
        날짜 선택
      </Button>
    </div>
  );
}

const getWorshipPrepPageData = cache(async (
  searchParams: WorshipPrepSearchParams,
): Promise<WorshipPrepPageData> => {
  const params = await searchParams;
  const selectedDate = normalizeDate(params.date, getDefaultWorshipPrepIsoDate());
  const [item, conti, contis] = await Promise.all([
    getWorshipPrepDetail(selectedDate),
    getContiByDate(selectedDate),
    getContis(),
  ]);
  const defaultConti = conti ? await getConti(conti.id) : null;

  return {
    item,
    conti,
    contis,
    defaultConti,
  };
});

function DisabledWorshipPptxExportButton() {
  return (
    <Button disabled>
      <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
      예배 PPT 내보내기
    </Button>
  );
}

async function WorshipPrepHeaderAction({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  const { item, contis, defaultConti } = await getWorshipPrepPageData(searchParams);

  if (!item) {
    return <DisabledWorshipPptxExportButton />;
  }

  return (
    <WorshipPptxExportButton
      item={item}
      contis={contis}
      defaultConti={defaultConti}
    />
  );
}

function WorshipPrepCardsSkeleton() {
  return (
    <div
      data-slot="worship-prep-cards-loading"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

async function WorshipPrepDataPanel({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  const { item, conti } = await getWorshipPrepPageData(searchParams);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-base text-muted-foreground">선택한 주차 데이터가 없습니다</p>
      </div>
    );
  }

  return <PrepElementCards item={item} conti={conti} />;
}

export default function WorshipPrepPage({
  searchParams,
}: {
  searchParams: WorshipPrepSearchParams;
}) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="예배 준비" description="가장 가까운 일요일 1주차를 기본으로 조회합니다">
        <Suspense fallback={<DisabledWorshipPptxExportButton />}>
          <WorshipPrepHeaderAction searchParams={searchParams} />
        </Suspense>
      </PageHeader>
      <div className="space-y-4">
        <Suspense fallback={<WorshipDateSelectorFallback />}>
          <WorshipDateSelector />
        </Suspense>
        <PrepAutomationPanel />
      </div>
      <Suspense fallback={<WorshipPrepCardsSkeleton />}>
        <WorshipPrepDataPanel searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: route-level loading 파일 제거**

Delete `app/(authenticated)/worship-prep/loading.tsx` with an explicit file deletion patch:

```diff
*** Begin Patch
*** Delete File: app/(authenticated)/worship-prep/loading.tsx
*** End Patch
```

- [ ] **Step 5: shell loading test 통과 확인**

Run:

```bash
pnpm test tests/worship-prep-loading-source.test.mjs
```

Expected: PASS.

- [ ] **Step 6: 관련 worship source tests 통과 확인**

Run:

```bash
pnpm test tests/worship-prep-source.test.mjs tests/worship-prep-phase2-source.test.mjs tests/worship-prep-loading-source.test.mjs tests/worship-prep-default-date.test.ts tests/cache-worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 7: commit**

Run:

```bash
git add tests/worship-prep-loading-source.test.mjs 'app/(authenticated)/worship-prep/page.tsx' 'app/(authenticated)/worship-prep/loading.tsx'
git commit -m "refactor: keep worship prep shell visible while loading"
```

---

### Task 3: 통합 검증과 빌드 확인

**Files:**
- Modify only if verification exposes compile issues.

- [ ] **Step 1: 예배준비 관련 tests 실행**

Run:

```bash
pnpm test tests/worship-prep-source.test.mjs tests/worship-prep-phase2-source.test.mjs tests/worship-prep-loading-source.test.mjs tests/worship-prep-default-date.test.ts tests/cache-worship-prep-source.test.mjs
```

Expected: PASS.

- [ ] **Step 2: 전체 test 실행**

Run:

```bash
env PYTHON=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 pnpm test
```

Expected: PASS.

Note: default `python3` may not have `lxml` / `pptx`; use the bundled Python path above for the full suite.

- [ ] **Step 3: typecheck 실행**

Run:

```bash
pnpm exec tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 4: lint 실행**

Run:

```bash
pnpm lint
```

Expected: PASS with no errors. Existing warnings are acceptable if unchanged.

- [ ] **Step 5: production build 실행**

Run:

```bash
pnpm build
```

Expected: PASS.

If sandbox network blocks Google Fonts, rerun with network approval. A Google Fonts fetch failure is environmental; a Cache Components / TypeScript compile failure must be fixed.

- [ ] **Step 6: final diff check**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and clean worktree after commits.

---

## 자체 리뷰 체크리스트

- Spec coverage: shell 즉시 표시, 카드 영역 skeleton, disabled PPT button, route-level loading 제거, 기존 cache TTL 유지가 Task 1-3에 매핑되어 있다.
- Placeholder scan: 구현 단계에 미정 항목 없이 실제 test code, page code, selector code, 검증 명령을 포함했다.
- Type consistency: `WorshipPrepPageData`, `WorshipPrepSearchParams`, `searchParams`, `getWorshipPrepPageData` 이름이 task 전반에서 일관된다.
- Parallel safety: 구현 파일이 겹치므로 worker 구현은 순차 실행한다. 리뷰와 최종 검증은 병렬화할 수 있다.
- Verification: 관련 source tests, 전체 test, typecheck, lint, build, diff check가 포함되어 있다.
