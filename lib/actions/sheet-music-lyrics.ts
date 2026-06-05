'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/types'

export const DEFAULT_GEMINI_LYRICS_MODEL = 'gemini-3-pro-preview'

const MAX_PAGE_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024

const IMAGE_DATA_URL_REGEX = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/

interface SheetMusicLyricsImagePageInput {
  imageDataUrl: string
  sourceName: string
  pageLabel: string
}

interface GenerateLyricsFromSheetMusicImagesInput {
  songName?: string
  pages: SheetMusicLyricsImagePageInput[]
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
  error?: {
    message?: string
  }
}

const lyricsPayloadSchema = z.object({
  lyrics: z.array(z.string()),
})

const geminiLyricsResponseJsonSchema = {
  type: 'object',
  properties: {
    lyrics: {
      type: 'array',
      description: '가사 페이지 배열. 각 항목은 예배 PPT 한 페이지에 들어갈 가사이며 줄바꿈을 포함할 수 있다.',
      items: {
        type: 'string',
      },
    },
  },
  required: ['lyrics'],
  additionalProperties: false,
} as const

function getBase64DecodedByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function parseImageDataUrl(dataUrl: string): {
  mimeType: string
  base64: string
  decodedBytes: number
} | null {
  const match = dataUrl.match(IMAGE_DATA_URL_REGEX)
  if (!match) return null

  const base64 = match[2]
  return {
    mimeType: match[1],
    base64,
    decodedBytes: getBase64DecodedByteLength(base64),
  }
}

function buildLyricsExtractionPrompt(input: GenerateLyricsFromSheetMusicImagesInput): string {
  const songLine = input.songName?.trim()
    ? `곡명 후보: ${input.songName.trim()}`
    : '곡명 후보: 제공되지 않음'

  const pageLines = input.pages
    .map((page, index) => `${index + 1}. ${page.pageLabel} (${page.sourceName})`)
    .join('\n')

  return [
    '너는 한국어 예배 악보 이미지에서 실제로 보이는 가사만 추출하는 assistant다.',
    songLine,
    '',
    '중요 규칙:',
    '- 첨부된 이미지는 악보 페이지 이미지다.',
    '- 이미지에 실제로 보이는 한글 가사만 추출한다.',
    '- 모델의 기억, 일반 찬양 지식, 검색 결과, 곡명 추론으로 가사를 보충하지 않는다.',
    '- PDF 내장 텍스트가 아니라 현재 첨부된 이미지에 보이는 글자를 기준으로 판단한다.',
    '- verse, chorus, bridge, outro 등 곡 구조를 먼저 파악해서 자연스러운 노래 순서로 정리한다.',
    '- section label은 출력하지 않는다.',
    '- 반복 기호는 참고하되 동일한 가사를 불필요하게 중복 생성하지 않는다.',
    '- key-up 반복처럼 가사가 동일하면 중복 페이지를 만들지 않는다.',
    '- 읽기 어려운 글자는 무리하게 창작하지 않는다.',
    '- 각 가사 줄은 visualLength <= 23을 목표로 줄바꿈한다.',
    '- visualLength = 한글 1자 * 1 + 공백 * 0.3 + 영문/숫자 * 0.7 + 기타 문자 * 1 이다.',
    '- 한 가사 페이지는 1-2줄을 우선 사용한다. 꼭 필요할 때만 3줄을 사용한다.',
    '- 최종 출력은 JSON schema에 맞는 JSON만 반환한다.',
    '',
    '입력 이미지 목록:',
    pageLines,
  ].join('\n')
}

function extractGeminiText(data: GeminiResponse): string {
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim() ?? ''
}

function normalizeLyricsPayload(value: unknown): string[] | null {
  const parsed = lyricsPayloadSchema.safeParse(value)
  if (!parsed.success) return null

  const lyrics = parsed.data.lyrics
    .map((page) => page.trim())
    .filter((page) => page.length > 0)

  return lyrics.length > 0 ? lyrics : null
}

export async function generateLyricsFromSheetMusicImages(
  input: GenerateLyricsFromSheetMusicImagesInput,
): Promise<ActionResult<{ lyrics: string[] }>> {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: 'Gemini API 키가 설정되지 않았습니다. .env.local에 GEMINI_API_KEY를 추가해주세요.',
      }
    }

    if (input.pages.length === 0) {
      return {
        success: false,
        error: '가사를 생성할 악보 이미지가 없습니다.',
      }
    }

    let totalBytes = 0
    const imageParts = []

    for (const [index, page] of input.pages.entries()) {
      const parsed = parseImageDataUrl(page.imageDataUrl)
      if (!parsed) {
        return {
          success: false,
          error: `${page.pageLabel || `페이지 ${index + 1}`}: 올바른 이미지 데이터가 아닙니다.`,
        }
      }

      if (parsed.decodedBytes > MAX_PAGE_IMAGE_BYTES) {
        return {
          success: false,
          error: `${page.pageLabel}: 이미지 크기가 4MB를 넘습니다.`,
        }
      }

      totalBytes += parsed.decodedBytes
      imageParts.push({
        text: `이미지 ${index + 1}: ${page.pageLabel} (${page.sourceName})`,
      })
      imageParts.push({
        inline_data: {
          mime_type: parsed.mimeType,
          data: parsed.base64,
        },
      })
    }

    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      return {
        success: false,
        error: '악보 이미지 전체 크기가 20MB를 넘습니다. 악보를 나누어 다시 시도해주세요.',
      }
    }

    const model = process.env.GEMINI_LYRICS_MODEL?.trim() || DEFAULT_GEMINI_LYRICS_MODEL
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: buildLyricsExtractionPrompt(input) },
                ...imageParts,
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: geminiLyricsResponseJsonSchema,
          },
        }),
      },
    )

    const data = await response.json().catch(() => ({})) as GeminiResponse

    if (!response.ok) {
      const message = data.error?.message || response.statusText
      return {
        success: false,
        error: `Gemini 가사 생성 중 오류가 발생했습니다 (${response.status}): ${message}`,
      }
    }

    const text = extractGeminiText(data)
    if (!text) {
      return {
        success: false,
        error: 'Gemini 응답에서 가사 JSON을 찾을 수 없습니다.',
      }
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return {
        success: false,
        error: 'Gemini 응답을 JSON으로 해석할 수 없습니다.',
      }
    }

    const lyrics = normalizeLyricsPayload(json)
    if (!lyrics) {
      return {
        success: false,
        error: 'Gemini 응답에 사용할 수 있는 가사 페이지가 없습니다.',
      }
    }

    return {
      success: true,
      data: { lyrics },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다'
    return {
      success: false,
      error: `Gemini 가사 생성 중 오류가 발생했습니다: ${message}`,
    }
  }
}
