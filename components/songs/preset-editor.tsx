"use client"

import { useEffect, useState } from "react"
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
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.resolve().then(() => {
      if (!cancelled) {
        setSheetMusicLoading(false)
        setSheetMusicPreviewItem(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [songId, preset?.id])

  useEffect(() => {
    if (!open) {
      let cancelled = false

      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSheetMusicLoading(false)
          setSheetMusicPreviewItem(null)
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [open])

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
      sheetMusicLoading={sheetMusicLoading}
      sheetMusicWorkspacePreview
      sheetMusicManagementSlot={
        sheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={sheetMusic}
            previewMode="controlled"
            onPreviewChange={setSheetMusicPreviewItem}
            onPreviewLoadingChange={setSheetMusicLoading}
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
