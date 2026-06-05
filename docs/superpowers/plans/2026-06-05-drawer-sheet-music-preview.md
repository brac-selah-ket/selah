# Drawer 악보 미리보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘티 곡 편집 drawer에서 악보를 좌측 큰 preview pane으로 보여주고, 중첩 preview modal이 닫히지 않는 문제를 제거한다.

**Architecture:** `DialogContent`에는 재사용 가능한 `size` prop을 추가하되 기본 크기는 유지한다. Drawer context에는 `default | wide` 크기 상태를 추가하고, 콘티 곡 편집 흐름만 wide drawer를 사용한다. `SheetMusicGallery`는 기본 dialog preview 모드를 유지하면서, drawer에서는 controlled preview 모드로 전환한다. 현재 `sheetMusicManagementSlot`이 `ReactNode`라 gallery를 생성하는 `ContiSongEditor`가 preview item state를 보관하고, `ArrangementEditor`는 그 item을 받아 큰 preview pane의 배치와 렌더링만 담당한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Base UI Dialog, Node test runner source-level tests.

---

## 파일 구조

- Modify: `tests/worship-prep-source.test.mjs`
  - 기존 source-level 테스트 스타일을 따라 drawer preview 구조를 검증한다.
- Modify: `components/ui/dialog.tsx`
  - `DialogContent`에 `size` prop과 semantic width mapping을 추가한다.
- Modify: `components/ui/drawer-context.tsx`
  - drawer open state와 함께 drawer size state를 보관한다.
- Modify: `components/ui/drawer.tsx`
  - `size?: "default" | "wide"` prop을 받아 context에 동기화한다.
- Modify: `components/layout/app-shell.tsx`
  - drawer size에 따라 desktop drawer width class를 바꾼다.
- Create: `components/shared/sheet-music-preview.tsx`
  - 큰 preview pane과 preview item type을 제공한다.
- Modify: `components/songs/sheet-music-gallery.tsx`
  - 기본 dialog preview와 drawer controlled preview를 모두 지원한다.
- Modify: `components/shared/arrangement-editor/types.ts`
  - `ArrangementEditor`에 optional preview item prop을 추가한다.
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
  - desktop 좌측 preview pane과 mobile inline preview를 렌더링한다.
- Modify: `components/contis/conti-song-editor.tsx`
  - preview state를 소유하고 `SheetMusicGallery`를 controlled preview 모드로 연결한다.

---

### Task 1: 실패 테스트 작성

**Files:**
- Modify: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: drawer 악보 preview source-level 테스트를 추가한다**

`tests/worship-prep-source.test.mjs` 끝에 다음 테스트를 추가한다.

```js
test('conti song drawer uses wide controlled sheet music preview instead of nested preview dialog', async () => {
  const dialogSource = await readFile(
    new URL('../components/ui/dialog.tsx', import.meta.url),
    'utf8',
  );
  const drawerContextSource = await readFile(
    new URL('../components/ui/drawer-context.tsx', import.meta.url),
    'utf8',
  );
  const drawerSource = await readFile(
    new URL('../components/ui/drawer.tsx', import.meta.url),
    'utf8',
  );
  const appShellSource = await readFile(
    new URL('../components/layout/app-shell.tsx', import.meta.url),
    'utf8',
  );
  const previewSource = await readFile(
    new URL('../components/shared/sheet-music-preview.tsx', import.meta.url),
    'utf8',
  );
  const gallerySource = await readFile(
    new URL('../components/songs/sheet-music-gallery.tsx', import.meta.url),
    'utf8',
  );
  const arrangementTypesSource = await readFile(
    new URL('../components/shared/arrangement-editor/types.ts', import.meta.url),
    'utf8',
  );
  const arrangementSource = await readFile(
    new URL('../components/shared/arrangement-editor/arrangement-editor.tsx', import.meta.url),
    'utf8',
  );
  const contiSongEditorSource = await readFile(
    new URL('../components/contis/conti-song-editor.tsx', import.meta.url),
    'utf8',
  );

  assert.match(dialogSource, /type DialogContentSize = "sm" \| "md" \| "lg" \| "xl" \| "full"/);
  assert.match(dialogSource, /size = "sm"/);
  assert.match(dialogSource, /data-size=\{size\}/);
  assert.match(dialogSource, /dialogContentSizeClassName\[size\]/);

  assert.match(drawerContextSource, /export type DrawerSize = "default" \| "wide"/);
  assert.match(drawerContextSource, /drawerSize/);
  assert.match(drawerContextSource, /setDrawerSize/);
  assert.match(drawerSource, /size = "default"/);
  assert.match(drawerSource, /setDrawerSize\(open \? size : "default"\)/);
  assert.match(appShellSource, /drawerSize === "wide"/);
  assert.match(appShellSource, /md:w-\[min\(1040px,calc\(100vw-11\.25rem\)\)\]/);

  assert.match(previewSource, /export interface SheetMusicPreviewItem/);
  assert.match(previewSource, /export function SheetMusicPreviewPane/);
  assert.match(previewSource, /data-slot="sheet-music-preview-pane"/);

  assert.match(gallerySource, /previewMode = "dialog"/);
  assert.match(gallerySource, /previewMode\?: "dialog" \| "controlled"/);
  assert.match(gallerySource, /onPreviewChange\?: \(item: SheetMusicPreviewItem \| null\) => void/);
  assert.match(gallerySource, /previewMode === "controlled"/);
  assert.match(gallerySource, /previewMode === "dialog" &&/);
  assert.match(gallerySource, /<DialogContent size="xl"/);

  assert.match(arrangementTypesSource, /sheetMusicPreviewItem\?: SheetMusicPreviewItem \| null/);
  assert.match(arrangementSource, /SheetMusicPreviewPane/);
  assert.match(arrangementSource, /hasDrawerPreview/);
  assert.match(arrangementSource, /size=\{hasDrawerPreview \? "wide" : "default"\}/);
  assert.match(arrangementSource, /md:grid-cols-\[minmax\(320px,0\.9fr\)_minmax\(360px,1fr\)\]/);

  assert.match(contiSongEditorSource, /useState<SheetMusicPreviewItem \| null>\(null\)/);
  assert.match(contiSongEditorSource, /previewMode="controlled"/);
  assert.match(contiSongEditorSource, /onPreviewChange=\{setSheetMusicPreviewItem\}/);
  assert.match(contiSongEditorSource, /sheetMusicPreviewItem=\{sheetMusicPreviewItem\}/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: 새 테스트가 실패한다. 대표 실패 메시지는 `components/shared/sheet-music-preview.tsx` 파일이 없거나 `DialogContentSize` 패턴을 찾지 못한다는 내용이다.

- [ ] **Step 3: 실패 테스트만 커밋한다**

```bash
git add tests/worship-prep-source.test.mjs
git commit -m "test: cover drawer sheet music preview"
```

---

### Task 2: DialogContent size prop 추가

**Files:**
- Modify: `components/ui/dialog.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: `DialogContent`에 semantic size mapping을 추가한다**

`components/ui/dialog.tsx`에서 `DialogClose` 함수 아래에 다음 type과 mapping을 추가한다.

```ts
type DialogContentSize = "sm" | "md" | "lg" | "xl" | "full"

const dialogContentSizeClassName: Record<DialogContentSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-5xl",
  full: "!h-[100dvh] !w-screen !max-w-none rounded-none sm:!max-w-none",
}
```

- [ ] **Step 2: `DialogContent` signature와 className 병합을 수정한다**

`DialogContent` destructuring과 props type을 다음 형태로 바꾼다.

```tsx
function DialogContent({
  className,
  overlayClassName,
  children,
  showCloseButton = true,
  size = "sm",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  overlayClassName?: string
  size?: DialogContentSize
}) {
```

`DialogPrimitive.Popup`에는 `data-size`와 size class를 추가하고, 기본 class에서 기존 `sm:max-w-sm`만 제거한다.

```tsx
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-size={size}
        className={cn(
          "bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-base ring-1 duration-100 fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
          dialogContentSizeClassName[size],
          className
        )}
        {...props}
      >
```

- [ ] **Step 3: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: 아직 drawer/preview 관련 패턴이 구현되지 않았으므로 테스트는 계속 실패한다. `DialogContentSize`, `size = "sm"`, `data-size={size}` 관련 assertion은 통과해야 한다.

- [ ] **Step 4: DialogContent 변경을 커밋한다**

```bash
git add components/ui/dialog.tsx
git commit -m "feat: add dialog content size prop"
```

---

### Task 3: wide drawer 상태 추가

**Files:**
- Modify: `components/ui/drawer-context.tsx`
- Modify: `components/ui/drawer.tsx`
- Modify: `components/layout/app-shell.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: drawer context에 size state를 추가한다**

`components/ui/drawer-context.tsx`를 다음 구조로 수정한다.

```tsx
"use client"

import { createContext, useCallback, useContext, useState } from "react"

export type DrawerSize = "default" | "wide"

interface DrawerContextValue {
  portalRef: React.RefCallback<HTMLDivElement>
  portalNode: HTMLDivElement | null
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  drawerSize: DrawerSize
  setDrawerSize: (size: DrawerSize) => void
}

const DrawerContext = createContext<DrawerContextValue | null>(null)

export function useDrawerPortal() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error("useDrawerPortal must be used within DrawerProvider")
  return ctx
}

export function useOptionalDrawerState() {
  const ctx = useContext(DrawerContext)
  return {
    isOpen: ctx?.isOpen ?? false,
    drawerSize: ctx?.drawerSize ?? "default",
  }
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [portalNode, setPortalNode] = useState<HTMLDivElement | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [drawerSize, setDrawerSize] = useState<DrawerSize>("default")
  const portalRef = useCallback((node: HTMLDivElement | null) => {
    setPortalNode(node)
  }, [])

  return (
    <DrawerContext.Provider value={{
      portalRef,
      portalNode,
      isOpen,
      setIsOpen,
      drawerSize,
      setDrawerSize,
    }}>
      {children}
    </DrawerContext.Provider>
  )
}
```

- [ ] **Step 2: `Drawer`가 size prop을 context에 동기화하도록 수정한다**

`components/ui/drawer.tsx`에서 import와 props를 수정한다.

```tsx
import { useDrawerPortal, type DrawerSize } from "./drawer-context";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  onBeforeClose?: () => boolean;
  title: string;
  size?: DrawerSize;
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

`Drawer` destructuring과 context destructuring을 다음처럼 바꾼다.

```tsx
export function Drawer({
  open,
  onClose,
  onBeforeClose,
  title,
  size = "default",
  footer,
  children,
}: DrawerProps) {
  const { portalNode, setIsOpen, setDrawerSize } = useDrawerPortal();
```

open state sync effect와 cleanup effect를 다음처럼 바꾼다.

```tsx
  useEffect(() => {
    setIsOpen(open);
    setDrawerSize(open ? size : "default");
  }, [open, setDrawerSize, setIsOpen, size]);

  useEffect(() => {
    return () => {
      setIsOpen(false);
      setDrawerSize("default");
    };
  }, [setDrawerSize, setIsOpen]);
```

- [ ] **Step 3: AppShell이 drawer size별 width를 적용하도록 수정한다**

`components/layout/app-shell.tsx`에서 context destructuring과 width class를 추가한다.

```tsx
function AppShellInner({ children }: { children: React.ReactNode }) {
  const { portalRef, isOpen, drawerSize } = useDrawerPortal();
  const { setIsOpen: setNavOpen } = useMobileNav();
  const drawerWidthClassName = drawerSize === "wide"
    ? "md:w-[min(1040px,calc(100vw-11.25rem))] xl:w-[min(1120px,calc(100vw-11.25rem))]"
    : "md:w-[min(640px,76vw)] xl:w-[40%]";
```

기존 open width class를 다음처럼 바꾼다.

```tsx
          isOpen ? cn("md:z-[60]", drawerWidthClassName) : "md:z-auto md:w-0 md:border-l-0",
```

- [ ] **Step 4: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: drawer size 관련 assertion은 통과하고, preview component/gallery/arrangement 연결 assertion은 아직 실패한다.

- [ ] **Step 5: wide drawer 변경을 커밋한다**

```bash
git add components/ui/drawer-context.tsx components/ui/drawer.tsx components/layout/app-shell.tsx
git commit -m "feat: support wide drawer layout"
```

---

### Task 4: 큰 악보 preview component 추가

**Files:**
- Create: `components/shared/sheet-music-preview.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: preview item type과 pane component를 만든다**

`components/shared/sheet-music-preview.tsx`를 생성한다.

```tsx
"use client"

import type { SheetMusicFile } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SheetMusicPreviewItem {
  file: SheetMusicFile
  thumbnailUrl: string | null
  pdfPage: number | null
  pdfTotalPages: number | null
}

export function getSheetMusicPreviewKey(item: SheetMusicPreviewItem) {
  return `${item.file.id}-${item.pdfPage ?? "img"}`
}

export function getSheetMusicPreviewLabel(item: SheetMusicPreviewItem) {
  if (item.pdfPage != null) {
    return `${item.file.fileName} - ${item.pdfPage}페이지`
  }

  return item.file.fileName
}

interface SheetMusicPreviewPaneProps {
  item: SheetMusicPreviewItem | null
  className?: string
}

export function SheetMusicPreviewPane({
  item,
  className,
}: SheetMusicPreviewPaneProps) {
  return (
    <section
      data-slot="sheet-music-preview-pane"
      className={cn(
        "rounded-lg border bg-background/70 p-3",
        className,
      )}
    >
      {item ? (
        <div className="space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {getSheetMusicPreviewLabel(item)}
            </p>
            {item.pdfPage != null && item.pdfTotalPages != null && item.pdfTotalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                {item.pdfPage}/{item.pdfTotalPages}페이지
              </p>
            )}
          </div>
          <div className="overflow-hidden rounded-md border bg-muted/20">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={getSheetMusicPreviewLabel(item)}
                className="mx-auto h-auto max-h-[calc(100vh-12rem)] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[1/1.414] w-full items-center justify-center bg-muted">
                <span className="text-sm text-muted-foreground">악보 불러오는 중...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex aspect-[1/1.414] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
          <span className="text-sm text-muted-foreground">
            미리볼 악보를 선택하세요.
          </span>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: preview component 관련 assertion은 통과하고, gallery/arrangement 연결 assertion은 아직 실패한다.

- [ ] **Step 3: preview component를 커밋한다**

```bash
git add components/shared/sheet-music-preview.tsx
git commit -m "feat: add sheet music preview pane"
```

---

### Task 5: SheetMusicGallery controlled preview 모드 추가

**Files:**
- Modify: `components/songs/sheet-music-gallery.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: preview type import와 props를 추가한다**

`components/songs/sheet-music-gallery.tsx`의 import에 다음을 추가한다.

```tsx
import {
  getSheetMusicPreviewKey,
  type SheetMusicPreviewItem,
} from '@/components/shared/sheet-music-preview';
```

`SheetMusicGalleryProps`를 다음처럼 확장한다.

```tsx
interface SheetMusicGalleryProps {
  files: SheetMusicFile[];
  editable?: boolean;
  songId?: string;
  onDeleted?: (fileId: string) => void;
  previewMode?: "dialog" | "controlled";
  onPreviewChange?: (item: SheetMusicPreviewItem | null) => void;
}
```

기존 `GalleryItem` interface는 삭제하고 `SheetMusicPreviewItem`을 사용한다.

```tsx
export function SheetMusicGallery({
  files,
  editable = false,
  onDeleted,
  previewMode = "dialog",
  onPreviewChange,
}: SheetMusicGalleryProps) {
  const [items, setItems] = useState<SheetMusicPreviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SheetMusicPreviewItem | null>(null);
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const previewChangeRef = useRef(onPreviewChange);
```

- [ ] **Step 2: controlled callback ref와 preview handler를 추가한다**

`filesRef` effect 아래에 다음 effect와 handler를 추가한다.

```tsx
  useEffect(() => {
    previewChangeRef.current = onPreviewChange;
  }, [onPreviewChange]);

  const handlePreview = (item: SheetMusicPreviewItem) => {
    if (previewMode === "controlled") {
      previewChangeRef.current?.(item);
      return;
    }

    setSelectedItem(item);
  };
```

- [ ] **Step 3: item build effect가 controlled preview 기본값을 알려주도록 수정한다**

`buildItems` 안의 타입을 `SheetMusicPreviewItem[]`로 바꾸고, `setItems([...result])` 호출 직후 controlled preview를 갱신한다.

```tsx
      const result: SheetMusicPreviewItem[] = [];
```

PDF placeholder를 넣은 직후 block은 다음처럼 바꾼다.

```tsx
            if (!cancelled) {
              setItems([...result]);
              if (previewMode === "controlled") {
                previewChangeRef.current?.(result[0] ?? null);
              }
            }
```

PDF render 완료 직후 block은 다음처럼 바꾼다.

```tsx
            if (!cancelled) {
              for (let p = 0; p < dataUrls.length; p++) {
                result[startIdx + p] = { ...result[startIdx + p], thumbnailUrl: dataUrls[p] };
              }
              setItems([...result]);
              if (previewMode === "controlled") {
                previewChangeRef.current?.(result[0] ?? null);
              }
            }
```

effect 마지막 `setItems(result)`도 다음처럼 바꾼다.

```tsx
      if (!cancelled) {
        setItems(result);
        if (previewMode === "controlled") {
          previewChangeRef.current?.(result[0] ?? null);
        }
      }
```

effect dependency는 다음처럼 바꾼다.

```tsx
  }, [filesKey, previewMode]);
```

- [ ] **Step 4: 썸네일 hover/click이 preview handler를 사용하도록 수정한다**

thumbnail wrapper의 mouse/click handler를 다음 패턴으로 바꾼다.

```tsx
            onMouseEnter={() => {
              setHoveredFileId(getSheetMusicPreviewKey(item));
              if (previewMode === "controlled") {
                previewChangeRef.current?.(item);
              }
            }}
```

기존 `hoveredFileId` 비교도 다음처럼 key helper를 사용한다.

```tsx
            {editable && hoveredFileId === getSheetMusicPreviewKey(item) && (
```

preview 클릭 handler는 다음처럼 바꾼다.

```tsx
              onClick={() => handlePreview(item)}
```

- [ ] **Step 5: dialog preview는 기본 모드에서만 렌더링한다**

파일 하단의 preview dialog를 다음처럼 감싼다.

```tsx
      {previewMode === "dialog" && (
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>
                {selectedItem?.file.fileName}
                {selectedItem?.pdfPage != null && ` - ${selectedItem.pdfPage}페이지`}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-6">
              {selectedItem && selectedItem.thumbnailUrl && (
                <img
                  src={selectedItem.thumbnailUrl}
                  alt={selectedItem.file.fileName}
                  className="mx-auto max-h-[80vh] w-auto"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
```

- [ ] **Step 6: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: gallery 관련 assertion은 통과하고, arrangement/conti editor 연결 assertion은 아직 실패한다.

- [ ] **Step 7: gallery controlled preview를 커밋한다**

```bash
git add components/songs/sheet-music-gallery.tsx
git commit -m "feat: control sheet music gallery preview"
```

---

### Task 6: ContiSongEditor가 preview state를 소유하도록 연결

**Files:**
- Modify: `components/shared/arrangement-editor/types.ts`
- Modify: `components/contis/conti-song-editor.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: ArrangementEditor props에 preview item을 추가한다**

`components/shared/arrangement-editor/types.ts` import를 다음처럼 수정한다.

```ts
import type { ReactNode } from "react"
import type { PresetPdfMetadata, SheetMusicFile, SongPreset } from "@/lib/types"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
```

`ArrangementEditorProps`에 다음 prop을 추가한다.

```ts
  sheetMusicPreviewItem?: SheetMusicPreviewItem | null
```

- [ ] **Step 2: ContiSongEditor에 preview state를 추가한다**

`components/contis/conti-song-editor.tsx` import에 type을 추가한다.

```tsx
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
```

component state에 다음 줄을 추가한다.

```tsx
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
```

- [ ] **Step 3: drawer close와 삭제 시 preview state를 정리한다**

`refreshSheetMusic` effects 아래에 close cleanup effect를 추가한다.

```tsx
  useEffect(() => {
    if (!open) {
      setSheetMusicPreviewItem(null)
    }
  }, [open])
```

`handleSheetMusicDeleted`를 다음처럼 수정한다.

```tsx
  const handleSheetMusicDeleted = (fileId: string) => {
    setSongSheetMusic((current) => current.filter((file) => file.id !== fileId))
    setSheetMusicPreviewItem((current) =>
      current?.file.id === fileId ? null : current,
    )
    router.refresh()
  }
```

- [ ] **Step 4: ArrangementEditor와 SheetMusicGallery를 controlled preview로 연결한다**

`ArrangementEditor` props에 다음 줄을 추가한다.

```tsx
      sheetMusicPreviewItem={sheetMusicPreviewItem}
```

`SheetMusicGallery` props에 다음 줄을 추가한다.

```tsx
              previewMode="controlled"
              onPreviewChange={setSheetMusicPreviewItem}
```

- [ ] **Step 5: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: conti song editor/type 관련 assertion은 통과하고, arrangement layout assertion은 아직 실패한다.

- [ ] **Step 6: conti editor preview state 연결을 커밋한다**

```bash
git add components/shared/arrangement-editor/types.ts components/contis/conti-song-editor.tsx
git commit -m "feat: wire conti song sheet music preview"
```

---

### Task 7: ArrangementEditor에 좌측 큰 preview pane 렌더링

**Files:**
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
- Test: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: 필요한 import와 prop destructuring을 추가한다**

`components/shared/arrangement-editor/arrangement-editor.tsx`에 import를 추가한다.

```tsx
import { SheetMusicPreviewPane } from "@/components/shared/sheet-music-preview"
import { cn } from "@/lib/utils"
```

`ArrangementEditor` destructuring에 prop을 추가한다.

```tsx
  sheetMusicPreviewItem,
```

`showYouTubeReferenceField` 아래에 다음 값을 추가한다.

```tsx
  const hasDrawerPreview = mode === "conti-song" && availableSheetMusic.length > 0
```

- [ ] **Step 2: Drawer size를 wide로 opt-in한다**

`<Drawer` props에 다음 줄을 추가한다.

```tsx
        size={hasDrawerPreview ? "wide" : "default"}
```

- [ ] **Step 3: drawer content를 desktop 2-column layout으로 감싼다**

`<Drawer>` 내부의 최상위 `<div className="space-y-8">` 시작을 다음 구조로 바꾼다.

```tsx
        <div
          className={cn(
            "min-h-full",
            hasDrawerPreview && "md:grid md:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1fr)] md:gap-6",
          )}
        >
          {hasDrawerPreview && (
            <div className="hidden min-w-0 md:block">
              <SheetMusicPreviewPane
                item={sheetMusicPreviewItem ?? null}
                className="sticky top-0 max-h-[calc(100vh-9rem)] overflow-y-auto"
              />
            </div>
          )}

          <div className="min-w-0 space-y-8">
```

기존 최상위 `</div>` 닫힘 위치에는 wrapper용 닫힘을 하나 더 추가한다.

```tsx
          </div>
        </div>
```

- [ ] **Step 4: mobile inline preview를 악보 섹션 안에 추가한다**

`{sheetMusicManagementSlot}` 바로 아래에 다음 block을 추가한다.

```tsx
              {hasDrawerPreview && (
                <SheetMusicPreviewPane
                  item={sheetMusicPreviewItem ?? null}
                  className="md:hidden"
                />
              )}
```

- [ ] **Step 5: focused 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: 새 테스트를 포함해 `tests/worship-prep-source.test.mjs`가 통과한다.

- [ ] **Step 6: arrangement preview layout을 커밋한다**

```bash
git add components/shared/arrangement-editor/arrangement-editor.tsx
git commit -m "feat: show drawer sheet music preview pane"
```

---

### Task 8: 전체 검증과 브라우저 확인

**Files:**
- Verify only

- [ ] **Step 1: source-level 테스트를 실행한다**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: exit code 0.

- [ ] **Step 2: lint를 실행한다**

Run:

```bash
pnpm lint
```

Expected: exit code 0. 새 TypeScript/React lint error가 없어야 한다.

- [ ] **Step 3: production build를 실행한다**

Run:

```bash
pnpm build
```

Expected: exit code 0. 네트워크 제한 때문에 Google Fonts fetch가 막히면 sandbox 밖 네트워크 권한으로 같은 명령을 다시 실행한다.

- [ ] **Step 4: 로컬 dev server를 실행한다**

Run:

```bash
pnpm dev
```

Expected: `http://localhost:3000`에서 Next.js dev server가 뜬다. 포트가 사용 중이면 Next가 안내하는 다음 포트를 사용한다.

- [ ] **Step 5: 브라우저에서 drawer preview 흐름을 확인한다**

브라우저에서 다음을 확인한다.

1. 콘티 상세 페이지에서 곡 편집 drawer를 연다.
2. 악보 썸네일을 클릭하거나 hover한다.
3. desktop width에서는 drawer 좌측 pane에 큰 악보가 표시된다.
4. 이 흐름에서는 악보 preview dialog가 열리지 않는다.
5. drawer 닫기 버튼과 Escape가 정상 동작한다.
6. 노래 상세 페이지의 `SheetMusicGallery`는 여전히 dialog preview를 연다.

- [ ] **Step 6: 최종 상태를 확인한다**

Run:

```bash
git status --short
```

Expected: 구현 파일과 테스트 파일 변경만 남아 있거나, 각 task commit 후 clean 상태다. `.env.local`, `.superpowers/`, `node_modules/`는 ignored 상태로 남아도 된다.
