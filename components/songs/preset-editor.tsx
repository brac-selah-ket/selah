"use client"

import { useEffect, useState } from "react"
import { ArrangementEditor, type ArrangementDraft } from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import { normalizeYouTubeReference, toYouTubeInputValue } from "@/lib/utils/youtube"
import type {
  SheetMusicFile,
  SongPresetData,
  SongPresetWithSheetMusic,
} from "@/lib/types"

interface PresetEditorProps {
  songId: string
  preset?: SongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
    sheetMusicFileIds: preset?.sheetMusicFileIds?.length ? preset.sheetMusicFileIds : null,
    pdfMetadata: parseJsonField(preset?.pdfMetadata ?? null, null),
    youtubeReference: toYouTubeInputValue(preset?.youtubeReference),
    youtubeTitle: preset?.youtubeTitle ?? null,
    isDefault: preset?.isDefault ?? false,
    appliedPresetId: preset?.id ?? null,
  }
}

function draftToPresetData(draft: ArrangementDraft): SongPresetData {
  const normalized = draft.youtubeReference
    ? normalizeYouTubeReference(draft.youtubeReference)
    : null

  return {
    name: draft.name,
    keys: draft.keys,
    tempos: draft.tempos,
    sectionOrder: draft.sectionOrder,
    lyrics: draft.lyrics,
    sectionLyricsMap: draft.sectionLyricsMap,
    notes: draft.notes?.trim() || null,
    isDefault: draft.isDefault,
    // ArrangementEditor validates this before save, so this preserves the normalized video ID.
    youtubeReference: normalized?.videoId ?? null,
    youtubeTitle: normalized ? draft.youtubeTitle : null,
    // Preset actions/DB use [] (no association rows) to mean all sheet music.
    sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
    pdfMetadata: draft.pdfMetadata,
  }
}

export function PresetEditor({ songId, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)

  useEffect(() => {
    let cancelled = false

    void Promise.resolve().then(() => {
      if (!cancelled) {
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
      initialDraft={presetToDraft(preset)}
      availableSheetMusic={sheetMusic}
      sheetMusicPreviewItem={sheetMusicPreviewItem}
      sheetMusicWorkspacePreview
      sheetMusicManagementSlot={
        sheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={sheetMusic}
            previewMode="controlled"
            onPreviewChange={setSheetMusicPreviewItem}
          />
        ) : null
      }
      savingLabel="저장"
      onOpenChange={onOpenChange}
      onSave={async (draft) => {
        const data = draftToPresetData(draft)
        const result = preset
          ? await updateSongPreset(preset.id, data)
          : await createSongPreset(songId, data)

        return { success: result.success, error: result.error }
      }}
    />
  )
}
