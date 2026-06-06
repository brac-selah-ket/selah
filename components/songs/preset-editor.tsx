"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrangementEditor } from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import {
  arrangementDraftToSongPresetData,
  songPresetToDraft,
} from "@/lib/utils/song-preset-draft"
import type {
  SheetMusicFile,
  SongPresetWithSheetMusic,
} from "@/lib/types"

interface PresetEditorProps {
  songId: string
  preset?: SongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PresetEditor({ songId, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  const router = useRouter()
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
  const [sheetMusicPreviewPrepared, setSheetMusicPreviewPrepared] = useState(false)
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
  const openRef = useRef(open)

  useLayoutEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (open) {
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
  }, [open, songId, preset?.id])

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

  const previewLoading =
    sheetMusicLoading ||
    (open && sheetMusic.length > 0 && !sheetMusicPreviewItem && !sheetMusicPreviewPrepared)

  function handlePreviewLoadingChange(loading: boolean) {
    if (!openRef.current) {
      return
    }

    setSheetMusicLoading(loading)
    setSheetMusicPreviewPrepared(!loading)
  }

  return (
    <ArrangementEditor
      mode="preset"
      title={preset ? "프리셋 편집" : "프리셋 추가"}
      songId={songId}
      songName={preset?.name ?? "새 프리셋"}
      open={open}
      initialDraft={songPresetToDraft(preset)}
      availableSheetMusic={sheetMusic}
      sheetMusicPreviewItem={sheetMusicPreviewItem}
      sheetMusicLoading={previewLoading}
      sheetMusicWorkspacePreview
      sheetMusicManagementSlot={
        sheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={sheetMusic}
            previewMode="controlled"
            onPreviewChange={setSheetMusicPreviewItem}
            onPreviewLoadingChange={handlePreviewLoadingChange}
          />
        ) : null
      }
      savingLabel="저장"
      onOpenChange={onOpenChange}
      onSave={async (draft) => {
        const data = arrangementDraftToSongPresetData(draft)
        const result = preset
          ? await updateSongPreset(preset.id, data)
          : await createSongPreset(songId, data)

        if (result.success) {
          router.refresh()
        }

        return { success: result.success, error: result.error }
      }}
    />
  )
}
