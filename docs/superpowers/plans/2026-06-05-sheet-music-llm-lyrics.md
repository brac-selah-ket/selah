# Sheet Music LLM Lyrics Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Gemini-powered sheet music lyrics generation that converts sheet music images and PDF pages into appended lyrics pages.

**Architecture:** Keep the existing Google Vision region OCR unchanged. Add a separate Gemini server action, a client-only image preparation helper, and a new lyrics generator dialog opened from `LyricsEditor`. The LLM output is validated as `{ lyrics: string[] }` and only appended to existing lyrics.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Base UI dialog primitives, Hugeicons, `pdfjs-dist`, Node test runner, Gemini REST `generateContent`.

---

## File Structure

- Create `lib/utils/lyrics-validation.test.ts`
  - Locks the new PPT-derived visual length rule.
- Modify `lib/utils/lyrics-validation.ts`
  - Exports `getLyricsLineVisualLength`.
  - Uses `visualLength > 23` for line length warnings.
- Create `lib/actions/sheet-music-lyrics.test.ts`
  - Tests server action validation and Gemini response parsing without network.
- Create `lib/actions/sheet-music-lyrics.ts`
  - Owns Gemini REST call, prompt, schema, payload validation, and response validation.
- Create `lib/utils/sheet-music-lyrics-images.ts`
  - Client-only helper to fetch sheet music assets, render PDF pages, compress all pages to JPEG data URLs, and attach source labels.
- Create `components/contis/sheet-music-lyrics-generator-dialog.tsx`
  - Owns dialog state, calls image helper and server action, previews generated pages, appends on confirmation.
- Modify `components/contis/lyrics-editor.tsx`
  - Adds `가사 자동 생성` button and dialog state.
  - Appends generated pages only.
- Modify `components/shared/override-editor-fields.tsx`
  - Passes optional song name to `LyricsEditor`.
- Modify `components/shared/arrangement-editor/arrangement-editor.tsx`
  - Passes `songName` into `OverrideEditorFields`.
- Modify `.env.example`
  - Adds `GEMINI_API_KEY` and optional `GEMINI_LYRICS_MODEL`.
- Modify `tests/worship-prep-source.test.mjs`
  - Adds source-level regression coverage for button wiring, append-only behavior, default model, structured output, and no PDF passthrough.
- Modify `package.json`
  - Adds new unit tests to `pnpm test`.

Sources used for API details:

- Gemini image input docs: https://ai.google.dev/gemini-api/docs/image-understanding
- Gemini structured output docs: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini models docs: https://ai.google.dev/models/gemini

---

### Task 1: Lyrics Visual Length Validation

**Files:**
- Create: `lib/utils/lyrics-validation.test.ts`
- Modify: `lib/utils/lyrics-validation.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing validation test**

Create `lib/utils/lyrics-validation.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  getLyricsLineVisualLength,
  validateLyricsPage,
} from "./lyrics-validation.ts"

test("calculates Korean lyric visual length with PPT-derived weights", () => {
  assert.equal(getLyricsLineVisualLength("가나다"), 3)
  assert.equal(getLyricsLineVisualLength("가 나"), 2.3)
  assert.equal(getLyricsLineVisualLength("ABC 123"), 4.5)
  assert.equal(
    Number(getLyricsLineVisualLength("주 사랑해요 온 맘 다하여 말로 다 할 수 없어").toFixed(1)),
    19.7,
  )
})

test("does not warn for a known line that fits the worship PPT template", () => {
  assert.deepEqual(
    validateLyricsPage("주 사랑해요 온 맘 다하여 말로 다 할 수 없어"),
    [],
  )
})

test("warns when a single line exceeds the visual length limit", () => {
  assert.deepEqual(validateLyricsPage("가".repeat(24)), [
    {
      type: "no-line-break",
      message: "줄바꿈이 필요합니다",
    },
  ])
})

test("warns when any line in a multiline page exceeds the visual length limit", () => {
  assert.deepEqual(validateLyricsPage(`짧은 줄\n${"가".repeat(24)}`), [
    {
      type: "line-too-long",
      message: "줄이 너무 깁니다",
    },
  ])
})

test("keeps the existing three-line page warning", () => {
  assert.deepEqual(validateLyricsPage("한 줄\n두 줄\n세 줄"), [
    {
      type: "too-many-lines",
      message: "줄 수가 너무 많습니다",
    },
  ])
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
node --experimental-strip-types --test lib/utils/lyrics-validation.test.ts
```

Expected: fail because `getLyricsLineVisualLength` is not exported.

- [ ] **Step 3: Implement the visual length rule**

Replace `lib/utils/lyrics-validation.ts` with:

```ts
export interface LyricsWarning {
  type: 'no-line-break' | 'line-too-long' | 'too-many-lines'
  message: string
}

const MAX_LINE_VISUAL_LENGTH = 23
const MAX_LINE_COUNT = 3

const HANGUL_REGEX = /[가-힣]/
const LATIN_OR_DIGIT_REGEX = /[A-Za-z0-9]/
const WHITESPACE_REGEX = /\s/

export function getLyricsLineVisualLength(line: string): number {
  let length = 0

  for (const char of line) {
    if (HANGUL_REGEX.test(char)) {
      length += 1
    } else if (WHITESPACE_REGEX.test(char)) {
      length += 0.3
    } else if (LATIN_OR_DIGIT_REGEX.test(char)) {
      length += 0.7
    } else {
      length += 1
    }
  }

  return Number(length.toFixed(10))
}

function isLineTooLong(line: string): boolean {
  return getLyricsLineVisualLength(line) > MAX_LINE_VISUAL_LENGTH
}

export function validateLyricsPage(text: string): LyricsWarning[] {
  if (!text.trim()) return []

  const warnings: LyricsWarning[] = []
  const lines = text.split('\n')
  const hasLineBreaks = lines.length > 1

  if (!hasLineBreaks) {
    if (isLineTooLong(text)) {
      warnings.push({
        type: 'no-line-break',
        message: '줄바꿈이 필요합니다',
      })
    }
  } else {
    if (lines.some(isLineTooLong)) {
      warnings.push({
        type: 'line-too-long',
        message: '줄이 너무 깁니다',
      })
    }

    if (lines.length >= MAX_LINE_COUNT) {
      warnings.push({
        type: 'too-many-lines',
        message: '줄 수가 너무 많습니다',
      })
    }
  }

  return warnings
}
```

- [ ] **Step 4: Add the test to the package test script**

In `package.json`, change the `test` script to include `lib/utils/lyrics-validation.test.ts` after `lib/utils/youtube.test.ts`:

```json
"test": "node --experimental-strip-types --test lib/utils/youtube.test.ts lib/utils/lyrics-validation.test.ts lib/utils/preset-overrides.test.ts components/shared/arrangement-editor/save-rules.test.ts lib/storage/storage.test.ts lib/repositories/storyboard/provider.test.ts lib/cron-auth.test.ts lib/sheet-music-assets.test.ts tests/discord-endpoint-source.test.mjs tests/discord-parse-comments-route.test.mjs tests/blob-to-r2-migration-source.test.mjs tests/sheet-music-cors-source.test.mjs"
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
node --experimental-strip-types --test lib/utils/lyrics-validation.test.ts
```

Expected: pass.

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/lyrics-validation.ts lib/utils/lyrics-validation.test.ts package.json
git commit -m "test: cover lyrics visual length validation"
```

---

### Task 2: Gemini Lyrics Server Action

**Files:**
- Create: `lib/actions/sheet-music-lyrics.test.ts`
- Create: `lib/actions/sheet-music-lyrics.ts`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Write server action tests**

Create `lib/actions/sheet-music-lyrics.test.ts`:

```ts
import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_GEMINI_LYRICS_MODEL,
  generateLyricsFromSheetMusicImages,
} from "./sheet-music-lyrics.ts"

const VALID_IMAGE_DATA_URL = `data:image/jpeg;base64,${Buffer.from("fake-image").toString("base64")}`

function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> | T {
  const previous = new Map<string, string | undefined>()

  for (const key of Object.keys(env)) {
    previous.set(key, process.env[key])
    const value = env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  const restore = () => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }

  try {
    const result = fn()
    if (result instanceof Promise) {
      return result.finally(restore)
    }
    restore()
    return result
  } catch (error) {
    restore()
    throw error
  }
}

test("uses Gemini 3.1 Pro Preview as the default lyrics model", () => {
  assert.equal(DEFAULT_GEMINI_LYRICS_MODEL, "gemini-3.1-pro-preview")
})

test("fails when Gemini API key is missing", async () => {
  await withEnv({ GEMINI_API_KEY: undefined }, async () => {
    const result = await generateLyricsFromSheetMusicImages({
      pages: [
        {
          imageDataUrl: VALID_IMAGE_DATA_URL,
          sourceName: "song.jpg",
          pageLabel: "song.jpg",
        },
      ],
    })

    assert.equal(result.success, false)
    assert.match(result.error ?? "", /GEMINI_API_KEY/)
  })
})

test("fails when no image pages are provided", async () => {
  await withEnv({ GEMINI_API_KEY: "test-key" }, async () => {
    const result = await generateLyricsFromSheetMusicImages({ pages: [] })

    assert.equal(result.success, false)
    assert.match(result.error ?? "", /악보 이미지/)
  })
})

test("fails when a page is not an image data URL", async () => {
  await withEnv({ GEMINI_API_KEY: "test-key" }, async () => {
    const result = await generateLyricsFromSheetMusicImages({
      pages: [
        {
          imageDataUrl: "data:application/pdf;base64,AAAA",
          sourceName: "song.pdf",
          pageLabel: "song.pdf 1페이지",
        },
      ],
    })

    assert.equal(result.success, false)
    assert.match(result.error ?? "", /이미지 데이터/)
  })
})

test("calls Gemini with inline image data and structured JSON output", async () => {
  const previousFetch = globalThis.fetch
  const calls: { url: string; init: RequestInit }[] = []

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return new Response(JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  lyrics: [
                    "주 사랑해요 온 맘 다하여\n말로 다 할 수 없어",
                    "오 주 사랑해요\n찬양받아주소서",
                    "",
                  ],
                }),
              },
            ],
          },
        },
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }) as typeof fetch

  try {
    await withEnv({
      GEMINI_API_KEY: "test-key",
      GEMINI_LYRICS_MODEL: undefined,
    }, async () => {
      const result = await generateLyricsFromSheetMusicImages({
        songName: "테스트 찬양",
        pages: [
          {
            imageDataUrl: VALID_IMAGE_DATA_URL,
            sourceName: "song.jpg",
            pageLabel: "song.jpg",
          },
        ],
      })

      assert.deepEqual(result, {
        success: true,
        data: {
          lyrics: [
            "주 사랑해요 온 맘 다하여\n말로 다 할 수 없어",
            "오 주 사랑해요\n찬양받아주소서",
          ],
        },
      })

      assert.equal(calls.length, 1)
      assert.match(calls[0].url, /gemini-3\.1-pro-preview:generateContent/)
      assert.equal((calls[0].init.headers as Record<string, string>)["x-goog-api-key"], "test-key")

      const body = JSON.parse(String(calls[0].init.body))
      assert.equal(body.generationConfig.responseMimeType, "application/json")
      assert.deepEqual(body.generationConfig.responseJsonSchema.required, ["lyrics"])
      assert.equal(body.contents[0].parts.some((part: { inline_data?: unknown }) => part.inline_data), true)
      assert.equal(
        body.contents[0].parts.some((part: { file_data?: { mime_type?: string } }) => (
          part.file_data?.mime_type === "application/pdf"
        )),
        false,
      )
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test("fails when Gemini returns an invalid lyrics payload", async () => {
  const previousFetch = globalThis.fetch

  globalThis.fetch = (async () => new Response(JSON.stringify({
    candidates: [
      {
        content: {
          parts: [{ text: JSON.stringify({ lyrics: "not an array" }) }],
        },
      },
    ],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch

  try {
    await withEnv({ GEMINI_API_KEY: "test-key" }, async () => {
      const result = await generateLyricsFromSheetMusicImages({
        pages: [
          {
            imageDataUrl: VALID_IMAGE_DATA_URL,
            sourceName: "song.jpg",
            pageLabel: "song.jpg",
          },
        ],
      })

      assert.equal(result.success, false)
      assert.match(result.error ?? "", /응답/)
    })
  } finally {
    globalThis.fetch = previousFetch
  }
})
```

- [ ] **Step 2: Run server action tests to verify they fail**

Run:

```bash
node --experimental-strip-types --test lib/actions/sheet-music-lyrics.test.ts
```

Expected: fail because `lib/actions/sheet-music-lyrics.ts` does not exist.

- [ ] **Step 3: Implement the Gemini server action**

Create `lib/actions/sheet-music-lyrics.ts`:

```ts
'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/types'

export const DEFAULT_GEMINI_LYRICS_MODEL = 'gemini-3.1-pro-preview'

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
```

- [ ] **Step 4: Add environment variables**

In `.env.example`, add these lines below the Google Cloud Vision section:

```dotenv

# Gemini API (for full sheet music lyrics generation)
GEMINI_API_KEY=your-gemini-api-key
# Optional. Defaults to gemini-3.1-pro-preview.
GEMINI_LYRICS_MODEL=gemini-3.1-pro-preview
```

- [ ] **Step 5: Add the server action test to the package test script**

In `package.json`, change the `test` script to include `lib/actions/sheet-music-lyrics.test.ts` after `lib/utils/lyrics-validation.test.ts`:

```json
"test": "node --experimental-strip-types --test lib/utils/youtube.test.ts lib/utils/lyrics-validation.test.ts lib/actions/sheet-music-lyrics.test.ts lib/utils/preset-overrides.test.ts components/shared/arrangement-editor/save-rules.test.ts lib/storage/storage.test.ts lib/repositories/storyboard/provider.test.ts lib/cron-auth.test.ts lib/sheet-music-assets.test.ts tests/discord-endpoint-source.test.mjs tests/discord-parse-comments-route.test.mjs tests/blob-to-r2-migration-source.test.mjs tests/sheet-music-cors-source.test.mjs"
```

- [ ] **Step 6: Run server action tests**

Run:

```bash
node --experimental-strip-types --test lib/actions/sheet-music-lyrics.test.ts
```

Expected: pass.

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/sheet-music-lyrics.ts lib/actions/sheet-music-lyrics.test.ts .env.example package.json
git commit -m "feat: add Gemini sheet music lyrics action"
```

---

### Task 3: Client Image Preparation Helper

**Files:**
- Create: `lib/utils/sheet-music-lyrics-images.ts`

- [ ] **Step 1: Create the client image helper**

Create `lib/utils/sheet-music-lyrics-images.ts`:

```ts
import { getSheetMusicAssetUrl } from '@/lib/sheet-music-assets'
import { getPdfPageCount, renderPdfPagesToDataUrls } from '@/lib/utils/pdfjs'
import type { SheetMusicFile } from '@/lib/types'

export interface SheetMusicLyricsImagePage {
  imageDataUrl: string
  sourceName: string
  pageLabel: string
}

export const GEMINI_LYRICS_IMAGE_MAX_EDGE = 1800
export const GEMINI_LYRICS_IMAGE_JPEG_QUALITY = 0.86

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('파일을 data URL로 변환할 수 없습니다.'))
      }
    }
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'))
    image.src = dataUrl
  })
}

export async function compressImageDataUrlForGemini(
  dataUrl: string,
): Promise<string> {
  const image = await loadImage(dataUrl)
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight)
  const scale = maxDimension > GEMINI_LYRICS_IMAGE_MAX_EDGE
    ? GEMINI_LYRICS_IMAGE_MAX_EDGE / maxDimension
    : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('이미지 변환 캔버스를 만들 수 없습니다.')
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', GEMINI_LYRICS_IMAGE_JPEG_QUALITY)
}

async function fetchImageFileAsDataUrl(file: SheetMusicFile): Promise<string> {
  const response = await fetch(getSheetMusicAssetUrl(file))
  if (!response.ok) {
    throw new Error(`${file.fileName} 파일을 불러올 수 없습니다.`)
  }

  const blob = await response.blob()
  return readBlobAsDataUrl(blob)
}

export async function buildSheetMusicLyricsImagePages(
  sheetMusicFiles: SheetMusicFile[],
): Promise<SheetMusicLyricsImagePage[]> {
  const pages: SheetMusicLyricsImagePage[] = []

  for (const file of sheetMusicFiles) {
    const assetUrl = getSheetMusicAssetUrl(file)

    if (file.fileType.startsWith('image/')) {
      const rawDataUrl = await fetchImageFileAsDataUrl(file)
      pages.push({
        imageDataUrl: await compressImageDataUrlForGemini(rawDataUrl),
        sourceName: file.fileName,
        pageLabel: file.fileName,
      })
      continue
    }

    if (file.fileType === 'application/pdf') {
      const pageCount = await getPdfPageCount(assetUrl)
      const pageNums = Array.from({ length: pageCount }, (_, index) => index + 1)
      const renderedPages = await renderPdfPagesToDataUrls(assetUrl, pageNums, 2)

      for (let index = 0; index < renderedPages.length; index++) {
        pages.push({
          imageDataUrl: await compressImageDataUrlForGemini(renderedPages[index]),
          sourceName: file.fileName,
          pageLabel: `${file.fileName} - ${index + 1}/${pageCount}페이지`,
        })
      }
    }
  }

  return pages
}
```

- [ ] **Step 2: Run lint on the helper**

Run:

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/utils/sheet-music-lyrics-images.ts
git commit -m "feat: prepare sheet music images for Gemini"
```

---

### Task 4: Lyrics Generator Dialog And Editor Wiring

**Files:**
- Create: `components/contis/sheet-music-lyrics-generator-dialog.tsx`
- Modify: `components/contis/lyrics-editor.tsx`
- Modify: `components/shared/override-editor-fields.tsx`
- Modify: `components/shared/arrangement-editor/arrangement-editor.tsx`

- [ ] **Step 1: Create the generator dialog component**

Create `components/contis/sheet-music-lyrics-generator-dialog.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { AiMagicIcon, Loading03Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { generateLyricsFromSheetMusicImages } from "@/lib/actions/sheet-music-lyrics"
import { buildSheetMusicLyricsImagePages } from "@/lib/utils/sheet-music-lyrics-images"
import type { SheetMusicFile } from "@/lib/types"

interface SheetMusicLyricsGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheetMusicFiles: SheetMusicFile[]
  songName?: string
  onGeneratedLyrics: (lyrics: string[]) => void
}

type GeneratorStatus = "idle" | "loading" | "ready" | "error"

export function SheetMusicLyricsGeneratorDialog({
  open,
  onOpenChange,
  sheetMusicFiles,
  songName,
  onGeneratedLyrics,
}: SheetMusicLyricsGeneratorDialogProps) {
  const [status, setStatus] = useState<GeneratorStatus>("idle")
  const [generatedLyrics, setGeneratedLyrics] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const requestSeqRef = useRef(0)

  const generateLyrics = useCallback(async () => {
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq

    setStatus("loading")
    setGeneratedLyrics([])
    setError(null)

    try {
      const pages = await buildSheetMusicLyricsImagePages(sheetMusicFiles)

      if (requestSeqRef.current !== requestSeq) return

      const result = await generateLyricsFromSheetMusicImages({
        songName,
        pages,
      })

      if (requestSeqRef.current !== requestSeq) return

      if (result.success && result.data) {
        setGeneratedLyrics(result.data.lyrics)
        setStatus("ready")
      } else {
        setError(result.error ?? "가사 자동 생성에 실패했습니다.")
        setStatus("error")
      }
    } catch (err) {
      if (requestSeqRef.current !== requestSeq) return
      const message = err instanceof Error ? err.message : "가사 자동 생성에 실패했습니다."
      setError(message)
      setStatus("error")
    }
  }, [sheetMusicFiles, songName])

  useEffect(() => {
    if (!open) {
      requestSeqRef.current += 1
      setStatus("idle")
      setGeneratedLyrics([])
      setError(null)
      return
    }

    void generateLyrics()
  }, [open, generateLyrics])

  const handleAddLyrics = () => {
    if (generatedLyrics.length === 0) return

    onGeneratedLyrics(generatedLyrics)
    toast.success("생성된 가사가 추가되었습니다")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70]"
        className="z-[70] max-h-[86vh] overflow-hidden"
        size="lg"
      >
        <DialogHeader>
          <DialogTitle>악보에서 가사 자동 생성</DialogTitle>
          <DialogDescription>
            악보 이미지를 Gemini에 보내 보이는 가사만 페이지로 정리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-48 overflow-y-auto rounded-lg border bg-muted/20 p-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin" />
              <span className="ml-2">악보 이미지를 분석하는 중...</span>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3 text-sm">
              <p className="text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={generateLyrics}>
                다시 시도
              </Button>
            </div>
          )}

          {status === "ready" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4" />
                {generatedLyrics.length}개 가사 페이지가 생성되었습니다.
              </div>

              <div className="space-y-3">
                {generatedLyrics.map((page, index) => (
                  <div key={`${index}-${page}`} className="space-y-1.5 rounded-md border bg-background p-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      페이지 {index + 1}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {page}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button
            onClick={handleAddLyrics}
            disabled={status !== "ready" || generatedLyrics.length === 0}
          >
            가사에 추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Wire the dialog into `LyricsEditor`**

Modify `components/contis/lyrics-editor.tsx`:

Change imports from Hugeicons:

```tsx
import { Add01Icon, Delete01Icon, TextCheckIcon, ScanImageIcon, Loading03Icon, ArrowUp01Icon, ArrowDown01Icon, AiMagicIcon } from "@hugeicons/core-free-icons"
```

Add the dialog import:

```tsx
import { SheetMusicLyricsGeneratorDialog } from "@/components/contis/sheet-music-lyrics-generator-dialog"
```

Change props:

```tsx
interface LyricsEditorProps {
  initialLyrics: string[]
  onChange: (data: { lyrics: string[]; swappedPages?: [number, number]; insertedAt?: number }) => void
  sheetMusicFiles?: SheetMusicFile[]
  songName?: string
}
```

Change function parameters:

```tsx
export function LyricsEditor({
  initialLyrics,
  onChange,
  sheetMusicFiles,
  songName,
}: LyricsEditorProps) {
```

Add dialog state below `ocrOpen`:

```tsx
const [generatorOpen, setGeneratorOpen] = useState(false)
```

Add handler below `handleOcrExtractedTexts`:

```tsx
const handleGeneratedLyrics = (generatedPages: string[]) => {
  setLyrics(prev => [...prev, ...generatedPages])
}
```

Add the button next to `악보 OCR`:

```tsx
{sheetMusicFiles && sheetMusicFiles.length > 0 && (
  <Button size="xs" variant="outline" onClick={() => setGeneratorOpen(true)}>
    <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
    가사 자동 생성
  </Button>
)}
```

Add the dialog below `OcrRegionSelector`:

```tsx
{sheetMusicFiles && sheetMusicFiles.length > 0 && (
  <SheetMusicLyricsGeneratorDialog
    open={generatorOpen}
    onOpenChange={setGeneratorOpen}
    sheetMusicFiles={sheetMusicFiles}
    songName={songName}
    onGeneratedLyrics={handleGeneratedLyrics}
  />
)}
```

- [ ] **Step 3: Pass song name through override fields**

Modify `components/shared/override-editor-fields.tsx`.

Add `songName` to props:

```tsx
interface OverrideEditorFieldsProps {
  songName?: string
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  sheetMusicFiles?: SheetMusicFile[]
  onKeysTemposChange: (data: { keys: string[]; tempos: number[] }) => void
  onSectionOrderChange: (data: { sectionOrder: string[] }) => void
  onLyricsChange: (data: { lyrics: string[]; swappedPages?: [number, number]; insertedAt?: number }) => void
  onSectionLyricsMapChange: (data: { sectionLyricsMap: Record<number, number[]> }) => void
  onNotesChange: (notes: string | null) => void
}
```

Add `songName` to the destructuring:

```tsx
export function OverrideEditorFields({
  songName,
  keys,
  tempos,
  sectionOrder,
  lyrics,
  sectionLyricsMap,
  notes,
  sheetMusicFiles,
  onKeysTemposChange,
  onSectionOrderChange,
  onLyricsChange,
  onSectionLyricsMapChange,
  onNotesChange,
}: OverrideEditorFieldsProps) {
```

Pass it to `LyricsEditor`:

```tsx
<LyricsEditor
  initialLyrics={lyrics}
  onChange={onLyricsChange}
  sheetMusicFiles={sheetMusicFiles}
  songName={songName}
/>
```

- [ ] **Step 4: Pass song name from `ArrangementEditor`**

Modify `components/shared/arrangement-editor/arrangement-editor.tsx`.

In the `<OverrideEditorFields />` call, add:

```tsx
songName={songName}
```

The call should include:

```tsx
<OverrideEditorFields
  key={editorKey}
  songName={songName}
  keys={draft.keys}
  tempos={draft.tempos}
  sectionOrder={draft.sectionOrder}
  lyrics={draft.lyrics}
  sectionLyricsMap={draft.sectionLyricsMap}
  notes={draft.notes}
  sheetMusicFiles={selectedSheetMusic}
  onKeysTemposChange={(data) => updateDraft(data)}
  onSectionOrderChange={(data) => updateDraft(data)}
  onLyricsChange={handleLyricsChange}
  onSectionLyricsMapChange={(data) => updateDraft(data)}
  onNotesChange={(notes) => updateDraft({ notes })}
/>
```

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add components/contis/sheet-music-lyrics-generator-dialog.tsx components/contis/lyrics-editor.tsx components/shared/override-editor-fields.tsx components/shared/arrangement-editor/arrangement-editor.tsx
git commit -m "feat: add sheet music lyrics generator dialog"
```

---

### Task 5: Source Regression Tests

**Files:**
- Modify: `tests/worship-prep-source.test.mjs`

- [ ] **Step 1: Add source regression test**

Append this test to `tests/worship-prep-source.test.mjs`:

```js
test('sheet music lyrics generator uses Gemini images and appends generated pages', async () => {
  const lyricsEditorSource = await readFile(
    new URL('../components/contis/lyrics-editor.tsx', import.meta.url),
    'utf8',
  );
  const generatorSource = await readFile(
    new URL('../components/contis/sheet-music-lyrics-generator-dialog.tsx', import.meta.url),
    'utf8',
  );
  const imageHelperSource = await readFile(
    new URL('../lib/utils/sheet-music-lyrics-images.ts', import.meta.url),
    'utf8',
  );
  const actionSource = await readFile(
    new URL('../lib/actions/sheet-music-lyrics.ts', import.meta.url),
    'utf8',
  );
  const envExample = await readFile(
    new URL('../.env.example', import.meta.url),
    'utf8',
  );

  assert.match(lyricsEditorSource, /SheetMusicLyricsGeneratorDialog/);
  assert.match(lyricsEditorSource, /가사 자동 생성/);
  assert.match(lyricsEditorSource, /setLyrics\(prev => \[\.\.\.prev, \.\.\.generatedPages\]\)/);
  assert.doesNotMatch(lyricsEditorSource, /setLyrics\(generatedPages\)/);

  assert.match(generatorSource, /generateLyricsFromSheetMusicImages/);
  assert.match(generatorSource, /buildSheetMusicLyricsImagePages/);
  assert.match(generatorSource, /overlayClassName="z-\[70\]"/);
  assert.match(generatorSource, /가사에 추가/);

  assert.match(imageHelperSource, /renderPdfPagesToDataUrls/);
  assert.match(imageHelperSource, /toDataURL\('image\/jpeg', GEMINI_LYRICS_IMAGE_JPEG_QUALITY\)/);

  assert.match(actionSource, /DEFAULT_GEMINI_LYRICS_MODEL = 'gemini-3\.1-pro-preview'/);
  assert.match(actionSource, /responseMimeType: 'application\/json'/);
  assert.match(actionSource, /responseJsonSchema/);
  assert.match(actionSource, /inline_data/);
  assert.doesNotMatch(actionSource, /file_data:\s*\{[\s\S]*application\/pdf/);

  assert.match(envExample, /GEMINI_API_KEY/);
  assert.match(envExample, /GEMINI_LYRICS_MODEL=gemini-3\.1-pro-preview/);
});
```

- [ ] **Step 2: Run source regression test**

Run:

```bash
node --experimental-strip-types --test tests/worship-prep-source.test.mjs
```

Expected: pass.

- [ ] **Step 3: Run full test script**

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add tests/worship-prep-source.test.mjs
git commit -m "test: cover sheet music lyrics generation wiring"
```

---

### Task 6: Final Verification And Manual QA

**Files:**
- No planned source changes.

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: pass.

- [ ] **Step 2: Run full tests**

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: pass.

- [ ] **Step 4: Start dev server**

Run:

```bash
pnpm dev
```

Expected: dev server starts on `http://localhost:3000`.

- [ ] **Step 5: Browser QA**

Use the in-app Browser.

Manual steps:

1. Open `http://localhost:3000`.
2. Log in if required.
3. Open a conti song with at least one sheet music image or PDF.
4. Open the song editor drawer.
5. Confirm both `악보 OCR` and `가사 자동 생성` appear in the lyrics section.
6. Click `가사 자동 생성`.
7. Confirm the dialog shows `악보에서 가사 자동 생성` and starts loading.
8. With `GEMINI_API_KEY` absent, confirm the dialog shows the missing key error.
9. Add `GEMINI_API_KEY` in the local environment and restart the dev server.
10. Repeat generation on a sheet music image or PDF.
11. Confirm generated pages preview in the dialog.
12. Click `가사에 추가`.
13. Confirm generated pages are appended after any existing pages.
14. Confirm existing pages are not replaced.
15. Confirm long line warnings follow the new visual length rule.

- [ ] **Step 6: Confirm no uncommitted QA drift remains**

Run:

```bash
git status --short
```

Expected: no output after successful QA. If this command prints source changes, inspect the diff and either commit the intentional fix with a specific file list or revert only the worker's own accidental scratch changes.
