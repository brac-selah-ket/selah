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
  const initialDraft = songPresetToDraft(preset)
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
    (open && sheetMusic.length > 0 && !currentPreviewItem && !sheetMusicPreviewPrepared)

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
      availableSheetMusic={sheetMusic}
      sheetMusicPreviewItem={currentPreviewItem}
      sheetMusicLoading={previewLoading}
      sheetMusicWorkspacePreview
      showDisplayTitleField={preset?.presetType === "mashup" || Boolean(initialDraft.displayTitle)}
      showDefaultPresetField={preset?.presetType !== "mashup"}
      sheetMusicManagementSlot={
        sheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={sheetMusic}
            previewMode="controlled"
            onPreviewChange={handleSheetMusicPreviewChange}
            onPreviewLoadingChange={handlePreviewLoadingChange}
          />
        ) : null
      }
      savingLabel="저장"
      onOpenChange={handleEditorOpenChange}
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
