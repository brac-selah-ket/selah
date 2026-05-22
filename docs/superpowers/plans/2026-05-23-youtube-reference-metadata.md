# YouTube Reference Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store YouTube video titles with song presets and render a single linked title consistently in song and conti surfaces.

**Architecture:** Keep `song_presets.youtube_reference` as the canonical video ID and add `song_presets.youtube_title` as cached display metadata. Normalize YouTube references at write boundaries, resolve titles server-side when possible, and render all read-only UI through one `YouTubeReferenceLink` component. Conti songs continue to store arrangement overrides only; their YouTube display comes from the applied preset.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle ORM, Vercel Postgres, node:test, shadcn/ui, @hugeicons/react.

---

## File Structure

- Modify `lib/db/schema.ts` to add `youtubeTitle` to `songPresets`.
- Add `drizzle/0007_youtube_title.sql` and update `drizzle/meta/_journal.json` plus a `0007_snapshot.json` using `npx drizzle-kit generate`.
- Modify `lib/types.ts` to expose `youtubeReference` and `youtubeTitle` on conti summary rows.
- Modify `lib/utils/youtube.ts` and `lib/utils/youtube.test.ts` for canonical input/display helpers.
- Create `lib/utils/youtube-title.ts` for title cleanup and `lib/actions/youtube-metadata.ts` for server-side metadata resolution.
- Modify `lib/actions/song-presets.ts`, `lib/actions/conti-songs.ts`, and `lib/db/insert-helpers.ts` so all preset write paths store reference and title together.
- Modify `lib/queries/contis.ts` so conti summaries include applied preset YouTube data.
- Modify `components/shared/arrangement-editor/types.ts`, `components/songs/preset-editor.tsx`, and `components/contis/conti-song-editor.tsx` so editor initial values show canonical full URLs.
- Create `components/shared/youtube-reference-link.tsx`.
- Modify `components/songs/preset-list.tsx`, `components/contis/song-picker.tsx`, and `components/contis/conti-song-summary-table.tsx` to use the shared linked-title display.

---

### Task 1: Pure YouTube Helpers

**Files:**
- Modify: `lib/utils/youtube.ts`
- Modify: `lib/utils/youtube.test.ts`

- [ ] **Step 1: Add failing tests for canonical input values and linked labels**

Update the existing import in `lib/utils/youtube.test.ts`:

```ts
import {
  getYouTubeReferenceLabel,
  extractYouTubeVideoId,
  formatYouTubeDisplayUrl,
  normalizeYouTubeReference,
  toYouTubeInputValue,
  toYouTubeWatchUrl,
} from "./youtube.ts"
```

Append these tests to the end of `lib/utils/youtube.test.ts`:

```ts
test("toYouTubeInputValue returns a canonical full watch URL", () => {
  assert.equal(toYouTubeInputValue("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(toYouTubeInputValue("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(toYouTubeInputValue(null), "")
  assert.equal(toYouTubeInputValue("not a video"), "")
})

test("getYouTubeReferenceLabel prefers a title and falls back to compact URL", () => {
  assert.equal(getYouTubeReferenceLabel("dQw4w9WgXcQ", "  My Video  "), "My Video")
  assert.equal(getYouTubeReferenceLabel("dQw4w9WgXcQ", null), "youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(getYouTubeReferenceLabel("not a video", "Title"), null)
})
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: FAIL because `getYouTubeReferenceLabel` and `toYouTubeInputValue` are not exported.

- [ ] **Step 3: Implement the pure helpers**

Add these exports to `lib/utils/youtube.ts`:

```ts
export function toYouTubeInputValue(value: string | null | undefined): string {
  const normalized = normalizeYouTubeReference(value)
  return normalized?.url ?? ""
}

export function getYouTubeReferenceLabel(
  value: string | null | undefined,
  title: string | null | undefined,
): string | null {
  const normalized = normalizeYouTubeReference(value)
  if (!normalized) return null

  const trimmedTitle = title?.trim()
  return trimmedTitle || normalized.displayUrl
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: PASS for all YouTube helper tests.

- [ ] **Step 5: Commit Task 1**

```bash
git add lib/utils/youtube.ts lib/utils/youtube.test.ts
git commit -m "feat: add youtube display helpers"
```

---

### Task 2: Database Schema And Types

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/types.ts`
- Create: generated Drizzle migration files under `drizzle/`

- [ ] **Step 1: Add the schema column**

In `lib/db/schema.ts`, add `youtubeTitle` immediately after `youtubeReference`:

```ts
  youtubeReference: text('youtube_reference'),
  youtubeTitle: text('youtube_title'),
```

- [ ] **Step 2: Add summary fields to app types**

In `lib/types.ts`, extend `ContiSongSummary`:

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
  youtubeReference: string | null
  youtubeTitle: string | null
  hasSheetMusicSelection: boolean
}
```

Add optional applied-preset display fields to `ContiSongWithSong`:

```ts
export interface ContiSongWithSong extends ContiSong {
  song: Song;
  overrides: ContiSongOverrides;
  appliedPreset?: Pick<SongPreset, 'id' | 'name' | 'youtubeReference' | 'youtubeTitle'> | null;
}
```

- [ ] **Step 3: Generate the Drizzle migration**

Run:

```bash
npx drizzle-kit generate
```

Expected: a new migration containing this SQL statement:

```sql
ALTER TABLE "song_presets" ADD COLUMN "youtube_title" text;
```

If Drizzle names the migration differently, keep the generated name and do not hand-edit the journal tag.

- [ ] **Step 4: Run TypeScript-adjacent validation**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: PASS. This task does not yet exercise the new DB field at runtime.

- [ ] **Step 5: Commit Task 2**

```bash
git add lib/db/schema.ts lib/types.ts drizzle
git commit -m "feat: add youtube title metadata column"
```

---

### Task 3: Server-Side Metadata Resolver

**Files:**
- Create: `lib/utils/youtube-title.ts`
- Create: `lib/actions/youtube-metadata.ts`
- Modify: `lib/actions/youtube.ts`

- [ ] **Step 1: Create the shared title cleaner**

Create `lib/utils/youtube-title.ts`:

```ts
export function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/\s*[\[\(]\s*(Official\s*(M\/?V|Video|Audio|Lyric\s*Video)|공식\s*(뮤직비디오|MV|영상)|Lyrics?\s*Video|가사\s*영상)\s*[\]\)]\s*/gi, '')
    .replace(/\s*[\[\(]\s*(?:4K|HD|HQ)\s*[\]\)]\s*/gi, '')
    .replace(/\s*\/\/\s*.*$/, '')
    .trim()
}
```

- [ ] **Step 2: Create a metadata resolver**

Create `lib/actions/youtube-metadata.ts`:

```ts
'use server'

import { normalizeYouTubeReference } from '@/lib/utils/youtube'
import { cleanYouTubeTitle } from '@/lib/utils/youtube-title'

export interface ResolvedYouTubeReference {
  videoId: string
  url: string
  displayUrl: string
  title: string | null
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string
    snippet?: {
      title?: string
    }
  }>
}

export async function fetchYouTubeVideoTitle(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    part: 'snippet',
    id: videoId,
    key: apiKey,
  })

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`)
    if (!response.ok) return null

    const data = (await response.json()) as YouTubeVideosResponse
    const title = data.items?.[0]?.snippet?.title
    return title ? cleanYouTubeTitle(title) || title : null
  } catch {
    return null
  }
}

export async function resolveYouTubeReferenceMetadata(
  value: string | null | undefined,
  preferredTitle?: string | null,
): Promise<ResolvedYouTubeReference | null> {
  const normalized = normalizeYouTubeReference(value)
  if (!normalized) return null

  const title = preferredTitle?.trim() || await fetchYouTubeVideoTitle(normalized.videoId)

  return {
    ...normalized,
    title: title || null,
  }
}
```

- [ ] **Step 3: Reuse the shared title cleaner in playlist import**

In `lib/actions/youtube.ts`, replace the local `cleanVideoTitle` function with an import:

```ts
import { cleanYouTubeTitle } from '@/lib/utils/youtube-title'
```

Then update the playlist item push:

```ts
title: cleanYouTubeTitle(item.snippet.title),
```

- [ ] **Step 4: Run a smoke validation**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add lib/actions/youtube.ts lib/actions/youtube-metadata.ts lib/utils/youtube-title.ts
git commit -m "feat: resolve youtube reference metadata"
```

---

### Task 4: Store Titles On Preset Write Paths

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/actions/song-presets.ts`
- Modify: `lib/actions/conti-songs.ts`
- Modify: `lib/db/insert-helpers.ts`

- [ ] **Step 1: Add title to preset payload types**

In `lib/types.ts`, update `SongPresetData`:

```ts
export interface SongPresetData {
  name: string;
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
```

- [ ] **Step 2: Extend validation and persistence in preset actions**

In `lib/actions/song-presets.ts`, add `youtubeTitle` to `presetSchema`:

```ts
  youtubeTitle: z.string().nullable().optional().default(null),
```

In `createSongPreset`, import and call the resolver:

```ts
import { resolveYouTubeReferenceMetadata } from '@/lib/actions/youtube-metadata';
```

After `const d = validation.data;`, add:

```ts
const resolvedYoutube = await resolveYouTubeReferenceMetadata(d.youtubeReference, d.youtubeTitle);
```

Set both fields in `presetRecord`:

```ts
youtubeReference: resolvedYoutube?.videoId ?? null,
youtubeTitle: resolvedYoutube?.title ?? null,
```

In `updateSongPreset`, before building `updateData`, add:

```ts
const resolvedYoutube =
  data.youtubeReference !== undefined
    ? await resolveYouTubeReferenceMetadata(data.youtubeReference, data.youtubeTitle)
    : undefined;
```

Replace the existing YouTube update logic with:

```ts
if (data.youtubeReference !== undefined) {
  updateData.youtubeReference = resolvedYoutube?.videoId ?? null;
  updateData.youtubeTitle = resolvedYoutube?.title ?? null;
} else if (data.youtubeTitle !== undefined) {
  updateData.youtubeTitle = data.youtubeTitle;
}
```

- [ ] **Step 3: Extend insert helpers for playlist import**

In `lib/db/insert-helpers.ts`, change the insert helper payload:

```ts
data: { name: string; youtubeReference?: string | null; youtubeTitle?: string | null }
```

Set the preset field:

```ts
youtubeReference: data.youtubeReference ?? null,
youtubeTitle: data.youtubeTitle ?? null,
```

Change `updateSongPresetYoutubeRef`:

```ts
export async function updateSongPresetYoutubeRef(
  tx: TxOrDb,
  presetId: string,
  youtubeReference: string | null,
  youtubeTitle?: string | null,
) {
  await tx
    .update(songPresets)
    .set({ youtubeReference, youtubeTitle: youtubeReference ? youtubeTitle ?? null : null, updatedAt: new Date() })
    .where(eq(songPresets.id, presetId))
}
```

- [ ] **Step 4: Pass playlist titles through conti import**

In `lib/actions/conti-songs.ts`, update YouTube import preset creation:

```ts
await insertSongPreset(db, resolvedSongId, {
  name: item.presetName || 'YouTube Import',
  youtubeReference: item.videoId,
  youtubeTitle: item.title,
})
```

Update preset reference overwrite:

```ts
await updateSongPresetYoutubeRef(db, item.presetId, item.videoId, item.title)
```

Apply the same `youtubeTitle: item.title` addition to the existing-song create-new-preset branch.

- [ ] **Step 5: Pass title through conti save-as-preset**

In `lib/actions/conti-songs.ts`, change `saveContiSongAsPreset` options:

```ts
options: { youtubeReference?: string | null; youtubeTitle?: string | null } = {},
```

Set:

```ts
const youtubePayload =
  youtubeReference !== undefined
    ? { youtubeReference, youtubeTitle: options.youtubeTitle ?? null }
    : {};
```

- [ ] **Step 6: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no errors. Existing warnings may remain.

- [ ] **Step 7: Commit Task 4**

```bash
git add lib/types.ts lib/actions/song-presets.ts lib/actions/conti-songs.ts lib/db/insert-helpers.ts
git commit -m "feat: persist youtube titles on presets"
```

---

### Task 5: Read Preset Metadata Into Conti And Editor Flows

**Files:**
- Modify: `lib/queries/contis.ts`
- Modify: `components/shared/arrangement-editor/types.ts`
- Modify: `components/songs/preset-editor.tsx`
- Modify: `components/contis/conti-song-editor.tsx`

- [ ] **Step 1: Include metadata in conti summary queries**

In `lib/queries/contis.ts`, extend the summary select:

```ts
.select({
  contiSong: contiSongs,
  songName: songs.name,
  presetName: songPresets.name,
  youtubeReference: songPresets.youtubeReference,
  youtubeTitle: songPresets.youtubeTitle,
})
```

Then include fields in the pushed summary:

```ts
youtubeReference: row.youtubeReference ?? null,
youtubeTitle: row.youtubeTitle ?? null,
```

- [ ] **Step 2: Include applied preset metadata in conti detail queries**

In `getConti`, change the select to explicit fields:

```ts
const contiSongsData = await db
  .select({
    contiSong: contiSongs,
    song: songs,
    preset: {
      id: songPresets.id,
      name: songPresets.name,
      youtubeReference: songPresets.youtubeReference,
      youtubeTitle: songPresets.youtubeTitle,
    },
  })
  .from(contiSongs)
  .leftJoin(songs, eq(contiSongs.songId, songs.id))
  .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
  .where(eq(contiSongs.contiId, id))
  .orderBy(contiSongs.sortOrder);
```

Map rows with:

```ts
const songsWithOverrides = contiSongsData.map((row) => ({
  ...row.contiSong,
  song: row.song!,
  appliedPreset: row.preset?.id ? row.preset : null,
  overrides: parseContiSongOverrides({
    keys: row.contiSong.keys,
    tempos: row.contiSong.tempos,
    sectionOrder: row.contiSong.sectionOrder,
    lyrics: row.contiSong.lyrics,
    sectionLyricsMap: row.contiSong.sectionLyricsMap,
    notes: row.contiSong.notes,
    sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
    presetId: row.contiSong.presetId,
  }),
}));
```

- [ ] **Step 3: Carry `youtubeTitle` in arrangement drafts**

In `components/shared/arrangement-editor/types.ts`, add:

```ts
  youtubeTitle: string | null
```

to `ArrangementDraft`.

- [ ] **Step 4: Show canonical URLs in preset editor initial state**

In `components/songs/preset-editor.tsx`, import `toYouTubeInputValue` and update draft conversion:

```ts
import { normalizeYouTubeReference, toYouTubeInputValue } from "@/lib/utils/youtube"
```

Set:

```ts
youtubeReference: toYouTubeInputValue(preset?.youtubeReference),
youtubeTitle: preset?.youtubeTitle ?? null,
```

When converting draft to action data, pass title:

```ts
youtubeTitle: normalized ? draft.youtubeTitle : null,
```

- [ ] **Step 5: Show applied preset URLs in conti editor initial state**

In `components/contis/conti-song-editor.tsx`, import `toYouTubeInputValue`.

In `contiSongToDraft`, set:

```ts
youtubeReference: toYouTubeInputValue(contiSong.appliedPreset?.youtubeReference),
youtubeTitle: contiSong.appliedPreset?.youtubeTitle ?? null,
```

In `presetToDraft`, set:

```ts
youtubeReference: toYouTubeInputValue(preset.youtubeReference),
youtubeTitle: preset.youtubeTitle ?? null,
```

In `onSaveAsPreset`, pass title:

```ts
normalized
  ? { youtubeReference: normalized.videoId, youtubeTitle: draft.youtubeTitle }
  : { youtubeReference: null, youtubeTitle: null },
```

- [ ] **Step 6: Keep editor title metadata in sync with the input**

In `components/shared/arrangement-editor/arrangement-editor.tsx`, clear stale title metadata whenever the user changes the YouTube input:

```tsx
onChange={(event) => updateDraft({
  youtubeReference: event.target.value || null,
  youtubeTitle: null,
})}
```

When `prepareDraftForSave` normalizes a reference, leave `draftToSave.youtubeTitle` unchanged. When it clears a reference, also clear title:

```ts
draftToSave.youtubeTitle = null
```

inside the empty-input branch.

- [ ] **Step 7: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no errors.

- [ ] **Step 8: Commit Task 5**

```bash
git add lib/queries/contis.ts components/shared/arrangement-editor/types.ts components/songs/preset-editor.tsx components/contis/conti-song-editor.tsx components/shared/arrangement-editor/arrangement-editor.tsx
git commit -m "feat: read youtube metadata into editors"
```

---

### Task 6: Shared Linked Title UI

**Files:**
- Create: `components/shared/youtube-reference-link.tsx`
- Modify: `components/songs/preset-list.tsx`
- Modify: `components/contis/song-picker.tsx`
- Modify: `components/contis/conti-song-summary-table.tsx`

- [ ] **Step 1: Create the shared link component**

Create `components/shared/youtube-reference-link.tsx`:

```tsx
"use client"

import { getYouTubeReferenceLabel, normalizeYouTubeReference } from "@/lib/utils/youtube"

interface YouTubeReferenceLinkProps {
  reference: string | null | undefined
  title?: string | null
  className?: string
  stopPropagation?: boolean
}

export function YouTubeReferenceLink({
  reference,
  title,
  className,
  stopPropagation = false,
}: YouTubeReferenceLinkProps) {
  const normalized = normalizeYouTubeReference(reference)
  const label = getYouTubeReferenceLabel(reference, title)

  if (!normalized || !label) return null

  return (
    <a
      href={normalized.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={label}
      onClick={(event) => {
        if (stopPropagation) event.stopPropagation()
      }}
    >
      {label}
    </a>
  )
}
```

- [ ] **Step 2: Use the component on song preset cards**

In `components/songs/preset-list.tsx`, remove direct `normalizeYouTubeReference` usage and import:

```ts
import { YouTubeReferenceLink } from "@/components/shared/youtube-reference-link"
```

Replace the `YT` badge and `YouTube:` block with:

```tsx
<YouTubeReferenceLink
  reference={preset.youtubeReference}
  title={preset.youtubeTitle}
  stopPropagation
  className="text-primary block truncate underline-offset-4 hover:underline"
/>
```

Place it in the metadata text stack after tempo/notes.

- [ ] **Step 3: Use the component in the song picker**

In `components/contis/song-picker.tsx`, replace the per-preset `youtube` calculation and link with:

```tsx
<YouTubeReferenceLink
  reference={preset.youtubeReference}
  title={preset.youtubeTitle}
  className="text-primary block truncate text-xs underline-offset-4 hover:underline"
  stopPropagation
/>
```

- [ ] **Step 4: Add YouTube column to conti summary table**

In `components/contis/conti-song-summary-table.tsx`, import `YouTubeReferenceLink`.

Add helpers:

```ts
function getYoutubeReference(song: SummaryRow): string | null {
  if (isContiSongWithSong(song)) return song.appliedPreset?.youtubeReference ?? null
  return song.youtubeReference
}

function getYoutubeTitle(song: SummaryRow): string | null {
  if (isContiSongWithSong(song)) return song.appliedPreset?.youtubeTitle ?? null
  return song.youtubeTitle
}
```

Change grid templates:

```ts
const gridTemplateClass = showActions
  ? "grid-cols-[3rem_1.2fr_5rem_5rem_minmax(12rem,1fr)_6rem_minmax(10rem,0.8fr)_auto]"
  : "grid-cols-[3rem_1.2fr_5rem_5rem_minmax(12rem,1fr)_6rem_minmax(10rem,0.8fr)]"
const tableMinWidthClass = showActions ? "min-w-[64rem]" : "min-w-[56rem]"
```

Add header:

```tsx
<span>YouTube</span>
```

after `프리셋`.

Render the column:

```tsx
<span className="min-w-0 truncate text-muted-foreground">
  <YouTubeReferenceLink
    reference={getYoutubeReference(song)}
    title={getYoutubeTitle(song)}
    className="text-primary block truncate underline-offset-4 hover:underline"
  />{" "}
  {!getYoutubeReference(song) && "-"}
</span>
```

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no errors.

- [ ] **Step 6: Commit Task 6**

```bash
git add components/shared/youtube-reference-link.tsx components/songs/preset-list.tsx components/contis/song-picker.tsx components/contis/conti-song-summary-table.tsx
git commit -m "feat: show youtube titles as links"
```

---

### Task 7: Verification And Browser Smoke

**Files:**
- No required code files. This task verifies the integrated behavior.

- [ ] **Step 1: Run helper tests**

Run:

```bash
node --experimental-strip-types --test lib/utils/youtube.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no errors. Existing warnings may remain.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS. If Google Fonts fail due network sandboxing, rerun with approved network access.

- [ ] **Step 4: Browser smoke the song library**

Start the app:

```bash
pnpm dev
```

Open `/songs/CU62qxCFsq1T`.

Expected:

- The preset card shows a linked YouTube title when `youtubeTitle` exists.
- The old `YT` badge is gone.
- The old `YouTube: youtube.com/watch?...` label is gone when title exists.
- Opening preset edit shows the input as `https://www.youtube.com/watch?v=ShcrG8ENGpY`, not `ShcrG8ENGpY`.

- [ ] **Step 5: Browser smoke conti surfaces**

Open `/contis/qtg7Igyu8V9n`.

Expected:

- The conti detail table has a YouTube column.
- Rows with applied preset metadata show the linked title.
- Rows without metadata show `-`.
- Opening the matching conti song editor shows the full canonical URL when the applied preset has a YouTube reference.

Open `/contis`, expand the same conti.

Expected:

- The expanded preview table uses the same linked title display.

- [ ] **Step 6: Browser smoke song picker**

On `/contis/qtg7Igyu8V9n`, open `곡 추가`, select a song with a YouTube preset.

Expected:

- The preset step shows the linked title under the preset name.
- Clicking the title does not select the preset because the link stops propagation.

- [ ] **Step 7: Commit any verification-only fixes**

If verification required code fixes in the YouTube display files, commit them:

```bash
git add lib components drizzle
git commit -m "fix: align youtube title display"
```

If no fixes were required, do not create an empty commit.
