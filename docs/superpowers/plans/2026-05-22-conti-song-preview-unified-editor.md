# Conti Song Preview And Unified Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expandable conti song preview tables and unify conti-song and song-preset editing behind one shared arrangement editor UX.

**Architecture:** Preserve the current DB model and server actions. Add shared read components for conti song summaries, a shared arrangement editor draft/UI layer, and thin context wrappers for conti-song and preset saves. Centralize YouTube URL parsing/display so every preset surface shows usable links.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, shadcn/base-ui primitives, @hugeicons/react, Tailwind CSS v4.

---

## File Structure

- Create `lib/utils/youtube.ts`: parse YouTube URLs and IDs, build canonical watch URLs, and produce short display text.
- Create `lib/utils/youtube.test.ts`: focused Node test for YouTube normalization.
- Modify `lib/types.ts`: add conti preview and shared arrangement draft types.
- Modify `lib/queries/contis.ts`: add `getContisWithSongSummaries()` for expandable list previews.
- Create `components/contis/conti-song-summary-table.tsx`: read/action table used by conti list and detail.
- Modify `components/contis/conti-card.tsx`: render one conti row with expand control and optional summary table.
- Modify `components/contis/conti-list.tsx`: pass preview data into rows and keep list empty state.
- Modify `app/(authenticated)/contis/page.tsx`: fetch preview-ready contis.
- Modify `components/contis/conti-detail.tsx`: replace current song row stack with the shared summary table in action mode.
- Keep `components/contis/conti-song-item.tsx` until the new summary table fully replaces it, then remove it if unused.
- Create `components/shared/arrangement-editor/types.ts`: shared editor draft/context types.
- Create `components/shared/arrangement-editor/arrangement-editor.tsx`: shared drawer/editor shell for both contexts, including the existing preset PDF editor entry point.
- Create `components/shared/arrangement-editor/index.ts`: re-export public editor APIs.
- Modify `components/contis/conti-song-editor.tsx`: make it a thin adapter around the shared editor.
- Modify `components/songs/preset-editor.tsx`: make it a thin adapter around the shared editor.
- Modify `components/songs/preset-list.tsx`: display YouTube references as clickable links.
- Modify `components/contis/song-picker.tsx`: display preset YouTube references as clickable links in preset selection.

## Task 1: YouTube Link Utilities

**Files:**
- Create: `lib/utils/youtube.ts`
- Create: `lib/utils/youtube.test.ts`

- [ ] **Step 1: Add a failing test for supported YouTube inputs**

Create `lib/utils/youtube.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"
import {
  extractYouTubeVideoId,
  formatYouTubeDisplayUrl,
  normalizeYouTubeReference,
  toYouTubeWatchUrl,
} from "./youtube.ts"

test("extractYouTubeVideoId accepts video IDs and common YouTube URLs", () => {
  assert.equal(extractYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
})

test("extractYouTubeVideoId rejects unsupported values", () => {
  assert.equal(extractYouTubeVideoId(""), null)
  assert.equal(extractYouTubeVideoId("not a video"), null)
  assert.equal(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null)
})

test("normalizeYouTubeReference returns storage and display values", () => {
  assert.deepEqual(normalizeYouTubeReference("https://youtu.be/dQw4w9WgXcQ"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    displayUrl: "youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.equal(normalizeYouTubeReference(null), null)
  assert.equal(normalizeYouTubeReference("   "), null)
})

test("toYouTubeWatchUrl and formatYouTubeDisplayUrl are stable", () => {
  assert.equal(toYouTubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(formatYouTubeDisplayUrl("dQw4w9WgXcQ"), "youtube.com/watch?v=dQw4w9WgXcQ")
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: FAIL because `lib/utils/youtube.ts` does not exist.

- [ ] **Step 3: Implement the YouTube utility**

Create `lib/utils/youtube.ts`:

```ts
export interface NormalizedYouTubeReference {
  videoId: string
  url: string
  displayUrl: string
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

export function extractYouTubeVideoId(value: string | null | undefined): string | null {
  const input = value?.trim()
  if (!input) return null
  if (YOUTUBE_VIDEO_ID_PATTERN.test(input)) return input

  try {
    const url = new URL(input)
    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      const candidate = url.pathname.split("/").filter(Boolean)[0]
      return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null
    }

    if (hostname === "youtube.com" || hostname === "music.youtube.com") {
      const watchId = url.searchParams.get("v")
      if (watchId && YOUTUBE_VIDEO_ID_PATTERN.test(watchId)) return watchId

      const parts = url.pathname.split("/").filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts")
      const candidate = embedIndex >= 0 ? parts[embedIndex + 1] : null
      return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null
    }
  } catch {
    return null
  }

  return null
}

export function toYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function formatYouTubeDisplayUrl(videoId: string): string {
  return `youtube.com/watch?v=${videoId}`
}

export function normalizeYouTubeReference(value: string | null | undefined): NormalizedYouTubeReference | null {
  const videoId = extractYouTubeVideoId(value)
  if (!videoId) return null

  return {
    videoId,
    url: toYouTubeWatchUrl(videoId),
    displayUrl: formatYouTubeDisplayUrl(videoId),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run lint for touched utility files**

Run:

```bash
pnpm lint
```

Expected: PASS or only pre-existing unrelated lint failures. Record any unrelated failures before continuing.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/youtube.ts lib/utils/youtube.test.ts
git commit -m "feat: add youtube reference helpers"
```

## Task 2: Conti Preview Types And Query

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/queries/contis.ts`
- Modify: `app/(authenticated)/contis/page.tsx`

- [ ] **Step 1: Add preview types**

In `lib/types.ts`, after `ContiWithSongs`, add:

```ts
export interface ContiSongSummary {
  id: string
  songId: string
  sortOrder: number
  songName: string
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  presetId: string | null
  presetName: string | null
  hasSheetMusicSelection: boolean
}

export interface ContiWithSongSummaries extends Conti {
  songSummaries: ContiSongSummary[]
  songCount: number
}
```

- [ ] **Step 2: Add the preview query**

In `lib/queries/contis.ts`, update the imports:

```ts
import { eq, desc, inArray } from 'drizzle-orm';
import type {
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
  PresetPdfMetadata,
  ContiWithSongSummaries,
} from '@/lib/types';
```

Then add this function after `getContis()`:

```ts
export async function getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
  const contiRows = await getContis();
  if (contiRows.length === 0) return [];

  const contiIds = contiRows.map((conti) => conti.id);

  const rows = await db
    .select({
      contiSong: contiSongs,
      songName: songs.name,
      presetName: songPresets.name,
    })
    .from(contiSongs)
    .leftJoin(songs, eq(contiSongs.songId, songs.id))
    .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
    .where(inArray(contiSongs.contiId, contiIds))
    .orderBy(contiSongs.sortOrder);

  const byContiId = new Map<string, ContiWithSongSummaries["songSummaries"]>();

  for (const row of rows) {
    const parsed = parseContiSongOverrides({
      keys: row.contiSong.keys,
      tempos: row.contiSong.tempos,
      sectionOrder: row.contiSong.sectionOrder,
      lyrics: row.contiSong.lyrics,
      sectionLyricsMap: row.contiSong.sectionLyricsMap,
      notes: row.contiSong.notes,
      sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
      presetId: row.contiSong.presetId,
    });

    const summaries = byContiId.get(row.contiSong.contiId) ?? [];
    summaries.push({
      id: row.contiSong.id,
      songId: row.contiSong.songId,
      sortOrder: row.contiSong.sortOrder,
      songName: row.songName ?? "알 수 없는 곡",
      keys: parsed.keys,
      tempos: parsed.tempos,
      sectionOrder: parsed.sectionOrder,
      presetId: parsed.presetId,
      presetName: row.presetName ?? null,
      hasSheetMusicSelection: parsed.sheetMusicFileIds !== null && parsed.sheetMusicFileIds.length > 0,
    });
    byContiId.set(row.contiSong.contiId, summaries);
  }

  return contiRows.map((conti) => {
    const songSummaries = byContiId.get(conti.id) ?? [];
    return {
      ...conti,
      songSummaries,
      songCount: songSummaries.length,
    };
  });
}
```

- [ ] **Step 3: Switch the conti list page to the preview query**

In `app/(authenticated)/contis/page.tsx`, replace:

```ts
import { getContis } from "@/lib/queries/contis"
```

with:

```ts
import { getContisWithSongSummaries } from "@/lib/queries/contis"
```

Then replace:

```ts
const contis = await getContis()
```

with:

```ts
const contis = await getContisWithSongSummaries()
```

- [ ] **Step 4: Run type and lint checks**

Run:

```bash
pnpm lint
pnpm build
```

Expected: PASS. If build fails because environment variables are missing, record the exact missing variable and continue only after confirming the failure is environmental.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/queries/contis.ts 'app/(authenticated)/contis/page.tsx'
git commit -m "feat: load conti song summaries"
```

## Task 3: Shared Conti Song Summary Table

**Files:**
- Create: `components/contis/conti-song-summary-table.tsx`

- [ ] **Step 1: Create the summary table component**

Create `components/contis/conti-song-summary-table.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import type { ContiSongSummary, ContiSongWithSong } from "@/lib/types"

type SummaryRow = ContiSongSummary | ContiSongWithSong

interface ContiSongSummaryTableProps {
  songs: SummaryRow[]
  mode: "read" | "action"
  onEdit?: (contiSongId: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  onRemove?: (contiSongId: string) => void
}

function isContiSongWithSong(song: SummaryRow): song is ContiSongWithSong {
  return "song" in song
}

function getSongName(song: SummaryRow): string {
  return isContiSongWithSong(song) ? song.song.name : song.songName
}

function getKeys(song: SummaryRow): string[] {
  return isContiSongWithSong(song) ? song.overrides.keys : song.keys
}

function getTempos(song: SummaryRow): number[] {
  return isContiSongWithSong(song) ? song.overrides.tempos : song.tempos
}

function getSectionOrder(song: SummaryRow): string[] {
  return isContiSongWithSong(song) ? song.overrides.sectionOrder : song.sectionOrder
}

function getPresetName(song: SummaryRow): string | null {
  if (!isContiSongWithSong(song)) return song.presetName
  return song.overrides.presetId ? "프리셋 적용" : null
}

function getSectionSummary(song: SummaryRow): string {
  const sections = getSectionOrder(song)
  return sections.length > 0 ? sections.join(" → ") : "-"
}

export function ContiSongSummaryTable({
  songs,
  mode,
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ContiSongSummaryTableProps) {
  if (songs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
        등록된 곡이 없습니다.
      </div>
    )
  }

  const showActions = mode === "action"

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-[3rem_1.3fr_5rem_5rem_minmax(12rem,1fr)_6rem_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
        <span>#</span>
        <span>곡</span>
        <span>Key</span>
        <span>BPM</span>
        <span>섹션</span>
        <span>프리셋</span>
        <span className={showActions ? "text-right" : "sr-only"}>작업</span>
      </div>
      {songs.map((song, index) => {
        const keys = getKeys(song)
        const tempos = getTempos(song)
        const presetName = getPresetName(song)

        return (
          <div
            key={song.id}
            className="grid grid-cols-[3rem_1.3fr_5rem_5rem_minmax(12rem,1fr)_6rem_auto] items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0"
          >
            <span className="font-semibold text-primary">{index + 1}</span>
            <span className="min-w-0 truncate font-medium">{getSongName(song)}</span>
            <span className="flex min-w-0 flex-wrap gap-1">
              {keys.length > 0 ? keys.map((key) => <Badge key={key} variant="key">{key}</Badge>) : "-"}
            </span>
            <span className="flex min-w-0 flex-wrap gap-1">
              {tempos.length > 0 ? tempos.map((tempo) => <Badge key={tempo} variant="tempo">{tempo}</Badge>) : "-"}
            </span>
            <span className="min-w-0 truncate text-muted-foreground">{getSectionSummary(song)}</span>
            <span className="min-w-0 truncate text-muted-foreground">{presetName ?? "-"}</span>
            {showActions ? (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="편집" onClick={() => onEdit?.(song.id)}>
                  <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="위로 이동" disabled={index === 0} onClick={() => onMoveUp?.(index)}>
                  <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="아래로 이동" disabled={index === songs.length - 1} onClick={() => onMoveDown?.(index)}>
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="삭제" onClick={() => onRemove?.(song.id)}>
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                </Button>
              </div>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS or actionable errors in `components/contis/conti-song-summary-table.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/contis/conti-song-summary-table.tsx
git commit -m "feat: add conti song summary table"
```

## Task 4: Expandable Conti List Rows

**Files:**
- Modify: `components/contis/conti-card.tsx`
- Modify: `components/contis/conti-list.tsx`

- [ ] **Step 1: Convert `ContiCard` to an expandable client row**

In `components/contis/conti-card.tsx`, add `"use client"` at the top, import `useState`, `Button`, and `ContiSongSummaryTable`, and change the prop type to:

```ts
import type { ContiWithSongSummaries } from "@/lib/types"

export function ContiCard({ conti }: { conti: ContiWithSongSummaries }) {
```

Inside the component, add:

```ts
const [expanded, setExpanded] = useState(false)
const keySummary = Array.from(
  new Set(conti.songSummaries.flatMap((song) => song.keys)),
).join("/")
const summaryText = [
  `${conti.songCount}곡`,
  keySummary || null,
].filter(Boolean).join(" · ")
```

Replace the current top-level `Link` with a wrapping `div`. Keep the title/date section as a `Link` to `/contis/${conti.id}` and add a separate button:

```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  onClick={() => setExpanded((current) => !current)}
  aria-expanded={expanded}
>
  {expanded ? "곡 닫기" : "곡 보기"}
</Button>
```

Render this below the row when `expanded` is true:

```tsx
{expanded && (
  <div className="border-t bg-background/35 p-3">
    <ContiSongSummaryTable songs={conti.songSummaries} mode="read" />
  </div>
)}
```

- [ ] **Step 2: Update `ContiList` prop type**

In `components/contis/conti-list.tsx`, replace:

```ts
import type { Conti } from "@/lib/types"
```

with:

```ts
import type { ContiWithSongSummaries } from "@/lib/types"
```

Then replace:

```ts
export function ContiList({ contis }: { contis: Conti[] }) {
```

with:

```ts
export function ContiList({ contis }: { contis: ContiWithSongSummaries[] }) {
```

- [ ] **Step 3: Run lint and build**

Run:

```bash
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Browser check `/contis`**

Run the dev server:

```bash
pnpm dev
```

Open `http://localhost:3000/contis`. Verify:

- Rows still navigate with "열기".
- "곡 보기" expands one row.
- Expanded table shows order, song, key, BPM, section, preset columns.
- Long section strings truncate instead of overflowing.

- [ ] **Step 5: Commit**

```bash
git add components/contis/conti-card.tsx components/contis/conti-list.tsx 'app/(authenticated)/contis/page.tsx'
git commit -m "feat: add expandable conti song previews"
```

## Task 5: Conti Detail Uses The Shared Summary Table

**Files:**
- Modify: `components/contis/conti-detail.tsx`

- [ ] **Step 1: Replace `ContiSongItem` rendering with `ContiSongSummaryTable`**

In `components/contis/conti-detail.tsx`, remove the `Fragment` and `ContiSongItem` imports and add:

```ts
import { ContiSongSummaryTable } from "@/components/contis/conti-song-summary-table"
```

Replace the `optimisticSongs.map(...)` block with:

The table passes each conti-song row id (`contiSong.id`) to `onEdit` and
`onRemove`, not the base song id (`songId`).

```tsx
<ContiSongSummaryTable
  songs={optimisticSongs}
  mode="action"
  onEdit={handleEdit}
  onMoveUp={handleMoveUp}
  onMoveDown={handleMoveDown}
  onRemove={handleRemove}
/>
{optimisticSongs.map((contiSong) => (
  editingId === contiSong.id ? (
    <ContiSongEditor
      key={contiSong.id}
      contiSong={contiSong}
      open={true}
      onOpenChange={(open) => {
        if (!open) setEditingId(null)
      }}
    />
  ) : null
))}
```

- [ ] **Step 2: Keep deletion confirmation behavior**

Because the old row had an inline confirmation dialog, add a delete confirmation in `ContiDetail` before calling `handleRemove`. Add local state:

```ts
const [removingId, setRemovingId] = useState<string | null>(null)
```

Pass `onRemove={setRemovingId}` to the table. Render the existing alert dialog pattern below the table, with confirm calling:

```ts
if (removingId) {
  handleRemove(removingId)
  setRemovingId(null)
}
```

- [ ] **Step 3: Run lint and browser check**

Run:

```bash
pnpm lint
```

Open a detail page such as `http://localhost:3000/contis/qtg7Igyu8V9n`. Verify:

- The song table renders.
- Edit opens the existing drawer.
- Move up/down still persists order.
- Delete prompts before removal.

- [ ] **Step 4: Commit**

```bash
git add components/contis/conti-detail.tsx
git commit -m "feat: use shared song table on conti detail"
```

## Task 6: Shared Arrangement Editor Types

**Files:**
- Create: `components/shared/arrangement-editor/types.ts`
- Create: `components/shared/arrangement-editor/index.ts`

- [ ] **Step 1: Add shared editor types**

Create `components/shared/arrangement-editor/types.ts`:

```ts
import type { ReactNode } from "react"
import type { PresetPdfMetadata, SheetMusicFile, SongPreset } from "@/lib/types"

export interface ArrangementDraft {
  name: string
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  sheetMusicFileIds: string[] | null
  pdfMetadata: PresetPdfMetadata | null
  youtubeReference: string | null
  isDefault: boolean
  appliedPresetId: string | null
}

export interface ArrangementEditorPresetOption extends SongPreset {
  sheetMusicFileIds?: string[]
}

export type ArrangementEditorMode = "conti-song" | "preset"

export interface ArrangementEditorSaveResult {
  success: boolean
  error?: string
}

export interface ArrangementEditorProps {
  mode: ArrangementEditorMode
  title: string
  songId: string
  songName: string
  open: boolean
  initialDraft: ArrangementDraft
  availableSheetMusic: SheetMusicFile[]
  presetOptions?: ArrangementEditorPresetOption[]
  sheetMusicManagementSlot?: ReactNode
  savingLabel?: string
  onOpenChange: (open: boolean) => void
  onSave: (draft: ArrangementDraft) => Promise<ArrangementEditorSaveResult>
  onLoadPreset?: (preset: ArrangementEditorPresetOption) => Promise<ArrangementDraft>
  onSaveAsPreset?: (draft: ArrangementDraft, presetName: string, existingPresetId?: string) => Promise<ArrangementEditorSaveResult>
  onRefreshPresetOptions?: () => Promise<void>
}
```

- [ ] **Step 2: Add re-export**

Create `components/shared/arrangement-editor/index.ts`:

```ts
export type {
  ArrangementDraft,
  ArrangementEditorMode,
  ArrangementEditorPresetOption,
  ArrangementEditorProps,
  ArrangementEditorSaveResult,
} from "./types"
export { ArrangementEditor } from "./arrangement-editor"
```

This will fail until Task 7 creates `arrangement-editor.tsx`.

- [ ] **Step 3: Commit type files after Task 7**

Do not commit yet because the re-export references a file created in Task 7.

## Task 7: Shared Arrangement Editor Component

**Files:**
- Create: `components/shared/arrangement-editor/arrangement-editor.tsx`
- Modify: `components/shared/arrangement-editor/index.ts`

- [ ] **Step 1: Create the shared editor component**

Create `components/shared/arrangement-editor/arrangement-editor.tsx` with this structure:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SheetMusicSelector } from "@/components/shared/sheet-music-selector"
import { OverrideEditorFields } from "@/components/shared/override-editor-fields"
import { PresetPdfEditor } from "@/components/songs/preset-pdf-editor"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
import type { ArrangementDraft, ArrangementEditorProps } from "./types"

function cloneDraft(draft: ArrangementDraft): ArrangementDraft {
  return {
    ...draft,
    keys: [...draft.keys],
    tempos: [...draft.tempos],
    sectionOrder: [...draft.sectionOrder],
    lyrics: [...draft.lyrics],
    sectionLyricsMap: { ...draft.sectionLyricsMap },
    sheetMusicFileIds: draft.sheetMusicFileIds ? [...draft.sheetMusicFileIds] : null,
  }
}

export function ArrangementEditor({
  mode,
  title,
  songId,
  songName,
  open,
  initialDraft,
  availableSheetMusic,
  presetOptions = [],
  sheetMusicManagementSlot,
  savingLabel = "저장",
  onOpenChange,
  onSave,
  onLoadPreset,
  onSaveAsPreset,
  onRefreshPresetOptions,
}: ArrangementEditorProps) {
  const [draft, setDraft] = useState<ArrangementDraft>(() => cloneDraft(initialDraft))
  const [isSaving, setIsSaving] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [pdfEditorOpen, setPdfEditorOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const { isDirty, markDirty, reset: resetDirty } = useUnsavedChanges(initialDraft)

  useEffect(() => {
    if (open) {
      setDraft(cloneDraft(initialDraft))
      setPresetName("")
      setSelectedPresetId("")
      resetDirty(initialDraft)
    }
  }, [initialDraft, open, resetDirty])

  const selectedSheetMusic = useMemo(() => {
    if (!draft.sheetMusicFileIds) return availableSheetMusic
    const selected = new Set(draft.sheetMusicFileIds)
    return availableSheetMusic.filter((file) => selected.has(file.id))
  }, [availableSheetMusic, draft.sheetMusicFileIds])

  function updateDraft(patch: Partial<ArrangementDraft>) {
    markDirty()
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleClose() {
    if (isDirty) {
      setShowUnsavedDialog(true)
      return
    }
    onOpenChange(false)
  }

  async function handleSave() {
    if (mode === "preset" && !draft.name.trim()) {
      toast.error("프리셋 이름을 입력해주세요")
      return
    }

    let draftToSave = draft
    if (draft.youtubeReference) {
      const normalized = normalizeYouTubeReference(draft.youtubeReference)
      if (!normalized) {
        toast.error("올바른 YouTube 링크 또는 영상 ID를 입력해주세요")
        return
      }
      draftToSave = { ...draft, youtubeReference: normalized.videoId }
    }

    setIsSaving(true)
    try {
      const result = await onSave(draftToSave)
      if (result.success) {
        toast.success(mode === "preset" ? "프리셋이 저장되었습니다" : "곡 설정이 저장되었습니다")
        resetDirty(draftToSave)
        onOpenChange(false)
      } else {
        toast.error(result.error ?? "저장 중 오류가 발생했습니다")
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLoadPreset(presetId: string) {
    const preset = presetOptions.find((item) => item.id === presetId)
    if (!preset || !onLoadPreset) return
    if (!confirm(`"${preset.name}" 프리셋을 불러오면 현재 설정이 덮어씌워집니다. 계속하시겠습니까?`)) return
    const nextDraft = await onLoadPreset(preset)
    setDraft(cloneDraft(nextDraft))
    markDirty()
  }

  async function handleSaveAsPreset() {
    if (!onSaveAsPreset) return
    const trimmedName = presetName.trim()
    if (!trimmedName) {
      toast.error("프리셋 이름을 입력해주세요")
      return
    }
    const result = await onSaveAsPreset(draft, trimmedName, selectedPresetId || undefined)
    if (result.success) {
      toast.success(selectedPresetId ? "프리셋이 업데이트되었습니다" : "새 프리셋이 저장되었습니다")
      setPresetName("")
      setSelectedPresetId("")
      await onRefreshPresetOptions?.()
    } else {
      toast.error(result.error ?? "프리셋 저장 중 오류가 발생했습니다")
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={handleClose}
        title={title}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "저장 중..." : savingLabel}
            </Button>
          </div>
        }
      >
        <div className="space-y-8">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{songName}</p>
          {mode === "preset" && (
            <Input
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="프리셋 이름"
            />
          )}
        </div>

        {mode === "conti-song" && presetOptions.length > 0 && onLoadPreset && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <h3 className="text-base font-medium">프리셋 불러오기</h3>
            <div className="flex flex-wrap gap-2">
              {presetOptions.map((preset) => (
                <Button key={preset.id} type="button" variant="outline" size="sm" onClick={() => handleLoadPreset(preset.id)}>
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-base font-medium" htmlFor="arrangement-youtube">
            YouTube 링크
          </label>
          <Input
            id="arrangement-youtube"
            value={draft.youtubeReference ?? ""}
            onChange={(event) => updateDraft({ youtubeReference: event.target.value || null })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <OverrideEditorFields
          keys={draft.keys}
          tempos={draft.tempos}
          sectionOrder={draft.sectionOrder}
          lyrics={draft.lyrics}
          sectionLyricsMap={draft.sectionLyricsMap}
          notes={draft.notes}
          sheetMusicFiles={selectedSheetMusic}
          onKeysTemposChange={(data) => updateDraft(data)}
          onSectionOrderChange={(data) => updateDraft(data)}
          onLyricsChange={(data) => updateDraft({ lyrics: data.lyrics })}
          onSectionLyricsMapChange={(data) => updateDraft(data)}
          onNotesChange={(notes) => updateDraft({ notes })}
        />

        {availableSheetMusic.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-medium">악보 선택</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setPdfEditorOpen(true)}>
                PDF 편집
              </Button>
            </div>
            {sheetMusicManagementSlot}
            <SheetMusicSelector
              songId={songId}
              selectedFileIds={draft.sheetMusicFileIds ?? []}
              availableFiles={availableSheetMusic}
              onSelectionChange={(ids) => updateDraft({ sheetMusicFileIds: ids.length > 0 ? ids : null })}
            />
          </div>
        )}

        {mode === "preset" && (
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(event) => updateDraft({ isDefault: event.target.checked })}
              className="size-5"
            />
            기본 프리셋으로 설정
          </label>
        )}

        {mode === "conti-song" && onSaveAsPreset && (
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <h3 className="text-base font-medium">프리셋으로 저장</h3>
            {presetOptions.length > 0 && (
              <select
                className="w-full rounded-lg border bg-background px-3 py-2 text-base"
                value={selectedPresetId}
                onChange={(event) => {
                  setSelectedPresetId(event.target.value)
                  const preset = presetOptions.find((item) => item.id === event.target.value)
                  setPresetName(preset?.name ?? "")
                }}
              >
                <option value="">새 프리셋 만들기</option>
                {presetOptions.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="프리셋 이름" />
              <Button type="button" onClick={handleSaveAsPreset}>
                {selectedPresetId ? "업데이트" : "저장"}
              </Button>
            </div>
          </div>
        )}
        </div>
      </Drawer>

      <Dialog open={pdfEditorOpen} onOpenChange={setPdfEditorOpen}>
        <DialogContent className="!h-[100dvh] !w-screen !max-w-none overflow-x-hidden overflow-y-auto rounded-none p-3 sm:!max-w-none sm:p-4">
          <PresetPdfEditor
            songName={draft.name.trim() || songName}
            sheetMusic={selectedSheetMusic}
            sectionOrder={draft.sectionOrder}
            tempos={draft.tempos}
            initialMetadata={draft.pdfMetadata}
            onSave={(metadata) => updateDraft({ pdfMetadata: metadata })}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경사항이 있습니다. 저장하지 않고 닫으시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              계속 편집
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setShowUnsavedDialog(false)
                resetDirty(initialDraft)
                onOpenChange(false)
              }}
            >
              저장하지 않고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Run lint and fix surfaced type errors**

Run:

```bash
pnpm lint
```

Expected: the new component type-checks with no direct state mutation in `handleSave`.

- [ ] **Step 3: Commit Task 6 and Task 7 together**

```bash
git add components/shared/arrangement-editor
git commit -m "feat: add shared arrangement editor shell"
```

## Task 8: Preset Editor Adapter

**Files:**
- Modify: `components/songs/preset-editor.tsx`

- [ ] **Step 1: Replace the large preset editor body with an adapter**

In `components/songs/preset-editor.tsx`, keep the public `PresetEditor` props. Replace the internal form UI with conversion helpers and `ArrangementEditor`.

Use these helper functions in the file:

```ts
import { ArrangementEditor, type ArrangementDraft } from "@/components/shared/arrangement-editor"
import { normalizeYouTubeReference } from "@/lib/utils/youtube"

function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

function presetToDraft(preset: SongPresetWithSheetMusic | undefined): ArrangementDraft {
  return {
    name: preset?.name ?? "",
    keys: parseJsonField<string[]>(preset?.keys ?? null, []),
    tempos: parseJsonField<number[]>(preset?.tempos ?? null, []),
    sectionOrder: parseJsonField<string[]>(preset?.sectionOrder ?? null, []),
    lyrics: parseJsonField<string[]>(preset?.lyrics ?? null, []),
    sectionLyricsMap: parseJsonField<Record<number, number[]>>(preset?.sectionLyricsMap ?? null, {}),
    notes: preset?.notes ?? null,
    sheetMusicFileIds: preset?.sheetMusicFileIds ?? [],
    pdfMetadata: parseJsonField(preset?.pdfMetadata ?? null, null),
    youtubeReference: preset?.youtubeReference ?? null,
    isDefault: preset?.isDefault ?? false,
    appliedPresetId: preset?.id ?? null,
  }
}
```

Render:

```tsx
<ArrangementEditor
  mode="preset"
  title={preset ? "프리셋 편집" : "프리셋 추가"}
  songId={songId}
  songName={preset?.name ?? "새 프리셋"}
  open={open}
  initialDraft={presetToDraft(preset)}
  availableSheetMusic={sheetMusic}
  savingLabel="저장"
  onOpenChange={onOpenChange}
  onSave={async (draft) => {
    const normalized = draft.youtubeReference ? normalizeYouTubeReference(draft.youtubeReference) : null
    const result = preset
      ? await updateSongPreset(preset.id, {
          name: draft.name,
          keys: draft.keys,
          tempos: draft.tempos,
          sectionOrder: draft.sectionOrder,
          lyrics: draft.lyrics,
          sectionLyricsMap: draft.sectionLyricsMap,
          notes: draft.notes,
          isDefault: draft.isDefault,
          youtubeReference: normalized?.videoId ?? null,
          sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
          pdfMetadata: draft.pdfMetadata,
        })
      : await createSongPreset(songId, {
          name: draft.name,
          keys: draft.keys,
          tempos: draft.tempos,
          sectionOrder: draft.sectionOrder,
          lyrics: draft.lyrics,
          sectionLyricsMap: draft.sectionLyricsMap,
          notes: draft.notes,
          isDefault: draft.isDefault,
          youtubeReference: normalized?.videoId ?? null,
          sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
          pdfMetadata: draft.pdfMetadata,
        })
    return { success: result.success, error: result.error }
  }}
/>
```

- [ ] **Step 2: Verify shared PDF editor support is used**

Confirm `ArrangementEditor` imports `PresetPdfEditor`, renders the `PDF 편집` button next to `악보 선택`, and passes the shared draft values to `PresetPdfEditor`:

```tsx
<PresetPdfEditor
  songName={draft.name.trim() || songName}
  sheetMusic={selectedSheetMusic}
  sectionOrder={draft.sectionOrder}
  tempos={draft.tempos}
  initialMetadata={draft.pdfMetadata}
  onSave={(metadata) => updateDraft({ pdfMetadata: metadata })}
/>
```

- [ ] **Step 3: Run lint and browser check song preset editing**

Run:

```bash
pnpm lint
```

Open a song detail page such as `http://localhost:3000/songs/UbZ10BYFcFaf`. Verify:

- "프리셋 추가" opens the shared editor.
- Existing preset edit opens the shared editor.
- Saving preserves key, tempo, sections, notes, sheet music selection, and YouTube reference.

- [ ] **Step 4: Commit**

```bash
git add components/songs/preset-editor.tsx components/shared/arrangement-editor
git commit -m "refactor: use shared editor for presets"
```

## Task 9: Conti Song Editor Adapter

**Files:**
- Modify: `components/contis/conti-song-editor.tsx`

- [ ] **Step 1: Convert conti song overrides to shared draft**

In `components/contis/conti-song-editor.tsx`, import:

```ts
import { ArrangementEditor, type ArrangementDraft, type ArrangementEditorPresetOption } from "@/components/shared/arrangement-editor"
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
```

Add:

```ts
function contiSongToDraft(contiSong: ContiSongWithSong): ArrangementDraft {
  return {
    name: contiSong.song.name,
    keys: contiSong.overrides.keys,
    tempos: contiSong.overrides.tempos,
    sectionOrder: contiSong.overrides.sectionOrder,
    lyrics: contiSong.overrides.lyrics,
    sectionLyricsMap: contiSong.overrides.sectionLyricsMap,
    notes: contiSong.overrides.notes,
    sheetMusicFileIds: contiSong.overrides.sheetMusicFileIds,
    pdfMetadata: null,
    youtubeReference: null,
    isDefault: false,
    appliedPresetId: contiSong.overrides.presetId,
  }
}
```

- [ ] **Step 2: Load presets and sheet music, then render `ArrangementEditor`**

Keep the existing lazy loading for `getPresetsForSong`, `getPresetSheetMusicFileIds`, and `getSheetMusicForSong`. Replace the drawer body with:

```tsx
<ArrangementEditor
  mode="conti-song"
  title="콘티 곡 편집"
  songId={contiSong.songId}
  songName={contiSong.song.name}
  open={open}
  initialDraft={contiSongToDraft(contiSong)}
  availableSheetMusic={songSheetMusic}
  sheetMusicManagementSlot={
    <div className="space-y-4 rounded-lg border bg-background/50 p-4">
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
        />
      )}
    </div>
  }
  presetOptions={presets as ArrangementEditorPresetOption[]}
  savingLabel="이 콘티에만 저장"
  onOpenChange={onOpenChange}
  onLoadPreset={async (preset) => {
    const fileIds = await getPresetSheetMusicFileIds(preset.id)
    return {
      name: contiSong.song.name,
      keys: parseJsonField<string[]>(preset.keys, []),
      tempos: parseJsonField<number[]>(preset.tempos, []),
      sectionOrder: parseJsonField<string[]>(preset.sectionOrder, []),
      lyrics: parseJsonField<string[]>(preset.lyrics, []),
      sectionLyricsMap: parseJsonField<Record<number, number[]>>(preset.sectionLyricsMap, {}),
      notes: preset.notes,
      sheetMusicFileIds: fileIds.length > 0 ? fileIds : null,
      pdfMetadata: null,
      youtubeReference: preset.youtubeReference,
      isDefault: false,
      appliedPresetId: preset.id,
    }
  }}
  onSave={async (draft) => {
    const result = await updateContiSong(contiSong.id, {
      keys: draft.keys,
      tempos: draft.tempos,
      sectionOrder: draft.sectionOrder,
      lyrics: draft.lyrics,
      sectionLyricsMap: draft.sectionLyricsMap,
      notes: draft.notes,
      sheetMusicFileIds: draft.sheetMusicFileIds,
      presetId: draft.appliedPresetId,
    })
    if (result.success) router.refresh()
    return { success: result.success, error: result.error }
  }}
  onSaveAsPreset={async (draft, presetName, existingPresetId) => {
    const normalized = draft.youtubeReference ? normalizeYouTubeReference(draft.youtubeReference) : null
    const saveResult = await updateContiSong(contiSong.id, {
      keys: draft.keys,
      tempos: draft.tempos,
      sectionOrder: draft.sectionOrder,
      lyrics: draft.lyrics,
      sectionLyricsMap: draft.sectionLyricsMap,
      notes: draft.notes,
      sheetMusicFileIds: draft.sheetMusicFileIds,
      presetId: draft.appliedPresetId,
    })
    if (!saveResult.success) return { success: false, error: saveResult.error }
    const presetResult = await saveContiSongAsPreset(contiSong.id, presetName, existingPresetId)
    if (normalized && existingPresetId && presetResult.success) {
      await updateSongPreset(existingPresetId, { youtubeReference: normalized.videoId })
    }
    return { success: presetResult.success, error: presetResult.error }
  }}
  onRefreshPresetOptions={async () => {
    await refreshPresets()
    router.refresh()
  }}
/>
```

- [ ] **Step 3: Verify sheet music upload support uses the slot**

Confirm `components/contis/conti-song-editor.tsx` still imports `SheetMusicUploader` and `SheetMusicGallery`, and that the `sheetMusicManagementSlot` shown in Step 2 calls the existing `handleSheetMusicUploaded` and `handleSheetMusicDeleted` handlers.

- [ ] **Step 4: Run lint and browser check conti song editing**

Run:

```bash
pnpm lint
```

Open `http://localhost:3000/contis/qtg7Igyu8V9n`. Verify:

- Edit opens the shared editor.
- "이 콘티에만 저장" updates conti song overrides.
- Loading a preset warns before overwriting the draft.
- Saving as a preset still creates or updates a preset.

- [ ] **Step 5: Commit**

```bash
git add components/contis/conti-song-editor.tsx components/shared/arrangement-editor
git commit -m "refactor: use shared editor for conti songs"
```

## Task 10: YouTube Links In Preset Lists And Pickers

**Files:**
- Modify: `components/songs/preset-list.tsx`
- Modify: `components/contis/song-picker.tsx`
- Modify: `components/contis/conti-song-editor.tsx` if preset option rendering remains there

- [ ] **Step 1: Use link helpers in preset list**

In `components/songs/preset-list.tsx`, import:

```ts
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
```

Inside the preset map, add:

```ts
const youtube = normalizeYouTubeReference(preset.youtubeReference)
```

Replace the current YouTube text block with:

```tsx
{youtube && (
  <div>
    <span className="font-medium">YouTube:</span>{" "}
    <a
      href={youtube.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {youtube.displayUrl}
    </a>
  </div>
)}
```

- [ ] **Step 2: Use link helpers in `SongPicker` preset selection**

In `components/contis/song-picker.tsx`, import:

```ts
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
```

Inside preset rendering, compute:

```ts
const youtube = normalizeYouTubeReference(preset.youtubeReference)
```

Render the link next to the preset name:

```tsx
{youtube && (
  <a
    href={youtube.url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-xs text-primary underline-offset-4 hover:underline"
    onClick={(event) => event.stopPropagation()}
  >
    {youtube.displayUrl}
  </a>
)}
```

- [ ] **Step 3: Run lint and browser check YouTube display**

Run:

```bash
pnpm lint
```

Manually verify:

- Preset list shows a clickable YouTube URL.
- Preset picker shows a clickable URL when a preset has `youtubeReference`.
- Long links do not overflow their row.

- [ ] **Step 4: Commit**

```bash
git add components/songs/preset-list.tsx components/contis/song-picker.tsx
git commit -m "feat: show preset youtube links"
```

## Task 11: Final Verification

**Files:**
- No planned edits unless verification exposes defects.

- [ ] **Step 1: Run all command checks**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
pnpm lint
pnpm build
```

Expected: PASS. If `pnpm build` fails because external env vars are unavailable, record the exact variable and confirm that `pnpm lint` and the YouTube test pass.

- [ ] **Step 2: Browser check conti list**

Run:

```bash
pnpm dev
```

Open `http://localhost:3000/contis`. Verify:

- Page loads.
- Rows preserve the simple list feel.
- Expanding a row shows the mini table.
- Multiple expansions do not cause visual overlap.

- [ ] **Step 3: Browser check conti detail**

Open a conti detail route with songs. Verify:

- Summary table columns fit on desktop.
- Edit, move, remove, add song, and YouTube import are still reachable.
- Delete requires confirmation.

- [ ] **Step 4: Browser check preset editing**

Open a song detail route with presets. Verify:

- Preset list shows YouTube links.
- Creating a preset accepts a full YouTube URL.
- Editing a preset accepts a raw video ID and displays it as a link after save.

- [ ] **Step 5: Browser check conti song editing**

From a conti detail page, edit a song. Verify:

- Shared editor appears.
- Save to this conti updates the row.
- Save as preset still appears and succeeds.
- Loading a preset warns before overwriting.

- [ ] **Step 6: Final status**

Run:

```bash
git status --short
```

Expected: clean working tree.
