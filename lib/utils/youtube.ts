export interface NormalizedYouTubeReference {
  videoId: string
  url: string
  displayUrl: string
}

const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

export function extractYouTubeVideoId(value: string | null | undefined): string | null {
  const input = value?.trim()
  if (!input) return null
  if (YOUTUBE_VIDEO_ID_PATTERN.test(input)) return input

  try {
    const url = new URL(input)
    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      const candidate = url.pathname.split("/").filter(Boolean)[0]
      return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null
    }

    if (hostname === "youtube.com" || hostname === "music.youtube.com") {
      const watchId = url.searchParams.get("v")
      if (watchId && YOUTUBE_VIDEO_ID_PATTERN.test(watchId)) return watchId

      const parts = url.pathname.split("/").filter(Boolean)
      const embedIndex = parts.findIndex((part) => part === "embed" || part === "shorts")
      const candidate = embedIndex >= 0 ? parts[embedIndex + 1] : null
      return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null
    }
  } catch {
    return null
  }

  return null
}

export function toYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function formatYouTubeDisplayUrl(videoId: string): string {
  return `youtube.com/watch?v=${videoId}`
}

export function normalizeYouTubeReference(value: string | null | undefined): NormalizedYouTubeReference | null {
  const videoId = extractYouTubeVideoId(value)
  if (!videoId) return null

  return {
    videoId,
    url: toYouTubeWatchUrl(videoId),
    displayUrl: formatYouTubeDisplayUrl(videoId),
  }
}
