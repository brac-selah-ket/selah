"use client"

import { ArrangementEditor, type ArrangementDraft } from "@/components/shared/arrangement-editor"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
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
    sheetMusicFileIds: preset?.sheetMusicFileIds ?? [],
    pdfMetadata: parseJsonField(preset?.pdfMetadata ?? null, null),
    youtubeReference: preset?.youtubeReference ?? null,
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
    notes: draft.notes,
    isDefault: draft.isDefault,
    youtubeReference: normalized?.videoId ?? null,
    sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
    pdfMetadata: draft.pdfMetadata,
  }
}

export function PresetEditor({ songId, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  return (
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
        const data = draftToPresetData(draft)
        const result = preset
          ? await updateSongPreset(preset.id, data)
          : await createSongPreset(songId, data)

        return { success: result.success, error: result.error }
      }}
    />
  )
}
