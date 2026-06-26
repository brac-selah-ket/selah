import type { ArrangementEditorMode } from "./types"
import type { SongPresetType } from "@/lib/song-preset-types"

const EMPTY_SHEET_MUSIC_SELECTION_ERROR = "악보를 최소 1개 이상 선택해주세요"

export function shouldShowYouTubeReferenceField(
  mode: ArrangementEditorMode,
): boolean {
  return mode === "preset"
}

export function getSheetMusicSelectionSaveError(
  sheetMusicFileIds: string[] | null,
  availableSheetMusicCount: number,
): string | null {
  if (availableSheetMusicCount > 0 && sheetMusicFileIds?.length === 0) {
    return EMPTY_SHEET_MUSIC_SELECTION_ERROR
  }

  return null
}

function areLyricsEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

export function shouldConfirmLyricsSaveScope(input: {
  mode: ArrangementEditorMode
  presetType: SongPresetType | null | undefined
  hasExistingPreset: boolean
  initialLyrics: readonly string[]
  draftLyrics: readonly string[]
}): boolean {
  if (input.mode !== "preset") return false
  if (input.presetType !== "single") return false
  if (!input.hasExistingPreset) return false

  return !areLyricsEqual(input.initialLyrics, input.draftLyrics)
}
