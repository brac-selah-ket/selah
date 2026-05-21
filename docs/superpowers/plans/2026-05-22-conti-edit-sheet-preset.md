# Conti Edit Sheet And Preset PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-song sheet music registration and preset PDF editing controls to the conti edit page.

**Architecture:** Reuse existing conti song editing instead of creating a parallel editor. The conti edit page will fetch the same song data as the detail page and render a song preparation section below `ContiForm`; `ContiSongEditor` will gain compact sheet music management and preset PDF edit entry points.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, server actions, shadcn/base-ui components, Hugeicons.

---

## File Structure

- Modify `app/(authenticated)/contis/[id]/edit/page.tsx`: fetch full conti and all songs, render song preparation below metadata form.
- Modify `components/contis/conti-detail.tsx`: add an edit-workspace mode for heading/actions text while preserving detail-page behavior.
- Modify `components/contis/conti-song-editor.tsx`: show sheet music uploader/gallery even when no files exist, refresh sheet music after upload/delete, and add a preset PDF editor dialog for the applied preset.
- Modify `components/songs/sheet-music-uploader.tsx`: add an optional `onUploaded` callback.
- Modify `components/songs/sheet-music-gallery.tsx`: add an optional `onDeleted` callback.
- Modify `lib/actions/song-presets.ts`: add a server action to fetch one preset with sheet music IDs by id if needed by the conti editor.
- Verification: `pnpm lint`, `pnpm build`.

### Task 1: Make Upload/Gallery Refreshable

**Files:**
- Modify: `components/songs/sheet-music-uploader.tsx`
- Modify: `components/songs/sheet-music-gallery.tsx`

- [ ] Add `onUploaded?: (file: SheetMusicFile) => void` to `SheetMusicUploaderProps`.
- [ ] Import `SheetMusicFile` from `@/lib/types`.
- [ ] After `uploadSheetMusic` succeeds, call `onUploaded?.(result.data)` when `result.data` exists.
- [ ] Add `onDeleted?: (fileId: string) => void` to `SheetMusicGalleryProps`.
- [ ] After `deleteSheetMusic` succeeds, call `onDeleted?.(fileId)`.
- [ ] Run `pnpm lint` and fix any type or lint failures in these files.

### Task 2: Add Sheet Music Management To Conti Song Editor

**Files:**
- Modify: `components/contis/conti-song-editor.tsx`

- [ ] Import `SheetMusicUploader` and `SheetMusicGallery`.
- [ ] Always render an `악보 등록` area in the right-side sheet music section, even when `songSheetMusic.length === 0`.
- [ ] Add a `refreshSheetMusic` helper that calls `getSheetMusicForSong(contiSong.songId)` and updates `songSheetMusic`.
- [ ] Use `onUploaded` to append the uploaded file to `songSheetMusic`.
- [ ] When `sheetMusicFileIds` is not null, append the uploaded file id to `sheetMusicFileIds` and call `markDirty()`.
- [ ] Use `onDeleted` to remove the deleted file from `songSheetMusic` and from `sheetMusicFileIds` when present.
- [ ] Keep `SheetMusicSelector` visible whenever at least one file exists.
- [ ] Run `pnpm lint` and fix any errors.

### Task 3: Add Preset PDF Editing From Conti Song Editor

**Files:**
- Modify: `components/contis/conti-song-editor.tsx`
- Modify: `lib/actions/song-presets.ts`

- [ ] Add `getSongPresetWithSheetMusic(presetId: string)` server action returning a `SongPresetWithSheetMusic`.
- [ ] In `ContiSongEditor`, track `pdfPresetEditorOpen` and `editingPreset`.
- [ ] Add a `프리셋 PDF 편집` button beside each preset row or near the applied preset indicator.
- [ ] When clicked, load the preset with sheet music ids, set `editingPreset`, and open the existing `PresetEditor` with `songId`, `preset`, `sheetMusic`, and `open`.
- [ ] On close after save, refresh presets and sheet music, then `router.refresh()`.
- [ ] If no preset is selected/applied, show a toast prompting the user to load or save a preset first.
- [ ] Run `pnpm lint` and fix any errors.

### Task 4: Put Song Preparation On The Conti Edit Page

**Files:**
- Modify: `app/(authenticated)/contis/[id]/edit/page.tsx`
- Modify: `components/contis/conti-detail.tsx`

- [ ] Update the page to fetch `[conti, allSongs]` with `Promise.all([getConti(id), getSongs()])`.
- [ ] Import and render `ContiDetail` below `ContiForm`.
- [ ] Add optional props to `ContiDetail`, such as `variant?: "detail" | "edit"` and `showDescription?: boolean`.
- [ ] In edit variant, hide the duplicate conti description and show a compact section title such as `곡별 준비`.
- [ ] Preserve add, remove, reorder, YouTube import, and per-song edit behavior.
- [ ] Run `pnpm lint` and fix any errors.

### Task 5: Final Verification

**Files:**
- Verify changed files only, then whole app.

- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] If build requires unavailable environment variables, report the exact missing variable or failure.
- [ ] Start `pnpm dev` if verification needs browser inspection.
- [ ] Open `/contis/[id]/edit` for a known conti id if one is available in local data.
- [ ] Confirm the edit page displays conti metadata and song preparation controls.
