import type { SongPresetType } from "@/lib/song-preset-types";

export function getDefaultPresetValidationError(
  preset: { songId: string; presetType: SongPresetType } | null,
  songId: string,
): string | null {
  if (!preset) {
    return "프리셋을 찾을 수 없습니다";
  }

  if (preset.presetType === "mashup") {
    return "매시업 프리셋은 기본 프리셋으로 설정할 수 없습니다";
  }

  if (preset.songId !== songId) {
    return "선택한 곡의 프리셋만 기본으로 설정할 수 있습니다";
  }

  return null;
}
