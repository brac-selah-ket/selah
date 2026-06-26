import type { SheetMusicFile, SongPresetWithSheetMusic } from "@/lib/types";

export function buildPresetEditorSheetMusic(
  preset: SongPresetWithSheetMusic | undefined,
  currentSongSheetMusic: readonly SheetMusicFile[],
): SheetMusicFile[] {
  if (preset?.presetType !== "mashup") {
    return [...currentSongSheetMusic];
  }

  const filesById = new Map<string, SheetMusicFile>();
  for (const file of preset.availableSheetMusic ?? []) {
    filesById.set(file.id, file);
  }

  for (const file of currentSongSheetMusic) {
    if (!filesById.has(file.id)) {
      filesById.set(file.id, file);
    }
  }

  return Array.from(filesById.values());
}
