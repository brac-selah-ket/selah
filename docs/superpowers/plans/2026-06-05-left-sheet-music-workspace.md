# Left Sheet Music Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘티 곡 편집 drawer의 좌측 패널을 악보 미리보기 전용에서 업로드, 썸네일, PDF 포함 선택까지 포함하는 악보 작업대로 바꾼다.

**Architecture:** `ArrangementEditor`가 악보 작업대 레이아웃을 소유한다. `ContiSongEditor`는 기존처럼 업로드와 갤러리 slot을 제공하되, wrapper를 단순화해서 좌측 패널 안에 자연스럽게 들어가게 한다. `SheetMusicGallery`의 controlled preview 계약은 유지한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Node source tests.

---

## 파일 구조

- Modify: `tests/worship-prep-source.test.mjs`
  - 좌측 악보 작업대 배치와 중복 렌더링 방지를 소스 테스트로 고정한다.
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
  - `renderSheetMusicWorkspace()` 함수를 추가한다.
  - 데스크톱에서는 좌측 패널에 workspace를 렌더링한다.
  - 모바일에서는 기존 악보 섹션 위치에 workspace를 렌더링한다.
  - 우측 본문에서 별도 악보 관리 섹션 중복을 제거한다.
- Modify: `components/contis/conti-song-editor.tsx`
  - `sheetMusicManagementSlot` wrapper를 card 느낌이 약한 `space-y-4` 컨테이너로 단순화한다.
- No change expected: `components/songs/sheet-music-gallery.tsx`
  - controlled preview mode는 이미 요구사항을 만족한다.

---

### Task 1: 좌측 악보 작업대 회귀 테스트

**Files:**
- Modify: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: 실패하는 소스 테스트 작성**

기존 `conti song drawer uses wide controlled sheet music preview instead of nested preview dialog` 테스트 안에 다음 assertion을 추가한다.

```js
  assert.match(arrangementSource, /function renderSheetMusicWorkspace/);
  assert.match(arrangementSource, /data-slot="sheet-music-workspace"/);
  assert.match(arrangementSource, /hidden min-w-0 md:block/);
  assert.match(arrangementSource, /renderSheetMusicWorkspace\(\{ mobile: false \}\)/);
  assert.match(arrangementSource, /renderSheetMusicWorkspace\(\{ mobile: true \}\)/);
  assert.match(arrangementSource, /SheetMusicSelector/);
  assert.match(arrangementSource, /sheetMusicManagementSlot/);
  assert.doesNotMatch(arrangementSource, /space-y-4 border-t pt-8/);
  assert.match(contiSongEditorSource, /sheetMusicManagementSlot=\{\s*<div className="space-y-4">/);
  assert.doesNotMatch(contiSongEditorSource, /space-y-4 rounded-lg border bg-background\/50 p-4/);
```

- [ ] **Step 2: 테스트 실패 확인**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected:

```text
not ok ... conti song drawer uses wide controlled sheet music preview instead of nested preview dialog
The input did not match the regular expression /function renderSheetMusicWorkspace/
```

- [ ] **Step 3: 테스트 커밋**

```bash
git add tests/worship-prep-source.test.mjs
git commit -m "test: cover left sheet music workspace"
```

---

### Task 2: ArrangementEditor 좌측 workspace 이동

**Files:**
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`

- [ ] **Step 1: workspace 표시 조건 추가**

`hasDrawerPreview` 근처에 `hasSheetMusicWorkspace`를 추가한다.

```tsx
  const hasDrawerPreview = mode === "conti-song" && availableSheetMusic.length > 0
  const hasSheetMusicWorkspace = availableSheetMusic.length > 0 || Boolean(sheetMusicManagementSlot)
```

- [ ] **Step 2: renderSheetMusicWorkspace 함수 추가**

`handleLyricsChange` 아래, `return (` 위에 다음 함수를 추가한다.

```tsx
  function renderSheetMusicWorkspace({ mobile }: { mobile: boolean }) {
    if (!hasSheetMusicWorkspace) return null

    return (
      <section
        data-slot="sheet-music-workspace"
        className={cn(
          "space-y-4",
          mobile ? "md:hidden" : "hidden min-w-0 md:block",
        )}
      >
        <div className="space-y-1">
          <h3 className="text-base font-medium">악보</h3>
          <p className="text-sm text-muted-foreground">
            PDF 내보내기에 포함할 악보를 선택하세요.
          </p>
        </div>

        <SheetMusicPreviewPane
          item={sheetMusicPreviewItem ?? null}
          className={cn(
            !mobile && "sticky top-0 max-h-[calc(100vh-10rem)] overflow-y-auto",
          )}
          imageClassName={mobile ? "max-h-[70vh]" : undefined}
        />

        {sheetMusicManagementSlot}

        {availableSheetMusic.length > 0 && (
          <SheetMusicSelector
            songId={songId}
            selectedFileIds={selectorFileIds}
            onSelectionChange={(ids) => updateDraft({ sheetMusicFileIds: ids })}
            availableFiles={availableSheetMusic}
          />
        )}
      </section>
    )
  }
```

- [ ] **Step 3: 데스크톱 좌측 패널에 workspace 렌더링**

기존 좌측 패널을 다음으로 교체한다.

```tsx
          {hasDrawerPreview && (
            <div className="hidden min-w-0 md:block">
              {renderSheetMusicWorkspace({ mobile: false })}
            </div>
          )}
```

- [ ] **Step 4: 우측 본문 악보 섹션을 모바일 전용 workspace로 교체**

기존 블록:

```tsx
            {(availableSheetMusic.length > 0 || sheetMusicManagementSlot) && (
              <div className="space-y-4 border-t pt-8">
                ...
              </div>
            )}
```

을 다음으로 교체한다.

```tsx
            {hasSheetMusicWorkspace && (
              <div className="border-t pt-8 md:hidden">
                {renderSheetMusicWorkspace({ mobile: true })}
              </div>
            )}
```

- [ ] **Step 5: 소스 테스트 통과 확인**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected:

```text
# pass 14
# fail 0
```

- [ ] **Step 6: 커밋**

```bash
git add components/shared/arrangement-editor/arrangement-editor.tsx
git commit -m "feat: move sheet music workspace to drawer side"
```

---

### Task 3: ContiSongEditor slot wrapper 단순화

**Files:**
- Modify: `components/contis/conti-song-editor.tsx`

- [ ] **Step 1: wrapper class 변경**

`sheetMusicManagementSlot`의 wrapper를 다음처럼 바꾼다.

```tsx
      sheetMusicManagementSlot={
        <div className="space-y-4">
          <SheetMusicUploader
            songId={contiSong.songId}
            onUploaded={handleSheetMusicUploaded}
          />
          {songSheetMusic.length > 0 && (
            <SheetMusicGallery
              files={songSheetMusic}
              editable
              songId={contiSong.songId}
              onDeleted={handleSheetMusicDeleted}
              previewMode="controlled"
              onPreviewChange={setSheetMusicPreviewItem}
            />
          )}
        </div>
      }
```

- [ ] **Step 2: 소스 테스트 통과 확인**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected:

```text
# pass 14
# fail 0
```

- [ ] **Step 3: 커밋**

```bash
git add components/contis/conti-song-editor.tsx
git commit -m "style: simplify conti sheet music workspace"
```

---

### Task 4: 전체 검증과 브라우저 QA

**Files:**
- No code changes expected.

- [ ] **Step 1: 소스 테스트 실행**

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected:

```text
# pass 14
# fail 0
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
pnpm test
```

Expected:

```text
# fail 0
```

- [ ] **Step 3: lint 실행**

```bash
pnpm lint
```

Expected:

```text
0 errors
```

기존 warning은 남아도 된다.

- [ ] **Step 4: production build 실행**

```bash
pnpm build
```

Expected:

```text
✓ Compiled successfully
Route (app)
```

Google Fonts fetch가 sandbox network 때문에 실패하면 네트워크 허용으로 같은 명령을 재실행한다.

- [ ] **Step 5: 브라우저 QA**

로컬 dev 서버에서 다음을 확인한다.

1. `http://localhost:3000/contis/9HnGhhp11yfw`를 연다.
2. 악보가 있는 곡의 `편집` 버튼을 누른다.
3. 데스크톱 wide drawer 좌측에 `악보` 제목, 큰 preview, 업로드 영역, 썸네일 갤러리, PDF 포함 선택 UI가 함께 있는지 확인한다.
4. 우측 편집 폼 하단에 악보 관리 UI가 중복으로 남아 있지 않은지 확인한다.
5. 썸네일 클릭 후 `[data-slot="dialog-content"]`가 생기지 않는지 확인한다.
6. drawer 닫기와 저장하지 않고 닫기 확인 흐름이 유지되는지 확인한다.

Expected DOM check:

```js
({
  workspaceCount: document.querySelectorAll('[data-slot="sheet-music-workspace"]').length,
  previewPaneCount: document.querySelectorAll('[data-slot="sheet-music-preview-pane"]').length,
  nestedDialogCount: document.querySelectorAll('[data-slot="dialog-content"]').length,
})
```

데스크톱 drawer open 상태에서 `workspaceCount >= 1`, `previewPaneCount >= 1`, 썸네일 클릭 후 `nestedDialogCount === 0`이어야 한다.

---

## 자체 검토

- Spec coverage: 좌측 악보 작업대, 우측 폼 집중, 모바일 본문 흐름, nested modal 회귀 방지, 기존 selector semantics 유지가 각 Task 1-4에 반영되어 있다.
- Placeholder scan: 미정 표현 없이 모든 작업에 파일, 코드, 명령, 기대 결과가 들어 있다.
- Type consistency: `renderSheetMusicWorkspace`, `hasSheetMusicWorkspace`, `sheetMusicManagementSlot`, `SheetMusicSelector`, `SheetMusicPreviewPane` 이름이 실제 코드와 일치한다.
