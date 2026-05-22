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
  // null = all available sheet music, [] = none selected
  sheetMusicFileIds: string[] | null
  pdfMetadata: PresetPdfMetadata | null
  youtubeReference: string | null
  youtubeTitle: string | null
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
  onSaveAsPreset?: (
    draft: ArrangementDraft,
    presetName: string,
    existingPresetId?: string,
  ) => Promise<ArrangementEditorSaveResult>
  onRefreshPresetOptions?: () => Promise<void>
}
