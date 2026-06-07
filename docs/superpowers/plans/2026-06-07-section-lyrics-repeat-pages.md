# 섹션-가사 반복 페이지 매핑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 콘티 곡 편집의 섹션-가사 매핑에서 hover 가사 미리보기를 복구하고 동일 가사 페이지를 여러 번 배치할 수 있게 한다.

**Architecture:** 기존 `sectionLyricsMap: Record<number, number[]>` 저장 형식은 유지하고, 배열에 중복 페이지 인덱스를 허용한다. `SectionLyricsMapper`의 상태 변경 로직은 순수 함수로 분리해 테스트하고, UI는 체크박스 토글 대신 페이지 추가 버튼과 선택 순서 배지 삭제로 구성한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Base UI Tooltip, Node test runner.

---

### Task 1: 매핑 상태 유틸리티

**Files:**
- Create: `components/contis/section-lyrics-map-utils.ts`
- Test: `components/contis/section-lyrics-map-utils.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  addLyricsPageToSection,
  removeLyricsPageOccurrence,
  pruneInvalidLyricsPages,
} from "./section-lyrics-map-utils.ts"

test("adds duplicate lyrics pages while preserving click order", () => {
  const first = addLyricsPageToSection({}, 1, 0)
  const second = addLyricsPageToSection(first, 1, 2)
  const third = addLyricsPageToSection(second, 1, 0)

  assert.deepEqual(third, { 1: [0, 2, 0] })
})

test("removes only one occurrence by position", () => {
  const result = removeLyricsPageOccurrence({ 1: [0, 2, 0] }, 1, 1)

  assert.deepEqual(result, { 1: [0, 0] })
})

test("deletes the section key when the last occurrence is removed", () => {
  const result = removeLyricsPageOccurrence({ 1: [0] }, 1, 0)

  assert.deepEqual(result, {})
})

test("prunes invalid page indices without deduplicating valid repeats", () => {
  const result = pruneInvalidLyricsPages({ 0: [0, 2, 0, 4], 1: [3] }, 3)

  assert.deepEqual(result, { 0: [0, 2, 0] })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test components/contis/section-lyrics-map-utils.test.ts`

Expected: FAIL because `section-lyrics-map-utils.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `components/contis/section-lyrics-map-utils.ts` with immutable helper functions that copy maps and arrays, append duplicate page indices, remove one array position, and prune out-of-range indices.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test components/contis/section-lyrics-map-utils.test.ts`

Expected: PASS.

- [ ] **Step 5: Add test to package script**

Add `components/contis/section-lyrics-map-utils.test.ts` to the existing explicit `pnpm test` file list.

### Task 2: 섹션-가사 매핑 UI 수정

**Files:**
- Modify: `components/contis/section-lyrics-mapper.tsx`
- Test: `tests/section-lyrics-mapper-source.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write source test**

Create a source-level test that checks `section-lyrics-mapper.tsx` imports the helper functions, uses button-based page addition, renders "선택된 순서", keeps Tooltip content for page labels and preview badges, and exposes an aria-label for individual mapping removal.

- [ ] **Step 2: Verify test fails**

Run: `node --test tests/section-lyrics-mapper-source.test.mjs`

Expected: FAIL because the UI still uses checkbox toggle behavior.

- [ ] **Step 3: Implement UI**

Replace checkbox labels with compact buttons. Each page button calls `addLyricsPageToSection`. Add a selected-order area for each section that renders duplicate page badges in order, each with a small remove button using `removeLyricsPageOccurrence`. Use `TooltipTrigger render={<button />}` or `render={<span />}` only where the resulting trigger has a real hover target.

- [ ] **Step 4: Verify source test passes**

Run: `node --test tests/section-lyrics-mapper-source.test.mjs`

Expected: PASS.

- [ ] **Step 5: Add test to package script**

Add `tests/section-lyrics-mapper-source.test.mjs` to the existing explicit `pnpm test` file list.

### Task 3: 통합 검증

**Files:**
- Verify only.

- [ ] **Step 1: Run targeted tests**

Run:
```bash
node --experimental-strip-types --test components/contis/section-lyrics-map-utils.test.ts
node --test tests/section-lyrics-mapper-source.test.mjs
```

Expected: both commands PASS.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

Expected: all tests PASS.

- [ ] **Step 3: Browser QA**

Open `http://localhost:3000/contis/UKe4hSuijHtR`, open the conti song editor, verify page button hover shows lyrics, click the same page twice, verify both occurrences appear and one occurrence can be removed independently.

- [ ] **Step 4: Commit**

Commit the spec, plan, tests, and implementation with:

```bash
git add docs/superpowers/specs/2026-06-07-section-lyrics-repeat-pages-design.md docs/superpowers/plans/2026-06-07-section-lyrics-repeat-pages.md components/contis/section-lyrics-map-utils.ts components/contis/section-lyrics-map-utils.test.ts components/contis/section-lyrics-mapper.tsx tests/section-lyrics-mapper-source.test.mjs package.json
git commit -m "fix: allow repeated lyric page mappings"
```
