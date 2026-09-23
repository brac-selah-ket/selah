import type { ReactNode } from "react"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import type {
  PresetPdfMetadata,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  SongPreset,
} from "@/lib/types"

export interface ArrangementDraft {
  name: string
  displayTitle: string | null
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  // null = all available sheet music; [] is a transient invalid selection blocked on save.
  sheetMusicFileIds: string[] | null
  pdfMetadata: PresetPdfMetadata | null
  youtubeReference: string | null
  youtubeTitle: string | null
  isDefault: boolean
  appliedPresetId: string | null
}

export type ArrangementEditorPresetOption = ResolvedSongPresetWithSheetMusic

export type ArrangementEditorMode = "conti-song" | "preset"

export interface ArrangementEditorSaveResult {
  success: boolean
  error?: string
}

export interface ArrangementEditorSaveOptions {
  lyricsSaveScope?: "song" | "preset"
}

export interface ArrangementEditorPresetSaveRequest {
  // null creates a new preset.
  presetId: string | null
  presetName: string
  // Normalized YouTube video id, or null to clear.
  youtubeReference: string | null
  // false when an existing single preset's lyrics are unchanged, so the song's
  // shared lyrics are not rewritten.
  includeLyrics: boolean
  lyricsSaveScope?: "song" | "preset"
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
  sheetMusicPreviewItem?: SheetMusicPreviewItem | null
  sheetMusicLoading?: boolean
  sheetMusicWorkspacePreview?: boolean
  showDisplayTitleField?: boolean
  showDefaultPresetField?: boolean
  presetType?: SongPreset["presetType"] | null
  hasExistingPreset?: boolean
  sheetMusicManagementSlot?: ReactNode
  onOpenChange: (open: boolean) => void
  onSave: (
    draft: ArrangementDraft,
    options?: ArrangementEditorSaveOptions,
  ) => Promise<ArrangementEditorSaveResult>
  onLoadPreset?: (preset: ArrangementEditorPresetOption) => Promise<ArrangementDraft>
  // Conti-only secondary save that also persists the arrangement to a shared
  // preset. The footer shows a "프리셋에 저장" button that opens a target dialog.
  presetSaveTargets?: ArrangementEditorPresetOption[]
  // false pins the dialog to the given targets (e.g. a mashup's own preset).
  allowNewPresetTarget?: boolean
  onSaveToPreset?: (
    draft: ArrangementDraft,
    request: ArrangementEditorPresetSaveRequest,
  ) => Promise<ArrangementEditorSaveResult>
  onRefreshPresetOptions?: () => Promise<void>
}
