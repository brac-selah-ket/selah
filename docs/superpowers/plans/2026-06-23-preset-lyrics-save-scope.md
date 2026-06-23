# Preset Lyrics Save Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add canonical `songs.lyrics` storage while letting single-preset saves choose between song-wide lyrics and preset-only lyrics.

**Architecture:** `songs.lyrics` becomes the default single-song lyric source. Single preset saves route edited lyrics to `songs.lyrics` unless the save confirmation checkbox requests a preset-only override. Mashup presets keep storing their combined lyrics in `song_presets.lyrics`.

**Tech Stack:** Next.js server actions, React client components, Drizzle schema/migrations, Vitest/source tests.

**Status:** Implemented locally against Turso. The local Turso DB received the 0004 one-off migration, then the Drizzle ledger was baselined with current 0000~0004 hashes so `drizzle-kit migrate` now exits successfully.

---

### Task 1: Turso Schema And Repository Lyrics Source

**Files:**
- Modify: `lib/db/turso-schema.ts`
- Modify: `lib/types.ts`
- Modify: `lib/repositories/storyboard/types.ts`
- Modify: `lib/repositories/storyboard/turso-repository.ts`
- Create: `drizzle/turso/0004_song_lyrics.sql`

- [x] Add `songs.lyrics` as a text JSON array column.
- [x] Insert new songs with `lyrics: '[]'`.
- [x] Expose `songLyrics?: string[]` on preset detail payloads.
- [x] Build mashup fallback lyrics from member `songs.lyrics` in member order.
- [x] Add repository update routing so single-preset lyrics can save to song-wide or preset-only storage.

### Task 2: Draft And Save Scope Rules

**Files:**
- Modify: `lib/utils/song-preset-draft.ts`
- Modify: `lib/utils/song-preset-draft.test.ts`
- Modify: `components/shared/arrangement-editor/save-rules.ts`
- Modify: `components/shared/arrangement-editor/save-rules.test.ts`

- [x] Add a failing test that `songPresetToDraft` falls back to `songLyrics` for single presets.
- [x] Add failing tests for single-preset lyrics confirmation rules.
- [x] Implement the minimal draft fallback and save-rule helpers.

### Task 3: Save Confirmation UI

**Files:**
- Modify: `components/shared/arrangement-editor/types.ts`
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`
- Modify: `components/songs/preset-editor.tsx`
- Modify: `components/songs/preset-list.tsx`
- Modify: `app/(authenticated)/songs/[id]/page.tsx`

- [x] Pass current song lyrics into new preset/editor drafts.
- [x] When a single preset has changed lyrics, show an alert before saving.
- [x] Add `이 프리셋에만 적용` checkbox to that alert.
- [x] Save with `lyricsSaveScope: 'song'` by default and `'preset'` when checked.
- [x] Skip the alert for unchanged lyrics and mashup presets.

### Task 4: Actions And Verification

**Files:**
- Modify: `lib/actions/song-presets.ts`
- Modify: `tests/cache-songs-source.test.mjs`
- Modify: `tests/song-preset-refresh-source.test.mjs`

- [x] Update the server action to accept lyrics save scope.
- [x] Invalidate affected song/preset pages after either save path.
- [x] Run focused tests, typecheck, and lint.
- [x] Apply the 0004 Turso migration to the local Turso DB with a one-off guarded SQL script.
- [x] Baseline the Turso `__drizzle_migrations` ledger with current 0000~0004 hashes.
- [x] Browser-smoke the save-scope alert and confirm the temporary edit was not persisted.
