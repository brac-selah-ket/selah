import type { ArrangementEditorMode } from "./types"
import type { SongPresetType } from "@/lib/song-preset-types"

const EMPTY_SHEET_MUSIC_SELECTION_ERROR = "악보를 최소 1개 이상 선택해주세요"

export const PRESET_SAVE_LABEL = "프리셋에 저장"
export const PRESET_SAVE_SUCCESS_MESSAGE = "프리셋에 저장되었습니다"

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

// Decides how lyrics travel when saving an arrangement into an existing or new
// preset. Existing single presets share lyrics with the song, so changed lyrics
// need an explicit scope and unchanged lyrics are omitted to avoid rewriting
// the song's lyrics as a side effect.
export function resolvePresetLyricsSave(input: {
  presetType: SongPresetType | null | undefined
  hasExistingPreset: boolean
  baselineLyrics: readonly string[]
  draftLyrics: readonly string[]
}): { includeLyrics: boolean; askScope: boolean } {
  if (input.presetType !== "single" || !input.hasExistingPreset) {
    return { includeLyrics: true, askScope: false }
  }

  const changed = !areLyricsEqual(input.baselineLyrics, input.draftLyrics)
  return { includeLyrics: changed, askScope: changed }
}

export function getPrimarySaveLabel(mode: ArrangementEditorMode): string {
  return mode === "preset" ? PRESET_SAVE_LABEL : "이 콘티에만 저장"
}

export function getPrimarySaveSuccessMessage(mode: ArrangementEditorMode): string {
  return mode === "preset" ? PRESET_SAVE_SUCCESS_MESSAGE : "이 콘티에 저장되었습니다"
}
