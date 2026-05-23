# Drawer Compact Layout 구현 계획

> **에이전트 작업자 필수 지침:** 이 계획을 구현할 때는 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용해 태스크 단위로 진행한다. 각 단계는 추적 가능한 체크박스(`- [ ]`) 형식이다.

**목표:** 오른쪽 공용 Drawer가 열린 동안, 영향을 받는 인증 영역 페이지의 왼쪽 콘텐츠를 일반 데스크톱 레이아웃 그대로 압축하지 않고 Drawer 전용 compact 레이아웃으로 전환한다.

**아키텍처:** 기존 desktop Drawer는 문서 흐름 안에서 오른쪽 패널로 열리는 구조를 유지한다. 대신 Drawer open 상태를 공유 레이아웃 컴포넌트가 읽을 수 있게 하고, 콘티 상세/찬양 상세의 왼쪽 영역을 Drawer open 상태에서 요약형 UI로 바꾼다. Drawer가 닫힌 페이지와 Drawer를 쓰지 않는 메뉴는 기존 레이아웃을 유지한다.

**기술 스택:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, 커스텀 Drawer portal, shadcn/base-ui 스타일 Button, @hugeicons 아이콘.

---

## 범위

이 계획은 프로토타입에서 확인한 "Drawer open compact mode"를 현재 실제로 오른쪽 Drawer를 여는 화면에 적용한다.

- 콘티 상세: 콘티 곡 편집 시 `ContiSongEditor`가 `ArrangementEditor` Drawer를 연다.
- 찬양 라이브러리 곡 상세: 프리셋 추가/편집 시 `PresetEditor`가 같은 `ArrangementEditor` Drawer를 연다.
- 인증 영역 공용 헤더: Drawer가 열렸을 때 제목과 액션 버튼이 가로 폭을 두고 충돌하지 않아야 한다.

이 계획은 `YouTubeImportDialog`, `PptxExportButton`, OCR dialog처럼 별도 modal/dialog로 뜨는 흐름은 바꾸지 않는다. 예배 준비 메뉴는 현재 Drawer 진입점이 없으므로 직접 변경하지 않는다. 다만 공용 `PageHeader` 개선은 앞으로 해당 메뉴에 Drawer가 붙을 때 자동으로 적용된다.

## 파일 구조

- 수정: `components/ui/drawer-context.tsx`
  - Drawer provider 밖에서도 안전하게 Drawer open 상태를 읽을 수 있는 optional hook을 추가한다.
- 수정: `components/layout/page-header.tsx`
  - client component로 전환하고, Drawer open 상태에서는 제목/액션 영역을 세로 compact 배치로 바꾼다.
- 수정: `components/contis/conti-song-summary-table.tsx`
  - 콘티 곡 목록에 compact density 렌더링을 추가한다. 기본 table 렌더링은 유지한다.
- 수정: `components/contis/conti-detail.tsx`
  - 콘티 곡 편집 Drawer가 열려 있을 때 summary table에 compact density를 전달한다.
- 수정: `components/songs/preset-list.tsx`
  - 프리셋 편집 Drawer가 열려 있을 때 프리셋 카드 밀도를 낮춰 좁은 왼쪽 영역에 맞춘다.
- 변경 없음: DB schema, server action, query 파일.

---

### Task 1: Drawer 상태 공유와 PageHeader compact mode

**Files:**
- Modify: `components/ui/drawer-context.tsx`
- Modify: `components/layout/page-header.tsx`

- [ ] **Step 1: 코드 변경 전 브라우저 기준 증상을 기록한다**

로컬 개발 서버를 켜고 콘티 상세에서 첫 번째 곡의 편집 버튼을 누른 뒤 아래 스크립트를 실행한다.

```js
await tab.goto("http://localhost:3000/contis/qtg7Igyu8V9n")
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 15000 })
await tab.playwright.evaluate(() => {
  document.querySelectorAll('button[aria-label="편집"]')[0]?.click()
})
await tab.playwright.waitForTimeout(400)
await tab.playwright.evaluate(() => {
  const h1 = document.querySelector("main h1")
  const actions = Array.from(document.querySelectorAll("main a, main button"))
    .filter((el) =>
      ["PDF 내보내기", "PDF 다운로드", "PPT 내보내기", "편집", "삭제"]
        .some((label) => el.textContent?.includes(label))
    )
  const rect = (el) => el ? {
    width: Math.round(el.getBoundingClientRect().width),
    height: Math.round(el.getBoundingClientRect().height),
  } : null
  return {
    titleText: h1?.textContent,
    titleRect: rect(h1),
    actionWidths: actions.map(rect),
  }
})
```

기준 증상: Drawer가 열리면 제목/날짜 블록이 좁게 눌리는데, 액션 버튼 묶음은 넓은 데스크톱 버튼 폭을 유지한다.

- [ ] **Step 2: optional Drawer 상태 hook을 추가한다**

`components/ui/drawer-context.tsx`에서 기존 `useDrawerPortal()`은 유지하고, 그 아래에 다음 함수를 추가한다.

```tsx
export function useOptionalDrawerState() {
  const ctx = useContext(DrawerContext)
  return {
    isOpen: ctx?.isOpen ?? false,
  }
}
```

이 hook은 공용 레이아웃 컴포넌트가 Drawer 상태를 읽되, provider 밖에서 렌더링되어도 예외를 던지지 않게 한다.

- [ ] **Step 3: PageHeader를 Drawer-aware client component로 바꾼다**

`components/layout/page-header.tsx` 맨 위에 `"use client"`를 추가하고 import를 아래처럼 맞춘다.

```tsx
"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { useOptionalDrawerState } from "@/components/ui/drawer-context"
```

`PageHeader` 본문은 Drawer open 상태를 읽어서 class를 바꾸도록 수정한다.

```tsx
export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  children,
  titleClassName,
}: PageHeaderProps) {
  const { isOpen: drawerOpen } = useOptionalDrawerState()

  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4",
        drawerOpen ? "sm:flex-col" : "sm:flex-row sm:items-start sm:justify-between",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="mt-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="이전 화면으로 이동"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-7" />
          </Link>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-sm font-semibold text-primary/75">{eyebrow}</p>
          )}
          <h1
            className={cn(
              "font-serif-kr text-3xl font-bold leading-tight tracking-normal text-foreground",
              drawerOpen ? "sm:text-3xl" : "sm:text-4xl",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            drawerOpen ? "min-w-0" : "shrink-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TypeScript 검증을 실행한다**

```bash
pnpm exec tsc --noEmit --pretty false --allowImportingTsExtensions
```

예상 결과: exit `0`.

- [ ] **Step 5: Task 1을 커밋한다**

```bash
git add components/ui/drawer-context.tsx components/layout/page-header.tsx
git commit -m "feat: make page headers drawer aware"
```

---

### Task 2: 콘티 상세의 compact 곡 요약 UI

**Files:**
- Modify: `components/contis/conti-song-summary-table.tsx`
- Modify: `components/contis/conti-detail.tsx`

- [ ] **Step 1: `ContiSongSummaryTable`에 density prop을 추가한다**

`components/contis/conti-song-summary-table.tsx`의 props를 다음처럼 확장한다.

```tsx
interface ContiSongSummaryTableProps {
  songs: SummaryRow[]
  mode: "read" | "action"
  density?: "default" | "compact"
  onEdit?: (contiSongId: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  onRemove?: (contiSongId: string) => void
}
```

함수 시그니처에는 기본값을 둔다.

```tsx
export function ContiSongSummaryTable({
  songs,
  mode,
  density = "default",
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ContiSongSummaryTableProps) {
```

- [ ] **Step 2: compact 메타데이터 helper를 추가한다**

`getSectionSummary` 아래에 다음 함수를 추가한다.

```tsx
function getKeyTempoSummary(song: SummaryRow): string {
  const keys = getKeys(song)
  const tempos = getTempos(song)
  const parts = [
    keys.length > 0 ? keys.join("/") : null,
    tempos.length > 0 ? `${tempos.join("/")} BPM` : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "-"
}
```

- [ ] **Step 3: action mode 전용 compact card branch를 추가한다**

empty state return 뒤, `const showActions = mode === "action"`보다 앞에 다음 branch를 추가한다.

```tsx
  if (density === "compact" && mode === "action") {
    return (
      <div className="space-y-2">
        {songs.map((song, index) => {
          const youtubeReference = getYoutubeReference(song)
          const youtubeTitle = getYoutubeTitle(song)
          const presetName = getPresetName(song)

          return (
            <div
              key={song.id}
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-background/70 px-3 py-3 text-sm"
            >
              <span className="font-semibold text-primary">{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate font-medium">{getSongName(song)}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{getKeyTempoSummary(song)}</span>
                  <span className="min-w-0 max-w-full truncate">{getSectionSummary(song)}</span>
                  {presetName && <span>{presetName}</span>}
                  <YouTubeReferenceLink
                    reference={youtubeReference}
                    title={youtubeTitle}
                    className="text-primary underline-offset-4 hover:underline"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="편집"
                  disabled={!onEdit}
                  onClick={() => onEdit?.(song.id)}
                >
                  <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="위로 이동"
                  disabled={index === 0 || !onMoveUp}
                  onClick={() => onMoveUp?.(index)}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="아래로 이동"
                  disabled={index === songs.length - 1 || !onMoveDown}
                  onClick={() => onMoveDown?.(index)}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="삭제"
                  disabled={!onRemove}
                  onClick={() => onRemove?.(song.id)}
                >
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
```

이 branch는 편집 중인 왼쪽 패널을 프로토타입처럼 "컨텍스트 요약"으로 바꾸고, 일반 상세 화면에서는 기존 table을 그대로 사용한다.

- [ ] **Step 4: `ContiDetail`에서 편집 중일 때 compact density를 전달한다**

`components/contis/conti-detail.tsx`에서 `shouldShowDescription` 아래에 다음 값을 추가한다.

```tsx
  const drawerCompact = editingId !== null
```

`ContiSongSummaryTable` 호출부에 `density`를 추가한다.

```tsx
            <ContiSongSummaryTable
              songs={optimisticSongs}
              mode="action"
              density={drawerCompact ? "compact" : "default"}
              onEdit={handleEdit}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={setRemovingId}
            />
```

- [ ] **Step 5: 콘티 상세 브라우저 검증을 실행한다**

로컬 앱을 열고 첫 번째 콘티 곡을 편집한 뒤 아래를 실행한다.

```js
await tab.goto("http://localhost:3000/contis/qtg7Igyu8V9n")
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 15000 })
await tab.playwright.evaluate(() => {
  document.querySelectorAll('button[aria-label="편집"]')[0]?.click()
})
await tab.playwright.waitForTimeout(400)
await tab.playwright.evaluate(() => {
  const h1 = document.querySelector("main h1")
  const visibleText = document.body.innerText
  return {
    titleTooTall: (h1?.getBoundingClientRect().height ?? 0) > 70,
    hasDrawer: visibleText.includes("콘티 곡 편집"),
    hasFullTableHeaderWhileDrawerOpen: visibleText.includes("#\n곡\nKey\nBPM\n섹션\n프리셋\nYouTube\n작업"),
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }
})
```

예상 결과:

```json
{
  "titleTooTall": false,
  "hasDrawer": true,
  "hasFullTableHeaderWhileDrawerOpen": false,
  "bodyOverflow": false
}
```

- [ ] **Step 6: Task 2를 커밋한다**

```bash
git add components/contis/conti-song-summary-table.tsx components/contis/conti-detail.tsx
git commit -m "feat: compact conti detail while editing"
```

---

### Task 3: 찬양 상세 프리셋 목록 compact mode

**Files:**
- Modify: `components/songs/preset-list.tsx`

- [ ] **Step 1: `cn` import와 compact 상태를 추가한다**

`components/songs/preset-list.tsx` 상단 import에 다음을 추가한다.

```tsx
import { cn } from "@/lib/utils"
```

`PresetList` 내부 state 선언 아래에 다음 값을 추가한다.

```tsx
  const compact = editorOpen
```

- [ ] **Step 2: 프리셋 목록 wrapper와 card padding을 compact 상태에 맞춘다**

프리셋 목록 wrapper를 다음처럼 바꾼다.

```tsx
        <div className={compact ? "space-y-2" : "space-y-3"}>
```

프리셋 카드 className을 다음처럼 바꾼다.

```tsx
                className={cn(
                  "ring-foreground/10 rounded-lg bg-muted/30 ring-1 cursor-pointer hover:bg-muted/50 transition-colors",
                  compact ? "p-3" : "p-4",
                )}
```

- [ ] **Step 3: 프리셋 카드 텍스트 밀도를 compact 상태에 맞춘다**

각 프리셋 카드의 제목/메타 영역을 다음 구조로 교체한다.

```tsx
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate font-medium">{preset.name}</h3>
                      {preset.isDefault && (
                        <Badge variant="secondary">기본</Badge>
                      )}
                    </div>

                    <div
                      className={cn(
                        "text-muted-foreground",
                        compact
                          ? "mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                          : "text-base space-y-1.5",
                      )}
                    >
                      {keys.length > 0 && (
                        <div className={compact ? "truncate" : undefined}>
                          <span className="font-medium">조성:</span>{" "}
                          {keys.join(", ")}
                        </div>
                      )}
                      {tempos.length > 0 && (
                        <div className={compact ? "truncate" : undefined}>
                          <span className="font-medium">템포:</span>{" "}
                          {tempos.join(", ")} BPM
                        </div>
                      )}
                      {preset.notes && !compact && (
                        <div>
                          <span className="font-medium">메모:</span>{" "}
                          {preset.notes}
                        </div>
                      )}
                      <YouTubeReferenceLink
                        reference={preset.youtubeReference}
                        title={preset.youtubeTitle}
                        stopPropagation
                        className="text-primary block truncate underline-offset-4 hover:underline"
                      />
                    </div>
```

일반 찬양 상세 화면에서는 메모를 계속 보여주고, Drawer가 열린 좁은 왼쪽 패널에서는 메모를 숨겨 핵심 정보만 남긴다.

- [ ] **Step 4: 찬양 상세 브라우저 검증을 실행한다**

찬양 상세에서 프리셋 카드를 클릭하고 아래를 실행한다.

```js
await tab.goto("http://localhost:3000/songs/CU62qxCFsq1T")
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 15000 })
await tab.playwright.evaluate(() => {
  const presetCard = Array.from(document.querySelectorAll("main div"))
    .find((el) => el.textContent?.includes("260524") && el.textContent?.includes("YouTube"))
  presetCard?.click()
})
await tab.playwright.waitForTimeout(400)
await tab.playwright.evaluate(() => {
  const h1 = document.querySelector("main h1")
  const visibleText = document.body.innerText
  return {
    titleTooTall: (h1?.getBoundingClientRect().height ?? 0) > 70,
    hasDrawer: visibleText.includes("프리셋 편집") || visibleText.includes("프리셋 추가"),
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }
})
```

예상 결과:

```json
{
  "titleTooTall": false,
  "hasDrawer": true,
  "bodyOverflow": false
}
```

- [ ] **Step 5: Task 3을 커밋한다**

```bash
git add components/songs/preset-list.tsx
git commit -m "feat: compact song presets while editing"
```

---

### Task 4: 회귀 검증과 PR 반영

**Files:**
- 계획된 source 변경 없음.

- [ ] **Step 1: lint를 실행한다**

```bash
pnpm lint
```

예상 결과: exit `0`. 기존 warning은 남을 수 있지만 error는 `0`이어야 한다.

- [ ] **Step 2: TypeScript 검증을 실행한다**

```bash
pnpm exec tsc --noEmit --pretty false --allowImportingTsExtensions
```

예상 결과: exit `0`.

- [ ] **Step 3: production build를 실행한다**

```bash
pnpm build
```

예상 결과: exit `0`. 샌드박스 네트워크 제한으로 Google Fonts fetch가 실패하면, 네트워크 허용 상태로 같은 명령을 다시 실행하고 첫 실패 원인을 font fetch 제한으로 기록한다.

- [ ] **Step 4: 콘티 상세 smoke test를 실행한다**

`pnpm dev`를 띄운 뒤 `http://localhost:3000/contis/qtg7Igyu8V9n`을 연다.

```js
await tab.goto("http://localhost:3000/contis/qtg7Igyu8V9n")
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 15000 })
await tab.playwright.evaluate(() => document.querySelectorAll('button[aria-label="편집"]')[0]?.click())
await tab.playwright.waitForTimeout(400)
await tab.playwright.evaluate(() => {
  const visibleText = document.body.innerText
  return {
    hasDrawer: visibleText.includes("콘티 곡 편집"),
    hasBrokenDateStack: /2026\s*년\s*05\s*월\s*24\s*일/.test(visibleText) && (document.querySelector("main h1")?.getBoundingClientRect().height ?? 0) > 70,
    hasFullTableHeaderWhileDrawerOpen: visibleText.includes("#\n곡\nKey\nBPM\n섹션\n프리셋\nYouTube\n작업"),
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }
})
```

예상 결과:

```json
{
  "hasDrawer": true,
  "hasBrokenDateStack": false,
  "hasFullTableHeaderWhileDrawerOpen": false,
  "bodyOverflow": false
}
```

- [ ] **Step 5: 찬양 상세 smoke test를 실행한다**

`http://localhost:3000/songs/CU62qxCFsq1T`를 열고 프리셋 카드를 클릭한다.

```js
await tab.goto("http://localhost:3000/songs/CU62qxCFsq1T")
await tab.playwright.waitForLoadState({ state: "load", timeoutMs: 15000 })
await tab.playwright.evaluate(() => {
  const card = Array.from(document.querySelectorAll("main div"))
    .find((el) => el.textContent?.includes("260524") && el.textContent?.includes("YouTube"))
  card?.click()
})
await tab.playwright.waitForTimeout(400)
await tab.playwright.evaluate(() => {
  const visibleText = document.body.innerText
  return {
    hasDrawer: visibleText.includes("프리셋 편집") || visibleText.includes("프리셋 추가"),
    titleTooTall: (document.querySelector("main h1")?.getBoundingClientRect().height ?? 0) > 70,
    bodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  }
})
```

예상 결과:

```json
{
  "hasDrawer": true,
  "titleTooTall": false,
  "bodyOverflow": false
}
```

- [ ] **Step 6: Drawer가 닫힌 일반 메뉴 레이아웃을 확인한다**

아래 URL을 각각 열고 Drawer가 닫힌 상태에서 헤더가 기존 데스크톱 배치로 유지되는지 확인한다.

```text
http://localhost:3000/contis
http://localhost:3000/songs
http://localhost:3000/worship-prep
```

예상 결과: Drawer가 닫혀 있으면 제목은 왼쪽, 액션은 오른쪽에 배치되는 기존 헤더 구조가 유지된다.

- [ ] **Step 7: 브랜치를 push한다**

```bash
git status --short --branch
git push
```

예상 결과: worktree가 clean이고 기존 PR preview가 갱신된다.

---

## 자체 점검

- 요구사항 반영: 승인된 compact prototype 동작을 공용 `PageHeader`, 콘티 상세 Drawer 흐름, 찬양 상세 프리셋 Drawer 흐름에 반영하는 태스크가 있다.
- 범위 통제: modal/dialog 기반 흐름은 오른쪽 Drawer가 아니므로 제외했다.
- 빈칸성 표현 점검: 구현자가 임의로 해석해야 하는 미정 단계 없이 파일, 코드, 명령, 예상 결과를 명시했다.
- 타입 일관성: `density?: "default" | "compact"`는 `ContiSongSummaryTableProps`에 정의되고 `ContiDetail`에서만 전달된다. `useOptionalDrawerState()`는 `{ isOpen: boolean }`을 반환하고 `PageHeader`에서 사용된다.
