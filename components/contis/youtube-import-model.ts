import type { Song, SongPreset } from "@/lib/types"

export type YouTubeImportSongMatch = Pick<Song, "id" | "name">

export interface YouTubeImportMashupLink {
  presetId: string | null
  createNewPreset: boolean
  presetName: string
}

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
  mashupWithNext: YouTubeImportMashupLink | null
}

export interface BatchImportPayloadItem {
  songId: string | null
  songName: string | null
  newSongName: string | null
  videoId: string
  title: string
  presetId: string | null
  createNewPreset: boolean
  presetName: string
  alreadyInConti: boolean
  replaceExistingYoutube: boolean
  mashupWithNext: YouTubeImportMashupLink | null
}

export function buildBatchImportItems(
  items: YouTubeImportReviewItem[],
  defaultPresetName: string,
): BatchImportPayloadItem[] {
  return items
    .map((item, index) => ({
      item,
      mashupWithNext:
        item.mashupWithNext &&
          !item.excluded &&
          items[index + 1] &&
          !items[index + 1].excluded
          ? item.mashupWithNext
          : null,
    }))
    .filter(({ item }) => !item.excluded)
    .map(({ item, mashupWithNext }) => ({
      songId: item.matchedSong?.id ?? null,
      songName: item.matchedSong?.name ?? null,
      newSongName: item.matchedSong ? null : item.editedName.trim(),
      videoId: item.videoId,
      title: item.originalTitle,
      presetId: item.selectedPresetId,
      createNewPreset: item.createNewPreset || !item.matchedSong,
      presetName: item.presetName || defaultPresetName,
      alreadyInConti: item.isAlreadyInConti,
      replaceExistingYoutube: item.existingYoutubeRef ? item.replaceExistingYoutube : true,
      mashupWithNext,
    }))
}
