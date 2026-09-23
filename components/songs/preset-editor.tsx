"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrangementEditor } from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { SheetMusicUploader } from "@/components/songs/sheet-music-uploader"
import { resolvePresetLyricsSave } from "@/components/shared/arrangement-editor/save-rules"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import {
  arrangementDraftToSongPresetData,
  songPresetToDraft,
} from "@/lib/utils/song-preset-draft"
import { buildPresetEditorSheetMusic } from "@/lib/utils/preset-editor-sheet-music"
import type {
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  SongPresetData,
} from "@/lib/types"
import type { ArrangementEditorSaveOptions } from "@/components/shared/arrangement-editor/types"

interface PresetEditorProps {
  songId: string
  songLyrics: string[]
  preset?: ResolvedSongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function omitLyrics(data: SongPresetData): Partial<SongPresetData> {
  const next: Partial<SongPresetData> = { ...data }
  delete next.lyrics
  return next
}

export function PresetEditor({ songId, songLyrics, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  const router = useRouter()
  const initialDraft = preset
    ? songPresetToDraft(preset)
    : { ...songPresetToDraft(undefined), lyrics: songLyrics }
  const isMashup = preset?.presetType === "mashup"
  // Uploads and deletes show up immediately; the refreshed server props then
  // catch up and replace these local adjustments.
  const [uploadedSheetMusic, setUploadedSheetMusic] = useState<SheetMusicFile[]>([])
  const [deletedSheetMusicIds, setDeletedSheetMusicIds] = useState<string[]>([])
  const songSheetMusic = useMemo(() => {
    const deletedIds = new Set(deletedSheetMusicIds)
    const knownIds = new Set(sheetMusic.map((file) => file.id))
    return [
      ...sheetMusic,
      ...uploadedSheetMusic.filter((file) => !knownIds.has(file.id)),
    ].filter((file) => !deletedIds.has(file.id))
  }, [deletedSheetMusicIds, sheetMusic, uploadedSheetMusic])
  const editorSheetMusic = buildPresetEditorSheetMusic(preset, songSheetMusic)
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
  const [sheetMusicPreviewPrepared, setSheetMusicPreviewPrepared] = useState(false)
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
  const openRef = useRef(open)

  useLayoutEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!open) {
      let cancelled = false

      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSheetMusicLoading(false)
          setSheetMusicPreviewPrepared(false)
          setSheetMusicPreviewItem(null)
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [open])

  const currentPreviewItem = sheetMusicPreviewPrepared ? sheetMusicPreviewItem : null
  const previewLoading =
    sheetMusicLoading ||
    (open && editorSheetMusic.length > 0 && !currentPreviewItem && !sheetMusicPreviewPrepared)

  function resetSheetMusicPreviewState() {
    setSheetMusicLoading(false)
    setSheetMusicPreviewPrepared(false)
    setSheetMusicPreviewItem(null)
  }

  function handleEditorOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      openRef.current = false
      resetSheetMusicPreviewState()
    }

    onOpenChange(nextOpen)
  }

  function handlePreviewLoadingChange(loading: boolean) {
    if (!openRef.current) {
      return
    }

    setSheetMusicLoading(loading)
    setSheetMusicPreviewPrepared(!loading)
  }

  function handleSheetMusicPreviewChange(item: SheetMusicPreviewItem | null) {
    if (!openRef.current) {
      return
    }

    setSheetMusicPreviewItem(item)
  }

  function handleSheetMusicUploaded(file: SheetMusicFile) {
    setUploadedSheetMusic((current) =>
      current.some((item) => item.id === file.id) ? current : [...current, file],
    )
    router.refresh()
  }

  function handleSheetMusicDeleted(fileId: string) {
    setDeletedSheetMusicIds((current) => [...current, fileId])
    setSheetMusicPreviewItem((current) => (current?.file.id === fileId ? null : current))
    router.refresh()
  }

  if (!open) {
    return null
  }

  return (
    <ArrangementEditor
      mode="preset"
      title={preset ? "프리셋 편집" : "프리셋 추가"}
      songId={songId}
      songName={preset?.name ?? "새 프리셋"}
      open={open}
      initialDraft={initialDraft}
      availableSheetMusic={editorSheetMusic}
      sheetMusicPreviewItem={currentPreviewItem}
      sheetMusicLoading={previewLoading}
      sheetMusicWorkspacePreview
      showDisplayTitleField={preset?.presetType === "mashup" || Boolean(initialDraft.displayTitle)}
      showDefaultPresetField={preset?.presetType !== "mashup"}
      presetType={preset?.presetType ?? null}
      hasExistingPreset={Boolean(preset)}
      sheetMusicManagementSlot={
        isMashup ? (
          editorSheetMusic.length > 0 ? (
            <SheetMusicGallery
              files={editorSheetMusic}
              previewMode="controlled"
              onPreviewChange={handleSheetMusicPreviewChange}
              onPreviewLoadingChange={handlePreviewLoadingChange}
            />
          ) : null
        ) : (
          <div className="space-y-4">
            <SheetMusicUploader songId={songId} onUploaded={handleSheetMusicUploaded} />
            {editorSheetMusic.length > 0 && (
              <SheetMusicGallery
                files={editorSheetMusic}
                editable
                songId={songId}
                onDeleted={handleSheetMusicDeleted}
                previewMode="controlled"
                onPreviewChange={handleSheetMusicPreviewChange}
                onPreviewLoadingChange={handlePreviewLoadingChange}
              />
            )}
          </div>
        )
      }
      onOpenChange={handleEditorOpenChange}
      onSave={async (draft, options?: ArrangementEditorSaveOptions) => {
        const data = arrangementDraftToSongPresetData(draft)
        const { includeLyrics } = resolvePresetLyricsSave({
          presetType: preset?.presetType ?? null,
          hasExistingPreset: Boolean(preset),
          baselineLyrics: initialDraft.lyrics,
          draftLyrics: draft.lyrics,
        })
        const payload = includeLyrics || options?.lyricsSaveScope ? data : omitLyrics(data)
        const result = preset
          ? await updateSongPreset(preset.id, payload, options)
          : await createSongPreset(songId, data)

        if (result.success) {
          router.refresh()
        }

        return { success: result.success, error: result.error }
      }}
    />
  )
}
