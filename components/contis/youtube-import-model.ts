import type { Song, SongPreset } from "@/lib/types"

export type YouTubeImportSongMatch = Pick<Song, "id" | "name">

export interface YouTubeImportReviewItem {
  id: string
  originalTitle: string
  editedName: string
  videoId: string
  matchedSong: YouTubeImportSongMatch | null
  isAlreadyInConti: boolean
  excluded: boolean
  selectedPresetId: string | null
  createNewPreset: boolean
  presetName: string
  presets: SongPreset[] | null
  existingYoutubeRef: string | null
  replaceExistingYoutube: boolean
}

export interface BatchImportPayloadItem {
  songId: string | null
  newSongName: string | null
  videoId: string
  title: string
  presetId: string | null
  createNewPreset: boolean
  presetName: string
  alreadyInConti: boolean
  replaceExistingYoutube: boolean
}

export function buildBatchImportItems(
  items: YouTubeImportReviewItem[],
  defaultPresetName: string,
): BatchImportPayloadItem[] {
  return items.map((item) => ({
    songId: item.matchedSong?.id ?? null,
    newSongName: item.matchedSong ? null : item.editedName.trim(),
    videoId: item.videoId,
    title: item.originalTitle,
    presetId: item.selectedPresetId,
    createNewPreset: item.createNewPreset || !item.matchedSong,
    presetName: item.presetName || defaultPresetName,
    alreadyInConti: item.isAlreadyInConti,
    replaceExistingYoutube: item.existingYoutubeRef ? item.replaceExistingYoutube : true,
  }))
}
