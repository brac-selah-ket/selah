# Storyboard UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish Storyboard's high-frequency worship prep UI and add inline YouTube playlist import to new conti creation.

**Architecture:** Keep the current Next.js App Router structure. Make small local UI fixes in existing list/layout components, extract shared YouTube import state into focused helpers, and reuse the extracted import review UI in both the existing dialog and the new inline wizard. Preserve database schema while extending batch import payloads for explicit YouTube keep/replace behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Base UI dialog primitives, Drizzle ORM, Node test runner.

---

## Ownership Boundaries

Use disjoint write scopes when dispatching workers:

- Worker A: auth, navigation, conti list density, conti-song row click, song grid.
- Worker B: app shell drawer overlay, drawer/dialog outside-click behavior.
- Worker C: arrangement dirty-state normalization, sheet-music loading state.
- Worker D: YouTube import model, action schema, Neon/Turso repositories, import model tests.
- Worker E: refactor YouTube import dialog, add `/contis/new` inline wizard, and own all `components/contis/conti-form.tsx` edits including `인도자` field labels after Worker D lands.

Workers are not alone in the codebase. Do not revert edits made by others; adapt to already-landed changes.

## Task 1: Auth Redirects, Sidebar Order, Dense Lists, Labels, Song Grid

**Files:**
- Create: `lib/auth-redirect.ts`
- Test: `lib/auth-redirect.test.ts`
- Modify: `middleware.ts`
- Modify: `components/auth/login-form.tsx`
- Modify: `app/page.tsx`
- Modify: `components/layout/sidebar.tsx`
- Modify: `components/contis/conti-card.tsx`
- Modify: `components/contis/conti-song-summary-table.tsx`
- Modify: `components/songs/song-list.tsx`
- Modify: `components/songs/song-card.tsx`

- [ ] **Step 1: Add auth redirect helper tests**

Create `lib/auth-redirect.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { getSafeNextPath } from "./auth-redirect.ts"

test("accepts internal next paths with query strings", () => {
  assert.equal(getSafeNextPath("/contis/abc?tab=songs"), "/contis/abc?tab=songs")
})

test("rejects absolute and protocol-relative next values", () => {
  assert.equal(getSafeNextPath("https://example.com/steal"), "/worship-prep")
  assert.equal(getSafeNextPath("//example.com/steal"), "/worship-prep")
})

test("rejects empty next values", () => {
  assert.equal(getSafeNextPath(null), "/worship-prep")
  assert.equal(getSafeNextPath(""), "/worship-prep")
})
```

- [ ] **Step 2: Run the new auth test and verify it fails**

Run:

```bash
node --experimental-strip-types --test lib/auth-redirect.test.ts
```

Expected: FAIL because `lib/auth-redirect.ts` does not exist.

- [ ] **Step 3: Implement the auth redirect helper**

Create `lib/auth-redirect.ts`:

```ts
export const DEFAULT_AUTH_REDIRECT = "/worship-prep"

export function getSafeNextPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AUTH_REDIRECT
  if (!value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT
  }
  return value
}

export function getPathWithSearch(pathname: string, search: string): string {
  return `${pathname}${search}`
}
```

- [ ] **Step 4: Wire middleware and login to preserve `pathname + search`**

Update `middleware.ts` imports and redirect block:

```ts
import { getPathWithSearch } from '@/lib/auth-redirect';
```

Replace the unauthenticated redirect block with:

```ts
if (!token || !secret || !(await verifyToken(token, secret))) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', getPathWithSearch(pathname, request.nextUrl.search));
  return NextResponse.redirect(loginUrl);
}
```

Update `components/auth/login-form.tsx` to use `useSearchParams`:

```tsx
import { useRouter, useSearchParams } from 'next/navigation';
import { getSafeNextPath } from '@/lib/auth-redirect';
```

Inside `LoginForm`:

```tsx
const searchParams = useSearchParams();
const nextPath = getSafeNextPath(searchParams.get('next'));
```

Replace successful login routing:

```tsx
router.push(nextPath);
```

- [ ] **Step 5: Change default landing and sidebar order**

Update `app/page.tsx`:

```ts
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/worship-prep")
}
```

Update `components/layout/sidebar.tsx` nav item order:

```ts
const navItems = [
  {
    label: "예배 준비",
    href: "/worship-prep",
    icon: Calendar03Icon,
  },
  {
    label: "콘티 목록",
    href: "/contis",
    icon: Playlist01Icon,
  },
  {
    label: "찬양 라이브러리",
    href: "/songs",
    icon: MusicNoteSquare01Icon,
  },
]
```

- [ ] **Step 6: Compact conti cards and remove fake descriptions**

In `components/contis/conti-card.tsx`, replace the card body classes and description block:

```tsx
<div className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/55 sm:grid-cols-[1fr_auto] sm:items-center">
```

Use:

```tsx
{description && (
  <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
    {description}
  </p>
)}
<p className={cn(
  "text-xs font-medium text-muted-foreground/80",
  description ? "mt-1" : "mt-0.5",
)}>
  {summaryText}
</p>
```

Add `cn` import:

```ts
import { cn } from "@/lib/utils"
```

- [ ] **Step 7: Add row-click editing to conti song summary table**

In `components/contis/conti-song-summary-table.tsx`, add a helper near `showActions`:

```tsx
function stopRowClick(event: React.MouseEvent) {
  event.stopPropagation()
}
```

For the compact action row, add row click and cursor/hover classes:

```tsx
<div
  key={song.id}
  className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-background/70 px-3 py-3 text-sm transition-colors hover:bg-muted/40"
  onClick={() => onEdit?.(song.id)}
>
```

For each compact row action button, wrap its click:

```tsx
onClick={(event) => {
  stopRowClick(event)
  onEdit?.(song.id)
}}
```

Apply the same pattern to move up, move down, and delete buttons.

Wrap the compact YouTube link area with the same propagation guard:

```tsx
{youtubeReference && (
  <span className="min-w-0 max-w-full truncate" onClick={stopRowClick}>
    <YouTubeReferenceLink
      reference={youtubeReference}
      title={youtubeTitle}
      className="block max-w-full truncate underline-offset-2 hover:underline"
    />
  </span>
)}
```

For the default action table row, use:

```tsx
<div
  key={song.id}
  className={`grid ${gridTemplateClass} items-center gap-3 border-b px-3 py-3 text-sm transition-colors last:border-b-0 ${showActions ? "cursor-pointer hover:bg-muted/40" : ""}`}
  onClick={showActions ? () => onEdit?.(song.id) : undefined}
>
```

Wrap the YouTube link cell and action buttons so they do not trigger the row edit:

```tsx
<span className="min-w-0 truncate text-muted-foreground" onClick={stopRowClick}>
  <YouTubeReferenceLink
    reference={getYoutubeReference(song)}
    title={getYoutubeTitle(song)}
    className="text-primary block truncate underline-offset-4 hover:underline"
    fallback="-"
  />
</span>
```

For every action button in the default row, use the same `event.stopPropagation()` wrapper before calling the existing handler.

- [ ] **Step 8: Convert song list to responsive grid cards**

In `components/songs/song-list.tsx`, replace the rendered list wrapper:

```tsx
<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
  {filteredSongs.map((song) => (
    <SongCard key={song.id} song={song} />
  ))}
</div>
```

In `components/songs/song-card.tsx`, replace the root link with a compact card:

```tsx
<Link
  href={`/songs/${song.id}`}
  className="group flex min-h-24 flex-col justify-between rounded-lg border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-muted/35"
>
  <div className="flex items-start gap-3">
    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
      <HugeiconsIcon icon={MusicNoteSquare01Icon} strokeWidth={2} className="size-5" />
    </div>
    <div className="min-w-0">
      <h2 className="line-clamp-2 text-base font-semibold text-foreground">{song.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{formattedDate} 등록</p>
    </div>
  </div>
  <div className="mt-3 flex items-center justify-end gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
    열기
    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4" />
  </div>
</Link>
```

- [ ] **Step 9: Run tests and commit**

Run:

```bash
node --experimental-strip-types --test lib/auth-redirect.test.ts
pnpm lint
```

Expected: auth tests PASS; lint PASS.

Commit:

```bash
git add lib/auth-redirect.ts lib/auth-redirect.test.ts middleware.ts components/auth/login-form.tsx app/page.tsx components/layout/sidebar.tsx components/contis/conti-card.tsx components/contis/conti-song-summary-table.tsx components/songs/song-list.tsx components/songs/song-card.tsx
git commit -m "feat: polish navigation and list layouts"
```

## Task 2: Drawer Overlay And Outside-Click Behavior

**Files:**
- Modify: `components/layout/app-shell.tsx`
- Modify: `components/ui/drawer.tsx`
- Modify: `components/ui/dialog.tsx`

- [ ] **Step 1: Convert app shell drawer portal to overlay**

In `components/layout/app-shell.tsx`, remove width-reserving drawer state classes. Use a fixed portal host after the content:

```tsx
<aside
  ref={portalRef}
  className={cn(
    "fixed inset-x-0 bottom-0 z-[60] h-[90vh] overflow-hidden rounded-t-2xl bg-background shadow-xl",
    "transition-transform duration-300 ease-in-out",
    isOpen ? "translate-y-0" : "translate-y-full pointer-events-none",
    "md:inset-y-0 md:left-auto md:right-0 md:h-screen md:max-h-none md:rounded-none md:border-l",
    drawerSize === "wide"
      ? "md:w-[min(1040px,calc(100vw-13rem))] xl:w-[min(1120px,calc(100vw-13rem))]"
      : "md:w-[min(640px,76vw)] xl:w-[40%]",
    "md:translate-y-0",
    !isOpen && "md:translate-x-full",
    isOpen && "md:translate-x-0",
    "md:transition-transform md:duration-300 md:ease-in-out",
  )}
/>
```

Keep `Sidebar`, mobile header, and main content unchanged so the page width no longer changes.

- [ ] **Step 2: Make drawer backdrop close through the guarded close path**

In `components/ui/drawer.tsx`, update the backdrop:

```tsx
<button
  type="button"
  className={cn(
    "fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300",
    open ? "opacity-100" : "pointer-events-none opacity-0",
  )}
  aria-hidden="true"
  tabIndex={-1}
  onClick={handleClose}
/>
```

Keep `handleClose` as the single close path for ESC, close button, cancel footer, and outside click.

- [ ] **Step 3: Ensure ordinary dialogs close on outside click**

In `components/ui/dialog.tsx`, keep Base UI default dismiss behavior and do not prevent backdrop dismissal for ordinary `Dialog`. If a prop currently blocks outside click in any local component, remove that block for `DialogContent`. Do not change `AlertDialog`.

If Base UI needs explicit dismiss behavior in this version, pass it at the root wrapper:

```tsx
function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}
```

No `onOpenChange` guard should reject `false` unless a specific component owns unsaved state.

- [ ] **Step 4: Browser smoke test and commit**

Run:

```bash
pnpm lint
```

Use the in-app browser:

- Open a conti song editor with sheet music; page behind the drawer must not shrink.
- Click outside the drawer; if no edits, it closes.
- Make a real edit and click outside; unsaved-changes alert appears.
- Open a normal modal such as YouTube import; outside click closes it.
- Open an alert dialog; outside click does not dismiss it.

Commit:

```bash
git add components/layout/app-shell.tsx components/ui/drawer.tsx components/ui/dialog.tsx
git commit -m "fix: overlay drawers and restore outside dismiss"
```

## Task 3: Dirty-State Accuracy And Sheet-Music Loading

**Files:**
- Create: `components/shared/arrangement-editor/dirty-state.ts`
- Test: `components/shared/arrangement-editor/dirty-state.test.ts`
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
- Modify: `components/shared/sheet-music-preview.tsx`
- Modify: `components/contis/conti-song-editor.tsx`

- [ ] **Step 1: Add dirty-state tests**

Create `components/shared/arrangement-editor/dirty-state.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  areArrangementDraftsEqual,
  normalizeArrangementDraftForDirtyCheck,
} from "./dirty-state.ts"
import type { ArrangementDraft } from "./types.ts"

const baseDraft: ArrangementDraft = {
  name: "영접송",
  keys: ["G"],
  tempos: [59],
  sectionOrder: ["Intro", "V"],
  lyrics: ["line"],
  sectionLyricsMap: { 0: [0] },
  notes: null,
  sheetMusicFileIds: null,
  pdfMetadata: null,
  youtubeReference: "https://www.youtube.com/watch?v=W1uussHIX9o",
  youtubeTitle: "Invitation",
  isDefault: false,
  appliedPresetId: "preset-1",
}

test("normalizes youtube watch URLs to video ids", () => {
  assert.equal(
    normalizeArrangementDraftForDirtyCheck(baseDraft).youtubeReference,
    "W1uussHIX9o",
  )
})

test("treats equivalent optional values as unchanged", () => {
  const next = {
    ...baseDraft,
    notes: "",
    youtubeReference: "W1uussHIX9o",
  }
  assert.equal(areArrangementDraftsEqual(baseDraft, next), true)
})

test("treats null sheet music selection and all ids selected as unchanged", () => {
  const next = { ...baseDraft, sheetMusicFileIds: ["sheet-2", "sheet-1"] }
  assert.equal(areArrangementDraftsEqual(baseDraft, next, ["sheet-1", "sheet-2"]), true)
})

test("detects real key changes", () => {
  const next = { ...baseDraft, keys: ["A"] }
  assert.equal(areArrangementDraftsEqual(baseDraft, next), false)
})
```

- [ ] **Step 2: Run dirty-state tests and verify failure**

Run:

```bash
node --experimental-strip-types --test components/shared/arrangement-editor/dirty-state.test.ts
```

Expected: FAIL because `dirty-state.ts` does not exist.

- [ ] **Step 3: Implement dirty-state normalization**

Create `components/shared/arrangement-editor/dirty-state.ts`:

```ts
import { normalizeYouTubeReference } from "../../../lib/utils/youtube.ts"
import type { ArrangementDraft } from "./types"

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeYoutube(value: string | null | undefined): string | null {
  const trimmed = normalizeOptionalString(value)
  if (!trimmed) return null
  return normalizeYouTubeReference(trimmed)?.videoId ?? trimmed
}

function normalizeNumberArray(values: number[]): number[] {
  return values.filter((value) => Number.isFinite(value))
}

function normalizeStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean)
}

function normalizeSectionLyricsMap(value: Record<number, number[]>): Record<string, number[]> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, indices]) => [String(Number(key)), indices.filter(Number.isFinite)] as const)
      .sort(([a], [b]) => Number(a) - Number(b)),
  )
}

function normalizeSheetMusicFileIds(
  selectedIds: string[] | null,
  allSheetMusicIds: string[] = [],
): string[] | null {
  if (selectedIds === null) return null
  const sortedSelected = [...selectedIds].sort()
  const sortedAll = [...allSheetMusicIds].sort()
  if (
    sortedAll.length > 0 &&
    sortedSelected.length === sortedAll.length &&
    sortedSelected.every((id, index) => id === sortedAll[index])
  ) {
    return null
  }
  return sortedSelected
}

export function normalizeArrangementDraftForDirtyCheck(
  draft: ArrangementDraft,
  allSheetMusicIds: string[] = [],
) {
  return {
    name: draft.name.trim(),
    keys: normalizeStringArray(draft.keys),
    tempos: normalizeNumberArray(draft.tempos),
    sectionOrder: normalizeStringArray(draft.sectionOrder),
    lyrics: draft.lyrics,
    sectionLyricsMap: normalizeSectionLyricsMap(draft.sectionLyricsMap),
    notes: normalizeOptionalString(draft.notes),
    sheetMusicFileIds: normalizeSheetMusicFileIds(draft.sheetMusicFileIds, allSheetMusicIds),
    pdfMetadata: draft.pdfMetadata,
    youtubeReference: normalizeYoutube(draft.youtubeReference),
    youtubeTitle: normalizeOptionalString(draft.youtubeTitle),
    isDefault: draft.isDefault,
    appliedPresetId: normalizeOptionalString(draft.appliedPresetId),
  }
}

export function areArrangementDraftsEqual(
  a: ArrangementDraft,
  b: ArrangementDraft,
  allSheetMusicIds: string[] = [],
): boolean {
  return JSON.stringify(normalizeArrangementDraftForDirtyCheck(a, allSheetMusicIds)) ===
    JSON.stringify(normalizeArrangementDraftForDirtyCheck(b, allSheetMusicIds))
}
```

- [ ] **Step 4: Use value-aware dirty state in ArrangementEditor**

In `components/shared/arrangement-editor/arrangement-editor.tsx`, import helper:

```ts
import { areArrangementDraftsEqual } from "./dirty-state"
```

Replace `useUnsavedChanges(initialDraft)` with local baseline state:

```tsx
const allSheetMusicIds = useMemo(
  () => availableSheetMusic.map((file) => file.id),
  [availableSheetMusic],
)
const [initialDirtyDraft, setInitialDirtyDraft] = useState<ArrangementDraft>(() => cloneDraft(initialDraft))
const isDirty = !areArrangementDraftsEqual(initialDirtyDraft, draft, allSheetMusicIds)
```

Move the existing `allSheetMusicIds` declaration above the dirty-state comparison so it is available before `isDirty` is computed. Remove the later duplicate declaration.

On open reset:

```tsx
setInitialDirtyDraft(nextDraft)
```

Remove `markDirty()` calls after `updateDraft`, `handleLyricsChange`, and preset load. When save succeeds:

```tsx
setDraft(cloneDraft(draftToSave))
setInitialDirtyDraft(cloneDraft(draftToSave))
```

When discarding changes:

```tsx
setInitialDirtyDraft(cloneDraft(draft))
onOpenChange(false)
```

Remove the `useUnsavedChanges` import if no longer used.

- [ ] **Step 5: Add source-level sheet-music loading**

In `components/shared/sheet-music-preview.tsx`, add a prop:

```ts
interface SheetMusicPreviewPaneProps {
  item: SheetMusicPreviewItem | null
  loading?: boolean
  className?: string
  imageClassName?: string
}
```

Render loading before empty state:

```tsx
if (!item && loading) {
  return (
    <section data-slot="sheet-music-preview-pane" aria-label="악보 미리보기" className={cn("rounded-lg border bg-background/70 p-3", className)}>
      <div className="flex aspect-[1/1.414] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
        <span className="text-sm text-muted-foreground">악보 불러오는 중...</span>
      </div>
    </section>
  )
}
```

In `components/contis/conti-song-editor.tsx`, add:

```tsx
const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
```

Wrap `refreshSheetMusic`:

```tsx
setSheetMusicLoading(true)
try {
  const result = await getSheetMusicForSong(songId)
  if (currentSongIdRef.current !== songId) {
    return []
  }
  if (result.success && result.data) {
    setSongSheetMusic(result.data)
    return result.data
  }
  return []
} finally {
  if (currentSongIdRef.current === songId) {
    setSheetMusicLoading(false)
  }
}
```

Pass to `ArrangementEditor` by adding an optional prop in `components/shared/arrangement-editor/types.ts`:

```ts
sheetMusicLoading?: boolean
```

Then pass `sheetMusicLoading` to `SheetMusicPreviewPane`.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
node --experimental-strip-types --test components/shared/arrangement-editor/dirty-state.test.ts components/shared/arrangement-editor/save-rules.test.ts
pnpm lint
```

Expected: tests PASS; lint PASS.

Commit:

```bash
git add components/shared/arrangement-editor/dirty-state.ts components/shared/arrangement-editor/dirty-state.test.ts components/shared/arrangement-editor/arrangement-editor.tsx components/shared/arrangement-editor/types.ts components/shared/sheet-music-preview.tsx components/contis/conti-song-editor.tsx
git commit -m "fix: make arrangement dirty state value aware"
```

## Task 4: YouTube Import Model And Preserve/Replace Server Behavior

**Files:**
- Create: `components/contis/youtube-import-model.ts`
- Test: `components/contis/youtube-import-model.test.ts`
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/actions/conti-songs.ts`
- Modify: `lib/repositories/storyboard/neon-repository.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`

- [ ] **Step 1: Add import model tests**

Create `components/contis/youtube-import-model.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import { buildBatchImportItems, type YouTubeImportReviewItem } from "./youtube-import-model.ts"

const existingItem: YouTubeImportReviewItem = {
  id: "yt-1",
  originalTitle: "주를 바라보며",
  editedName: "주를 바라보며",
  videoId: "playlist-video",
  matchedSong: { id: "song-1", name: "주를 바라보며" },
  isAlreadyInConti: false,
  excluded: false,
  selectedPresetId: "preset-1",
  createNewPreset: false,
  presetName: "2026-03-08",
  presets: [],
  existingYoutubeRef: "existing-video",
  replaceExistingYoutube: false,
}

test("keeps existing preset youtube by default", () => {
  const [item] = buildBatchImportItems([existingItem], "재광")
  assert.equal(item.videoId, "playlist-video")
  assert.equal(item.replaceExistingYoutube, false)
})

test("can explicitly replace existing preset youtube", () => {
  const [item] = buildBatchImportItems([
    { ...existingItem, replaceExistingYoutube: true },
  ], "재광")
  assert.equal(item.replaceExistingYoutube, true)
})

test("creates new songs with playlist youtube reference", () => {
  const [item] = buildBatchImportItems([
    {
      ...existingItem,
      matchedSong: null,
      selectedPresetId: null,
      createNewPreset: true,
      existingYoutubeRef: null,
      replaceExistingYoutube: true,
    },
  ], "재광")
  assert.equal(item.newSongName, "주를 바라보며")
  assert.equal(item.createNewPreset, true)
})
```

- [ ] **Step 2: Run import model tests and verify failure**

Run:

```bash
node --experimental-strip-types --test components/contis/youtube-import-model.test.ts
```

Expected: FAIL because `youtube-import-model.ts` does not exist.

- [ ] **Step 3: Implement shared import model types and payload builder**

Create `components/contis/youtube-import-model.ts`:

```ts
import type { Song, SongPreset } from "@/lib/types"

export interface YouTubeImportSongMatch {
  id: string
  name: string
}

export interface YouTubeImportReviewItem {
  id: string
  originalTitle: string
  editedName: string
  videoId: string
  matchedSong: Pick<Song, "id" | "name"> | YouTubeImportSongMatch | null
  isAlreadyInConti: boolean
  excluded: boolean
  selectedPresetId: string | null
  createNewPreset: boolean
  presetName: string
  presets: SongPreset[] | null
  existingYoutubeRef: string | null
  replaceExistingYoutube: boolean
}

export interface BatchImportPayloadItem {
  songId: string | null
  newSongName: string | null
  videoId: string | null
  title: string | null
  presetId: string | null
  createNewPreset: boolean
  presetName: string | null
  alreadyInConti: boolean
  replaceExistingYoutube: boolean
}

export function buildBatchImportItems(
  items: YouTubeImportReviewItem[],
  defaultPresetName: string,
): BatchImportPayloadItem[] {
  return items
    .filter((item) => !item.excluded)
    .map((item) => ({
      songId: item.matchedSong?.id ?? null,
      newSongName: item.matchedSong ? null : item.editedName.trim(),
      videoId: item.videoId,
      title: item.originalTitle,
      presetId: item.selectedPresetId,
      createNewPreset: item.createNewPreset || !item.matchedSong,
      presetName: item.presetName || defaultPresetName,
      alreadyInConti: item.isAlreadyInConti,
      replaceExistingYoutube: item.existingYoutubeRef ? item.replaceExistingYoutube : true,
    }))
}
```

- [ ] **Step 4: Extend action and repository item types**

In `lib/repositories/storyboard/types.ts`, add:

```ts
replaceExistingYoutube?: boolean;
```

to `BatchImportSongsToContiItem`.

In `lib/actions/conti-songs.ts`, extend `batchImportItemSchema`:

```ts
replaceExistingYoutube: z.boolean().optional().default(true),
```

Extend the public `items` type in `batchImportSongsToConti`:

```ts
replaceExistingYoutube?: boolean
```

- [ ] **Step 5: Preserve existing YouTube in Neon repository**

In `lib/repositories/storyboard/neon-repository.ts`, change the existing song + preset branch:

```ts
} else if (item.songId && item.presetId) {
  appliedPresetOverrides = await getPresetOverridesForSong(item.presetId, resolvedSongId);
  if (!appliedPresetOverrides) {
    throw new Error('PRESET_NOT_FOUND');
  }
  if (item.replaceExistingYoutube !== false) {
    await updateSongPresetYoutubeRef(db, item.presetId, item.videoId, item.title);
  }
  appliedPresetId = item.presetId;
}
```

- [ ] **Step 6: Preserve existing YouTube in Turso repository**

In `lib/repositories/storyboard/turso-repository.ts`, change the matching branch:

```ts
} else if (item.songId && item.presetId) {
  appliedPresetOverrides = await getPresetOverridesForSong(item.presetId, resolvedSongId);
  if (!appliedPresetOverrides) {
    throw new Error('PRESET_NOT_FOUND');
  }
  if (item.replaceExistingYoutube !== false) {
    await updateTursoSongPresetYoutubeRef(item.presetId, item.videoId, item.title);
  }
  appliedPresetId = item.presetId;
}
```

- [ ] **Step 7: Run tests and commit**

Run:

```bash
node --experimental-strip-types --test components/contis/youtube-import-model.test.ts
pnpm lint
```

Expected: tests PASS; lint PASS.

Commit:

```bash
git add components/contis/youtube-import-model.ts components/contis/youtube-import-model.test.ts lib/repositories/storyboard/types.ts lib/actions/conti-songs.ts lib/repositories/storyboard/neon-repository.ts lib/repositories/storyboard/turso-repository.ts
git commit -m "feat: preserve existing youtube references on import"
```

## Task 5: Refactor Import Dialog And Add New Conti Inline Wizard

**Files:**
- Create: `components/contis/youtube-import-review.tsx`
- Create: `components/contis/youtube-import-state.ts`
- Modify: `components/contis/youtube-import-dialog.tsx`
- Modify: `components/contis/conti-form.tsx`
- Modify: `app/(authenticated)/contis/new/page.tsx`

- [ ] **Step 1: Extract shared import state hook**

Create `components/contis/youtube-import-state.ts` with the state shape used by both the dialog and inline wizard:

```ts
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchYouTubePlaylist } from "@/lib/actions/youtube"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { Song } from "@/lib/types"
import type { YouTubeImportReviewItem } from "./youtube-import-model"

export type YouTubeImportStep = "url-input" | "review"

export function useYouTubeImportState({
  defaultPresetName,
  existingSongIds,
  allSongs,
}: {
  defaultPresetName: string
  existingSongIds: string[]
  allSongs: Song[]
}) {
  const [step, setStep] = useState<YouTubeImportStep>("url-input")
  const [url, setUrl] = useState("")
  const [items, setItems] = useState<YouTubeImportReviewItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [searchStates, setSearchStates] = useState<Record<string, string>>({})
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({})
  const existingSongSet = useMemo(() => new Set(existingSongIds), [existingSongIds])

  function resetState() {
    setStep("url-input")
    setUrl("")
    setItems([])
    setSearchStates({})
    setDropdownOpen({})
  }

  function detectDuplicates(nextItems: YouTubeImportReviewItem[]): YouTubeImportReviewItem[] {
    const matchedSongIds = new Map<string, string>()
    const newSongNames = new Map<string, string>()
    return nextItems.map((item) => {
      if (item.matchedSong) {
        const firstMatch = matchedSongIds.get(item.matchedSong.id)
        if (firstMatch && firstMatch !== item.id) return { ...item, excluded: true }
        matchedSongIds.set(item.matchedSong.id, item.id)
      } else if (item.editedName.trim()) {
        const normalizedName = item.editedName.trim().toLowerCase()
        const firstMatch = newSongNames.get(normalizedName)
        if (firstMatch && firstMatch !== item.id) return { ...item, excluded: true }
        newSongNames.set(normalizedName, item.id)
      }
      return item
    })
  }

  function handleFetchPlaylist() {
    if (!url.trim()) {
      toast.error("YouTube 플레이리스트 URL을 입력해주세요")
      return
    }
    startTransition(async () => {
      const result = await fetchYouTubePlaylist(url.trim())
      if (!result.success || !result.data) {
        toast.error(result.error ?? "플레이리스트를 불러오는 중 오류가 발생했습니다")
        return
      }
      setItems(result.data.map((item, index) => ({
        id: `yt-${index}`,
        originalTitle: item.title,
        editedName: item.title,
        videoId: item.videoId,
        matchedSong: null,
        isAlreadyInConti: false,
        excluded: false,
        selectedPresetId: null,
        createNewPreset: true,
        presetName: defaultPresetName,
        presets: null,
        existingYoutubeRef: null,
        replaceExistingYoutube: true,
      })))
      setStep("review")
    })
  }

  function handleEditName(itemId: string, newName: string) {
    setItems((current) => detectDuplicates(current.map((item) =>
      item.id === itemId ? { ...item, editedName: newName } : item
    )))
    setSearchStates((current) => ({ ...current, [itemId]: newName }))
  }

  function handleMatchSong(itemId: string, song: Song | null) {
    setItems((current) => detectDuplicates(current.map((item) =>
      item.id === itemId
        ? {
            ...item,
            matchedSong: song,
            isAlreadyInConti: song ? existingSongSet.has(song.id) : false,
            excluded: false,
            selectedPresetId: null,
            createNewPreset: true,
            presets: null,
            existingYoutubeRef: null,
            replaceExistingYoutube: true,
          }
        : item
    )))
    setDropdownOpen((current) => ({ ...current, [itemId]: false }))
    if (song) {
      getPresetsForSong(song.id).then((result) => {
        if (result.success && result.data) {
          setItems((current) => current.map((item) =>
            item.id === itemId ? { ...item, presets: result.data! } : item
          ))
        }
      })
    }
  }

  function handlePresetSelection(itemId: string, presetId: string | null) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item
      if (presetId === null) {
        return {
          ...item,
          selectedPresetId: null,
          createNewPreset: true,
          existingYoutubeRef: null,
          replaceExistingYoutube: true,
        }
      }
      const preset = item.presets?.find((candidate) => candidate.id === presetId)
      return {
        ...item,
        selectedPresetId: presetId,
        createNewPreset: false,
        existingYoutubeRef: preset?.youtubeReference ?? null,
        replaceExistingYoutube: false,
      }
    }))
  }

  function handleReplaceExistingYoutubeChange(itemId: string, replace: boolean) {
    setItems((current) => current.map((item) =>
      item.id === itemId ? { ...item, replaceExistingYoutube: replace } : item
    ))
  }

  function toggleExclude(itemId: string) {
    setItems((current) => current.map((item) =>
      item.id === itemId ? { ...item, excluded: !item.excluded } : item
    ))
  }

  function getMatchingSongs(itemId: string): Song[] {
    const search = searchStates[itemId]?.toLowerCase() || ""
    if (!search.trim()) return []
    return allSongs.filter((song) => song.name.toLowerCase().includes(search))
  }

  const importStats = {
    total: items.filter((item) => !item.excluded).length,
    newSongs: items.filter((item) => !item.excluded && !item.matchedSong).length,
    existingSongs: items.filter((item) => !item.excluded && item.matchedSong && !item.isAlreadyInConti).length,
    presetOnly: items.filter((item) => !item.excluded && item.isAlreadyInConti).length,
  }

  return {
    step,
    setStep,
    url,
    setUrl,
    items,
    isPending,
    searchStates,
    dropdownOpen,
    setDropdownOpen,
    resetState,
    handleFetchPlaylist,
    handleEditName,
    handleMatchSong,
    handlePresetSelection,
    handleReplaceExistingYoutubeChange,
    toggleExclude,
    getMatchingSongs,
    importStats,
  }
}
```

Preserve the current duplicate detection behavior. When selecting a preset with an existing YouTube reference, set:

```ts
existingYoutubeRef: preset?.youtubeReference ?? null,
replaceExistingYoutube: false,
```

When selecting a new preset, set:

```ts
existingYoutubeRef: null,
replaceExistingYoutube: true,
```

- [ ] **Step 2: Extract review presentation**

Create `components/contis/youtube-import-review.tsx`. It should render a vertical list of import item cards with an index column, editable song-name input, match dropdown, matched-song badge, preset selector, existing-YouTube keep/replace controls, and include checkbox.

Use this prop interface:

```tsx
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, MusicNote01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { Song } from "@/lib/types"
import type { YouTubeImportReviewItem } from "./youtube-import-model"

interface YouTubeImportReviewProps {
  items: YouTubeImportReviewItem[]
  searchStates: Record<string, string>
  dropdownOpen: Record<string, boolean>
  getMatchingSongs: (itemId: string) => Song[]
  onDropdownOpenChange: (itemId: string, open: boolean) => void
  onEditName: (itemId: string, newName: string) => void
  onMatchSong: (itemId: string, song: Song | null) => void
  onPresetSelection: (itemId: string, presetId: string | null) => void
  onReplaceExistingYoutubeChange: (itemId: string, replace: boolean) => void
  onToggleExclude: (itemId: string) => void
}
```

The component should map `items` and use the same card layout as the current dialog. The name input is:

```tsx
<Input
  value={item.editedName}
  onChange={(event) => onEditName(item.id, event.target.value)}
  onFocus={() => onDropdownOpenChange(item.id, true)}
  onBlur={() => window.setTimeout(() => onDropdownOpenChange(item.id, false), 200)}
  disabled={item.isAlreadyInConti}
  className="pr-8"
/>
```

The preset selector is:

```tsx
<select
  className="w-full rounded border bg-background px-2 py-1.5 text-sm"
  value={item.createNewPreset ? "__new__" : (item.selectedPresetId ?? "__new__")}
  onChange={(event) => {
    const value = event.target.value
    onPresetSelection(item.id, value === "__new__" ? null : value)
  }}
>
  <option value="__new__">새 프리셋 만들기</option>
  {item.presets === null ? (
    <option disabled>불러오는 중...</option>
  ) : (
    item.presets.map((preset) => (
      <option key={preset.id} value={preset.id}>
        {preset.name}{preset.youtubeReference ? " (YT 있음)" : ""}
      </option>
    ))
  )}
</select>
```

Add per-item controls when `item.existingYoutubeRef` exists:

```tsx
<div className="mt-2 flex flex-wrap gap-2 text-xs">
  <label className="inline-flex items-center gap-1">
    <input
      type="radio"
      checked={!item.replaceExistingYoutube}
      onChange={() => onReplaceExistingYoutubeChange(item.id, false)}
    />
    기존 YouTube 유지
  </label>
  <label className="inline-flex items-center gap-1">
    <input
      type="radio"
      checked={item.replaceExistingYoutube}
      onChange={() => onReplaceExistingYoutubeChange(item.id, true)}
    />
    playlist 영상으로 교체
  </label>
</div>
```

Replace the warning copy with:

```tsx
<p className="text-xs text-muted-foreground">
  이 프리셋에 이미 YouTube 레퍼런스가 있습니다.
</p>
```

- [ ] **Step 3: Refactor existing dialog to use shared hook and review**

In `components/contis/youtube-import-dialog.tsx`:

- remove local import item state duplicated into the hook;
- call `useYouTubeImportState`;
- render `YouTubeImportReview` in review step;
- use `buildBatchImportItems(items, defaultPresetName)` before calling `batchImportSongsToConti`;
- remove the global `confirm` overwrite warning.

Keep dialog layout, URL input, footer stats, and toast behavior equivalent to current behavior.

- [ ] **Step 4: Add inline wizard and `인도자` labels to ContiForm**

Extend `components/contis/conti-form.tsx` props:

```ts
import { batchImportSongsToConti } from "@/lib/actions/conti-songs"
import { buildBatchImportItems } from "@/components/contis/youtube-import-model"
import { useYouTubeImportState } from "@/components/contis/youtube-import-state"
import { YouTubeImportReview } from "@/components/contis/youtube-import-review"
import type { Song } from "@/lib/types"

export function ContiForm({
  conti,
  allSongs = [],
  enableInlineYouTubeImport = false,
}: {
  conti?: Conti
  allSongs?: Song[]
  enableInlineYouTubeImport?: boolean
}) {
```

Inside `ContiForm`, create import state after `isEdit`:

```tsx
const importState = useYouTubeImportState({
  defaultPresetName: title.trim() || date || "YouTube Import",
  existingSongIds: [],
  allSongs,
})
```

Change the conti `title` field label and placeholder:

```tsx
<FieldLabel>인도자 (선택사항)</FieldLabel>
<Input
  name="title"
  value={title}
  onChange={(event) => setTitle(event.target.value)}
  placeholder="인도자 이름을 입력하세요"
/>
```

When `enableInlineYouTubeImport && !isEdit`, render a section below description:

```tsx
<section className="rounded-lg border bg-card p-4">
  <h2 className="text-lg font-semibold">YouTube 재생목록 가져오기</h2>
  <p className="mt-1 text-sm text-muted-foreground">
    선택사항입니다. 비워두면 빈 콘티만 생성됩니다.
  </p>
  {importState.step === "url-input" ? (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <Input
        placeholder="YouTube 플레이리스트 URL을 붙여넣으세요"
        value={importState.url}
        onChange={(event) => importState.setUrl(event.target.value)}
        disabled={importState.isPending}
      />
      <Button
        type="button"
        onClick={importState.handleFetchPlaylist}
        disabled={!importState.url.trim() || importState.isPending}
      >
        {importState.isPending ? "불러오는 중..." : "불러오기"}
      </Button>
    </div>
  ) : (
    <YouTubeImportReview
      items={importState.items}
      searchStates={importState.searchStates}
      dropdownOpen={importState.dropdownOpen}
      getMatchingSongs={importState.getMatchingSongs}
      onDropdownOpenChange={(itemId, open) =>
        importState.setDropdownOpen((current) => ({ ...current, [itemId]: open }))
      }
      onEditName={importState.handleEditName}
      onMatchSong={importState.handleMatchSong}
      onPresetSelection={importState.handlePresetSelection}
      onReplaceExistingYoutubeChange={importState.handleReplaceExistingYoutubeChange}
      onToggleExclude={importState.toggleExclude}
    />
  )}
</section>
```

On submit, keep the edit/create branch explicit:

```ts
if (isEdit) {
  const result = await updateConti(conti.id, formData)
  if (result.success) {
    toast.success("콘티가 수정되었습니다")
    router.push(`/contis/${conti.id}`)
  } else {
    toast.error(result.error ?? "오류가 발생했습니다")
  }
  return
}

const hasReviewedPlaylist = enableInlineYouTubeImport && importState.step === "review"
const importItems = buildBatchImportItems(importState.items, title.trim() || date || "YouTube Import")
if (hasReviewedPlaylist && importItems.length === 0) {
  toast.error("가져올 항목이 없습니다")
  return
}

const result = await createConti(formData)
if (!result.success || !result.data) {
  toast.error(result.error ?? "오류가 발생했습니다")
  return
}
if (enableInlineYouTubeImport && importItems.length > 0) {
  const importResult = await batchImportSongsToConti(result.data.id, importItems)
  if (!importResult.success) {
    toast.error(`콘티는 생성됐지만 곡 가져오기에 실패했습니다: ${importResult.error}`)
    router.push(`/contis/${result.data.id}`)
    return
  }
}

toast.success("콘티가 생성되었습니다")
router.push(`/contis/${result.data.id}`)
```

This preserves edit mode and limits inline import behavior to new conti creation.

- [ ] **Step 5: Fetch songs on new conti page**

Update `app/(authenticated)/contis/new/page.tsx`:

```tsx
import { getSongs } from "@/lib/queries/songs"

export default async function NewContiPage() {
  const songs = await getSongs()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="새 콘티 만들기" />
      <ContiForm allSongs={songs} enableInlineYouTubeImport />
    </div>
  )
}
```

- [ ] **Step 6: Run tests and browser smoke**

Run:

```bash
node --experimental-strip-types --test components/contis/youtube-import-model.test.ts
pnpm lint
```

Use the in-app browser:

- `/contis/new` can create a conti without playlist import.
- `/contis/new` can fetch a playlist, review items inline, and submit.
- Existing conti detail YouTube import dialog still fetches and imports.
- Existing preset YouTube defaults to `기존 YouTube 유지`.

Commit:

```bash
git add components/contis/youtube-import-review.tsx components/contis/youtube-import-state.ts components/contis/youtube-import-dialog.tsx components/contis/conti-form.tsx 'app/(authenticated)/contis/new/page.tsx'
git commit -m "feat: add inline youtube import for new contis"
```

## Task 6: Final Integration Verification

**Files:**
- Modify: `package.json`
- No other planned source edits unless verification finds integration bugs.

- [ ] **Step 1: Add new test files to the fixed test script**

Update `package.json` so the `test` script includes the new tests created by this plan. The script should include these additional entries:

```json
"lib/auth-redirect.test.ts",
"components/shared/arrangement-editor/dirty-state.test.ts",
"components/contis/youtube-import-model.test.ts"
```

The resulting `test` script remains a single `node --experimental-strip-types --test` command with the existing file list plus the three new test files.

- [ ] **Step 2: Run full verification**

Run:

```bash
pnpm test
pnpm lint
```

Expected: all tests PASS; lint PASS.

- [ ] **Step 3: In-app browser QA**

Verify:

- `/` redirects to `/worship-prep`.
- Deep protected URL redirects back after login with query string preserved.
- Sidebar order is `예배 준비`, `콘티 목록`, `찬양 라이브러리`.
- Conti list no longer shows fake description rows.
- Song row click opens editor while action buttons keep their behavior.
- Drawer overlays without shrinking the detail page.
- Dirty dialog appears only after real edits.
- Sheet-music loading state does not show empty copy before previews load.
- Ordinary dialog and drawer outside clicks close; alert dialog outside click does not.
- Song library grid shows multiple cards per row on desktop.
- `/contis/new` supports empty creation and inline import.

- [ ] **Step 4: Commit integration package/test updates and fixes if needed**

If only `package.json` changed in this task:

```bash
git add package.json
git commit -m "test: include ui ux polish coverage"
```

If verification requires fixes, stage the concrete files changed by those fixes. For example, if final browser QA requires a drawer polish change in addition to the package script update:

```bash
git add package.json components/ui/drawer.tsx components/layout/app-shell.tsx
git commit -m "fix: complete ui ux polish integration"
```

If no fixes are needed, do not create an empty commit.
