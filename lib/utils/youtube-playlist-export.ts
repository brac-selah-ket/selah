import { extractYouTubeVideoId } from "@/lib/utils/youtube"
import type { ContiSongWithSong } from "@/lib/types"

export const MAX_EXPORT_VIDEO_IDS = 50

export interface YouTubePlaylistExportResult {
  videoIds: string[]
  missingCount: number
  totalCount: number
  truncated: boolean
}

export function collectYouTubeVideoIdsForExport(
  songs: readonly ContiSongWithSong[],
): YouTubePlaylistExportResult {
  const ordered = [...songs].sort((left, right) => left.sortOrder - right.sortOrder)

  const allVideoIds = ordered
    .map((song) => extractYouTubeVideoId(song.appliedPreset?.youtubeReference))
    .filter((videoId): videoId is string => videoId !== null)

  const truncated = allVideoIds.length > MAX_EXPORT_VIDEO_IDS
  const videoIds = truncated ? allVideoIds.slice(0, MAX_EXPORT_VIDEO_IDS) : allVideoIds

  return {
    videoIds,
    missingCount: ordered.length - allVideoIds.length,
    totalCount: ordered.length,
    truncated,
  }
}

export function buildYouTubeWatchVideosUrl(videoIds: readonly string[]): string {
  return `https://www.youtube.com/watch_videos?video_ids=${videoIds.join(",")}`
}
