'use server'

import { z } from 'zod'
import type { ActionResult, YouTubePlaylistItem } from '@/lib/types'
import { cleanYouTubeTitle } from '@/lib/utils/youtube-title'

const urlSchema = z.string().url()

function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('list')
  } catch {
    return null
  }
}

const isPrivateOrDeleted = (title: string) =>
  title === 'Private video' || title === 'Deleted video'

interface YouTubeApiResponse {
  items?: Array<{
    snippet: {
      title: string
      resourceId: {
        videoId: string
      }
      position: number
    }
  }>
  nextPageToken?: string
}

export async function fetchYouTubePlaylist(
  url: string
): Promise<ActionResult<YouTubePlaylistItem[]>> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    if (!apiKey) {
      return { success: false, error: 'YouTube API 키가 설정되지 않았습니다' }
    }

    const validation = urlSchema.safeParse(url)
    if (!validation.success) {
      return { success: false, error: '올바른 YouTube 플레이리스트 URL을 입력해주세요' }
    }

    const playlistId = extractPlaylistId(url)
    if (!playlistId) {
      return { success: false, error: '올바른 YouTube 플레이리스트 URL을 입력해주세요' }
    }

    const items: YouTubePlaylistItem[] = []
    let pageToken: string | undefined
    const maxPages = 4

    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({
        part: 'snippet',
        playlistId,
        maxResults: '50',
        key: apiKey,
      })
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`
      )

      if (!response.ok) {
        if (response.status === 403 || response.status === 404) {
          return {
            success: false,
            error: '플레이리스트를 찾을 수 없습니다. 비공개 플레이리스트이거나 URL이 올바르지 않습니다',
          }
        }
        return {
          success: false,
          error: 'YouTube 플레이리스트를 가져오는 중 오류가 발생했습니다',
        }
      }

      const data: YouTubeApiResponse = await response.json()

      if (data.items) {
        for (const item of data.items) {
          if (!isPrivateOrDeleted(item.snippet.title)) {
            items.push({
              title: cleanYouTubeTitle(item.snippet.title),
              videoId: item.snippet.resourceId.videoId,
              position: item.snippet.position,
            })
          }
        }
      }

      if (!data.nextPageToken) break
      pageToken = data.nextPageToken
    }

    if (pageToken) {
      // There are more pages beyond what we fetched
      // This info could be used for a truncation warning on the client
    }

    return { success: true, data: items }
  } catch {
    return {
      success: false,
      error: 'YouTube 플레이리스트를 가져오는 중 오류가 발생했습니다',
    }
  }
}
