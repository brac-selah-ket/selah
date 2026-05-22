'use server'

import { normalizeYouTubeReference } from '@/lib/utils/youtube'
import { cleanYouTubeTitle } from '@/lib/utils/youtube-title'

const YOUTUBE_METADATA_TIMEOUT_MS = 2500

export interface ResolvedYouTubeReference {
  videoId: string
  url: string
  displayUrl: string
  title: string | null
}

interface YouTubeVideosResponse {
  items?: Array<{
    id: string
    snippet?: {
      title?: string
    }
  }>
}

export async function fetchYouTubeVideoTitle(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return null

  const params = new URLSearchParams({
    part: 'snippet',
    id: videoId,
    key: apiKey,
  })

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      signal: AbortSignal.timeout(YOUTUBE_METADATA_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const data = (await response.json()) as YouTubeVideosResponse
    const title = data.items?.[0]?.snippet?.title
    return title ? cleanYouTubeTitle(title) || title : null
  } catch {
    return null
  }
}

export async function resolveYouTubeReferenceMetadata(
  value: string | null | undefined,
  preferredTitle?: string | null,
): Promise<ResolvedYouTubeReference | null> {
  const normalized = normalizeYouTubeReference(value)
  if (!normalized) return null

  const title = preferredTitle?.trim() || await fetchYouTubeVideoTitle(normalized.videoId)

  return {
    ...normalized,
    title: title || null,
  }
}
