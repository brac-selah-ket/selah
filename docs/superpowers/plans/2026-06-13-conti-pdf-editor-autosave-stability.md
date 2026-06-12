# 콘티 PDF 편집기 자동 저장 안정화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘티 PDF 편집기의 자동 저장은 유지하면서, 자동 저장 때문에 편집 화면이 재초기화되거나 새로고침처럼 보이는 문제를 없앤다.

**Architecture:** PDF layout 저장용 캐시 태그를 `conti` 태그에서 분리해 자동 저장이 콘티 서버 props를 흔들지 않게 한다. 동시에 `useAutoSave`는 디바운스와 in-flight 병합으로 중복 저장을 줄이고, `useOverlays`는 드래그 중 저장 예약을 pointer-up 한 번으로 제한한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Next cache components, Vitest source tests, Drizzle repository layer.

---

## 파일 구조

- Modify: `lib/cache/tags.ts`
  - PDF export record 전용 cache tag helper를 추가한다.
- Modify: `lib/cache/invalidation.ts`
  - PDF export record 전용 invalidation helper를 추가한다.
- Modify: `lib/queries/contis.ts`
  - `getContiPdfExport()`가 `conti:{id}` 대신 PDF export 전용 태그를 사용하게 한다.
- Modify: `lib/actions/conti-pdf-exports.ts`
  - layout save, PDF export, delete action이 broad conti invalidation과 `/contis` path revalidation을 하지 않게 한다.
- Modify: `components/contis/pdf-export/hooks/use-auto-save.ts`
  - 첫 autosave 즉시 실행을 제거하고, 저장 중 추가 요청을 최신 snapshot 한 번으로 병합한다.
- Modify: `components/contis/pdf-export/hooks/use-overlays.ts`
  - overlay drag 중에는 local state만 갱신하고 pointer-up에서 autosave를 한 번 예약한다.
- Modify: `tests/cache-infrastructure-source.test.mjs`
  - 새 cache tag/helper 존재를 검증한다.
- Modify: `tests/cache-contis-source.test.mjs`
  - PDF export query/action의 cache invalidation 경계를 검증한다.
- Create: `tests/conti-pdf-editor-autosave-source.test.mjs`
  - autosave scheduling과 overlay drag 저장 빈도를 source-level로 검증한다.

## Task 1: PDF Export Cache Boundary Tests

**Files:**
- Modify: `tests/cache-infrastructure-source.test.mjs`
- Modify: `tests/cache-contis-source.test.mjs`

- [ ] **Step 1: `tests/cache-infrastructure-source.test.mjs`에 PDF export tag 기대값 추가**

`cache tag helpers define stable storyboard tags` 테스트의 `expected` 배열을 다음처럼 바꾼다.

```js
  for (const expected of [
    'songs',
    'song:',
    'song-presets:',
    'contis',
    'conti:',
    'conti-by-date:',
    'conti-pdf-export:',
    'worship-prep:',
    'worship-prep-list',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
```

- [ ] **Step 2: `tests/cache-infrastructure-source.test.mjs`에 invalidation helper 기대값 추가**

`invalidation helpers use immediate action and route invalidation APIs` 테스트의 마지막 assertion 묶음을 다음처럼 만든다.

```js
  assert.match(source, /invalidateSong/);
  assert.match(source, /invalidateConti/);
  assert.match(source, /invalidateContiPdfExport/);
  assert.match(source, /invalidateWorshipPrepDate/);
```

- [ ] **Step 3: `tests/cache-contis-source.test.mjs`의 query tag 기대값 변경**

`conti queries use next cache tags and hourly cache life` 테스트 안의 `getContiPdfExport` 항목을 다음처럼 바꾼다.

```js
    ['getContiPdfExport', /cacheTag\(cacheTags\.contiPdfExport\(contiId\)\)/],
```

- [ ] **Step 4: `tests/cache-contis-source.test.mjs`의 PDF export mutation 테스트 교체**

기존 `conti pdf export mutations invalidate related conti tags` 테스트 전체를 아래 테스트로 교체한다.

```js
test('conti pdf export mutations invalidate only pdf export tags', async () => {
  const source = await read('lib/actions/conti-pdf-exports.ts');

  assert.match(source, /import \{ invalidateContiPdfExport \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.doesNotMatch(source, /import \{ invalidateConti \} from ['"]@\/lib\/cache\/invalidation['"]/);

  const saveBody = getFunctionBody(source, 'saveContiPdfLayout');
  assert.match(saveBody, /invalidateContiPdfExport\(contiId\)/);
  assert.doesNotMatch(saveBody, /invalidateConti\(contiId\)/);
  assert.doesNotMatch(saveBody, /revalidatePath\(['"]\/contis['"]\)/);

  const exportBody = getFunctionBody(source, 'exportContiPdf');
  assert.match(exportBody, /invalidateContiPdfExport\(contiId\)/);
  assert.doesNotMatch(exportBody, /invalidateConti\(contiId\)/);
  assert.doesNotMatch(exportBody, /revalidatePath\(['"]\/contis['"]\)/);

  const deleteBody = getFunctionBody(source, 'deleteContiPdfExport');
  assert.match(deleteBody, /invalidateContiPdfExport\(existing\.contiId\)/);
  assert.doesNotMatch(deleteBody, /invalidateConti\(existing\.contiId\)/);
  assert.doesNotMatch(deleteBody, /revalidatePath\(['"]\/contis['"]\)/);
});
```

- [ ] **Step 5: Cache boundary tests가 실패하는지 확인**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs tests/cache-contis-source.test.mjs
```

Expected: FAIL. 실패 메시지는 `conti-pdf-export:`, `invalidateContiPdfExport`, `cacheTags.contiPdfExport`, `invalidateContiPdfExport(contiId)` 중 아직 구현되지 않은 패턴을 가리켜야 한다.

## Task 2: PDF Export Cache Boundary Implementation

**Files:**
- Modify: `lib/cache/tags.ts`
- Modify: `lib/cache/invalidation.ts`
- Modify: `lib/queries/contis.ts`
- Modify: `lib/actions/conti-pdf-exports.ts`
- Test: `tests/cache-infrastructure-source.test.mjs`
- Test: `tests/cache-contis-source.test.mjs`

- [ ] **Step 1: `lib/cache/tags.ts`에 PDF export tag helper 추가**

`cacheTags` 객체를 다음 형태로 만든다. 기존 key 순서는 유지하되 `contiPdfExport`를 `contiByDate` 바로 뒤에 둔다.

```ts
export const cacheTags = {
  songs: () => 'songs',
  song: (songId: string) => `song:${songId}`,
  songPresets: (songId: string) => `song-presets:${songId}`,
  contis: () => 'contis',
  conti: (contiId: string) => `conti:${contiId}`,
  contiByDate: (date: string) => `conti-by-date:${date}`,
  contiPdfExport: (contiId: string) => `conti-pdf-export:${contiId}`,
  worshipPrep: (date: string) => `worship-prep:${date}`,
  worshipPrepList: () => 'worship-prep-list',
};
```

- [ ] **Step 2: `lib/cache/invalidation.ts`에 PDF export invalidation helper 추가**

`invalidateContiDate` 아래에 다음 함수를 추가한다.

```ts
export function invalidateContiPdfExport(contiId: string) {
  updateCacheTags(cacheTags.contiPdfExport(contiId));
}
```

- [ ] **Step 3: `lib/queries/contis.ts`에서 PDF export query tag 변경**

`getContiPdfExport()`를 다음처럼 바꾼다.

```ts
export async function getContiPdfExport(contiId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contiPdfExport(contiId));
  return getStoryboardRepository().getContiPdfExport(contiId);
}
```

- [ ] **Step 4: `lib/actions/conti-pdf-exports.ts` import 정리**

상단 import를 다음 형태로 정리한다.

```ts
'use server';

import type { ActionResult, ContiPdfExport } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { invalidateContiPdfExport } from '@/lib/cache/invalidation';
import { deleteObject, putObject } from '@/lib/storage';
```

- [ ] **Step 5: `saveContiPdfLayout()`에서 PDF export tag만 invalidate**

성공 path를 다음처럼 바꾼다.

```ts
    const pdfExport = await getStoryboardRepository().upsertContiPdfExport(contiId, {
      layoutState,
    });
    invalidateContiPdfExport(contiId);
```

- [ ] **Step 6: `exportContiPdf()`에서 broad invalidation 제거**

PDF URL 저장 직후를 다음처럼 바꾼다.

```ts
    await repository.upsertContiPdfExport(contiId, { pdfUrl: object.url });

    invalidateContiPdfExport(contiId);
```

이 함수 안에 `invalidateConti(contiId)`와 `revalidatePath('/contis')`가 남아 있지 않아야 한다.

- [ ] **Step 7: `deleteContiPdfExport()`에서 broad invalidation 제거**

삭제 직후를 다음처럼 바꾼다.

```ts
    await repository.deleteContiPdfExport(exportId);
    invalidateContiPdfExport(existing.contiId);
```

이 함수 안에 `invalidateConti(existing.contiId)`와 `revalidatePath('/contis')`가 남아 있지 않아야 한다.

- [ ] **Step 8: Cache boundary tests 통과 확인**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs tests/cache-contis-source.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/cache/tags.ts lib/cache/invalidation.ts lib/queries/contis.ts lib/actions/conti-pdf-exports.ts tests/cache-infrastructure-source.test.mjs tests/cache-contis-source.test.mjs
git commit -m "fix: isolate conti pdf export cache invalidation"
```

## Task 3: Autosave Scheduling Source Tests

**Files:**
- Create: `tests/conti-pdf-editor-autosave-source.test.mjs`

- [ ] **Step 1: Source test 파일 생성**

`tests/conti-pdf-editor-autosave-source.test.mjs`를 아래 내용으로 생성한다.

```js
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

function sliceBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern)
  assert.notEqual(start, -1, `missing start pattern ${startPattern}`)
  const rest = source.slice(start)
  const end = rest.search(endPattern)
  assert.notEqual(end, -1, `missing end pattern ${endPattern}`)
  return rest.slice(0, end)
}

test("pdf autosave debounces first edit and collapses overlapping saves", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-auto-save.ts")

  assert.doesNotMatch(source, /lastSaveRef/)
  assert.match(source, /activeSavePromiseRef/)
  assert.match(source, /pendingSaveRef/)
  assert.match(source, /saveLatestRef/)

  const triggerBody = sliceBetween(
    source,
    /const triggerAutoSave = useCallback/,
    /,\s*\[\]\s*\);/
  )

  assert.match(triggerBody, /setTimeout/)
  assert.match(triggerBody, /3000/)
  assert.doesNotMatch(triggerBody, /Date\.now/)
  assert.doesNotMatch(triggerBody, /return;\s*\}/)
})

test("overlay dragging updates local state during move and autosaves once on pointer up", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-overlays.ts")

  assert.match(source, /hasDraggedRef/)
  assert.match(source, /updateOverlayPosition/)

  const moveBody = sliceBetween(
    source,
    /function handlePointerMove/,
    /function handlePointerUp/
  )
  assert.match(moveBody, /updateOverlayPosition\(overlayId/)
  assert.doesNotMatch(moveBody, /triggerAutoSave\(\)/)
  assert.doesNotMatch(moveBody, /updateOverlay\(overlayId/)

  const upBody = sliceBetween(
    source,
    /function handlePointerUp/,
    /return \{/
  )
  assert.match(upBody, /triggerAutoSave\(\)/)
})
```

- [ ] **Step 2: Autosave source test가 실패하는지 확인**

Run:

```bash
pnpm test tests/conti-pdf-editor-autosave-source.test.mjs
```

Expected: FAIL. 실패 메시지는 `lastSaveRef`, `activeSavePromiseRef`, `hasDraggedRef`, `updateOverlayPosition`, 또는 `triggerAutoSave()` 위치 중 아직 구현되지 않은 패턴을 가리켜야 한다.

## Task 4: Autosave Scheduler Implementation

**Files:**
- Modify: `components/contis/pdf-export/hooks/use-auto-save.ts`
- Test: `tests/conti-pdf-editor-autosave-source.test.mjs`

- [ ] **Step 1: `use-auto-save.ts`를 최신 snapshot 병합 방식으로 교체**

`components/contis/pdf-export/hooks/use-auto-save.ts` 전체를 아래 내용으로 교체한다.

```ts
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { saveContiPdfLayout } from "@/lib/actions/conti-pdf-exports";
import { syncPresetPdfMetadataFromContiLayout } from "@/lib/actions/conti-songs";
import type { PdfLayoutState } from "@/lib/types";
import type { EditorPage } from "../types";

export function useAutoSave(
  pages: EditorPage[],
  contiId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildLayoutStateRef = useRef<() => PdfLayoutState>(() => ({
    pages: [],
    canvasWidth: 800,
    canvasHeight: 1131,
  }));
  const saveLatestRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const activeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingSaveRef = useRef(false);
  const [presetSyncing, setPresetSyncing] = useState(false);

  const buildLayoutState = useCallback((): PdfLayoutState => {
    return {
      pages: pages.map((p, i) => ({
        pageIndex: i,
        songIndex: p.songIndex,
        sheetMusicFileId: p.sheetMusicFileId,
        pdfPageIndex: p.pdfPageIndex,
        overlays: p.overlays,
        imageScale: p.imageScale !== 1 ? p.imageScale : undefined,
        imageOffsetX: p.imageOffsetX !== 0 ? p.imageOffsetX : undefined,
        imageOffsetY: p.imageOffsetY !== 0 ? p.imageOffsetY : undefined,
        cropX: p.cropX ?? undefined,
        cropY: p.cropY ?? undefined,
        cropWidth: p.cropWidth ?? undefined,
        cropHeight: p.cropHeight ?? undefined,
        originalImageUrl:
          p.originalImageUrl && !p.originalImageUrl.startsWith("data:")
            ? p.originalImageUrl
            : undefined,
      })),
      canvasWidth: containerRef.current?.clientWidth ?? 800,
      canvasHeight: containerRef.current?.clientHeight ?? 1131,
    };
  }, [pages, containerRef]);

  useEffect(() => {
    buildLayoutStateRef.current = buildLayoutState;
  }, [buildLayoutState]);

  const persistLayout = useCallback(
    async (layoutState: PdfLayoutState): Promise<boolean> => {
      setSaveStatus("saving");
      const result = await saveContiPdfLayout(
        contiId,
        JSON.stringify(layoutState),
      );
      if (result.success) {
        setSaveStatus("saved");
        return true;
      }

      setSaveStatus("unsaved");
      toast.error(result.error ?? "저장 중 오류가 발생했습니다");
      return false;
    },
    [contiId],
  );

  const saveLatest = useCallback((): Promise<boolean> => {
    if (activeSavePromiseRef.current) {
      pendingSaveRef.current = true;
      setSaveStatus("unsaved");
      return activeSavePromiseRef.current;
    }

    const savePromise = (async () => {
      let allSaved = true;
      try {
        do {
          pendingSaveRef.current = false;
          const saved = await persistLayout(buildLayoutStateRef.current());
          allSaved = allSaved && saved;
          if (!saved) {
            pendingSaveRef.current = false;
          }
        } while (pendingSaveRef.current);

        return allSaved;
      } finally {
        activeSavePromiseRef.current = null;
      }
    })();

    activeSavePromiseRef.current = savePromise;
    return savePromise;
  }, [persistLayout]);

  useEffect(() => {
    saveLatestRef.current = async () => {
      await saveLatest();
    };
  }, [saveLatest]);

  const performSave = useCallback(async () => {
    await saveLatest();
  }, [saveLatest]);

  const triggerAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveLatestRef.current();
    }, 3000);
  }, []);

  async function handleManualSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const saved = await saveLatest();
    if (!saved) return;

    toast.success("레이아웃이 저장되었습니다");
  }

  async function handlePresetSyncSave() {
    const layoutState = buildLayoutState();
    setPresetSyncing(true);

    try {
      const layoutStateText = JSON.stringify(layoutState);
      const syncResult = await syncPresetPdfMetadataFromContiLayout(
        contiId,
        layoutStateText,
      );

      if (!syncResult.success) {
        toast.warning(syncResult.error ?? "프리셋 동기화 중 오류가 발생했습니다");
        return;
      }

      const updatedPresetCount = syncResult.data?.updatedPresetCount ?? 0;
      if (updatedPresetCount > 0) {
        toast.success(`프리셋 ${updatedPresetCount}개가 업데이트되었습니다`);
        return;
      }

      toast.info("연결된 프리셋이 없어 업데이트할 항목이 없습니다");
    } finally {
      setPresetSyncing(false);
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === "unsaved") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  return {
    saveStatus,
    triggerAutoSave,
    performSave,
    handleManualSave,
    handlePresetSyncSave,
    presetSyncing,
  };
}
```

- [ ] **Step 2: Autosave source test 통과 확인**

Run:

```bash
pnpm test tests/conti-pdf-editor-autosave-source.test.mjs
```

Expected: `pdf autosave debounces first edit and collapses overlapping saves` PASS, overlay drag 테스트는 아직 FAIL이어야 한다.

- [ ] **Step 3: Commit**

```bash
git add components/contis/pdf-export/hooks/use-auto-save.ts tests/conti-pdf-editor-autosave-source.test.mjs
git commit -m "fix: debounce conti pdf autosave"
```

## Task 5: Overlay Drag Autosave Implementation

**Files:**
- Modify: `components/contis/pdf-export/hooks/use-overlays.ts`
- Test: `tests/conti-pdf-editor-autosave-source.test.mjs`

- [ ] **Step 1: `use-overlays.ts`를 drag 중 local update 방식으로 교체**

`components/contis/pdf-export/hooks/use-overlays.ts` 전체를 아래 내용으로 교체한다.

```ts
import { useState, useRef } from "react";
import { nanoid } from "nanoid";
import { buildDefaultOverlays } from "@/lib/utils/pdf-export-helpers";
import type { OverlayElement } from "@/lib/types";
import type { EditorPage } from "../types";

export function useOverlays(
  pages: EditorPage[],
  setPages: React.Dispatch<React.SetStateAction<EditorPage[]>>,
  currentPageIndex: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  triggerAutoSave: () => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  function updateOverlay(overlayId: string, updates: Partial<OverlayElement>) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return {
          ...page,
          overlays: page.overlays.map((o) =>
            o.id === overlayId ? { ...o, ...updates } : o,
          ),
        };
      }),
    );
    triggerAutoSave();
  }

  function updateOverlayPosition(
    overlayId: string,
    updates: Pick<OverlayElement, "x" | "y">,
  ) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return {
          ...page,
          overlays: page.overlays.map((o) =>
            o.id === overlayId ? { ...o, ...updates } : o,
          ),
        };
      }),
    );
  }

  function addCustomOverlay() {
    const newOverlay: OverlayElement = {
      id: nanoid(),
      type: "custom",
      text: "텍스트",
      x: 50,
      y: 50,
      fontSize: 16,
      color: "#000000",
    };
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return { ...page, overlays: [...page.overlays, newOverlay] };
      }),
    );
    triggerAutoSave();
  }

  function deleteOverlay(overlayId: string) {
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        return {
          ...page,
          overlays: page.overlays.filter((o) => o.id !== overlayId),
        };
      }),
    );
    setSelectedOverlayId(null);
    triggerAutoSave();
  }

  function resetOverlaysToDefault(
    songIndex: number,
    sectionOrder: string[],
    tempos: number[],
  ) {
    const defaults = buildDefaultOverlays(songIndex, sectionOrder, tempos);
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== currentPageIndex) return page;
        const customOverlays = page.overlays.filter(
          (o) => o.type === "custom",
        );
        return { ...page, overlays: [...defaults, ...customOverlays] };
      }),
    );
    triggerAutoSave();
  }

  function handlePointerDown(e: React.PointerEvent, overlayId: string) {
    e.stopPropagation();

    if ((e.target as HTMLElement).isContentEditable) return;

    e.preventDefault();
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const overlay = pages[currentPageIndex]?.overlays.find(
      (o) => o.id === overlayId,
    );
    if (!overlay) return;

    const overlayPxX = (overlay.x / 100) * rect.width;
    const overlayPxY = (overlay.y / 100) * rect.height;
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    dragOffsetRef.current = {
      x: pointerX - overlayPxX,
      y: pointerY - overlayPxY,
    };
    setDraggingId(overlayId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, overlayId: string) {
    if (draggingId !== overlayId) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const x =
      ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
    const y =
      ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;

    hasDraggedRef.current = true;
    updateOverlayPosition(overlayId, {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }

  function handlePointerUp(e: React.PointerEvent, overlayId: string) {
    if (draggingId === overlayId) {
      setDraggingId(null);
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 5) {
        setSelectedOverlayId(overlayId);
      } else if (hasDraggedRef.current) {
        triggerAutoSave();
      }

      hasDraggedRef.current = false;
    }
  }

  return {
    draggingId,
    selectedOverlayId,
    setSelectedOverlayId,
    updateOverlay,
    addCustomOverlay,
    deleteOverlay,
    resetOverlaysToDefault,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
```

- [ ] **Step 2: Autosave source test 전체 통과 확인**

Run:

```bash
pnpm test tests/conti-pdf-editor-autosave-source.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/contis/pdf-export/hooks/use-overlays.ts tests/conti-pdf-editor-autosave-source.test.mjs
git commit -m "fix: save overlay drag after pointer up"
```

## Task 6: Full Verification

**Files:**
- Verify only. No planned file edits.

- [ ] **Step 1: Targeted tests 실행**

Run:

```bash
pnpm test tests/cache-infrastructure-source.test.mjs tests/cache-contis-source.test.mjs tests/conti-pdf-editor-autosave-source.test.mjs
```

Expected: PASS.

- [ ] **Step 2: 전체 source/unit test 실행**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Lint 실행**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: 수동 확인**

Run:

```bash
pnpm dev
```

Expected: dev server starts at `http://localhost:3000`.

브라우저에서 다음을 확인한다.

1. 콘티 상세에서 PDF 내보내기 편집 화면을 연다.
2. 텍스트 overlay를 10초 이상 반복해서 드래그한다.
3. 편집 화면이 loading skeleton으로 돌아가지 않는다.
4. 현재 페이지 번호가 초기화되지 않는다.
5. overlay 위치가 이전 저장 상태로 튀지 않는다.
6. 저장 상태가 최종적으로 `저장됨`이 된다.
7. 브라우저를 수동 새로고침하면 마지막 layout이 복원된다.
8. `프리셋 다시 적용`을 누르면 이 명시적 동작에서만 layout이 재구성된다.

- [ ] **Step 5: 최종 상태 확인**

Run:

```bash
git status --short
```

Expected: no unstaged files after all intended commits.
