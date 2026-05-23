import type { ArrangementEditorMode } from "./types"

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
