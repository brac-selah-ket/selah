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
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      const parts = url.pathname.split("/").filter(Boolean)
      const candidate = parts.length === 1 ? parts[0] : null
      return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate) ? candidate : null
    }

    if (hostname === "youtube.com" || hostname === "music.youtube.com") {
      const watchId = url.searchParams.get("v")
      if (url.pathname === "/watch" && watchId && YOUTUBE_VIDEO_ID_PATTERN.test(watchId)) return watchId
    }

    if (hostname === "youtube.com") {
      const parts = url.pathname.split("/").filter(Boolean)
      const candidate = parts.length === 2 && (parts[0] === "embed" || parts[0] === "shorts") ? parts[1] : null
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
