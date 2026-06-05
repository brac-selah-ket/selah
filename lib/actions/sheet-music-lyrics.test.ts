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

test("uses Gemini 3 Pro Preview as the default lyrics model", () => {
  assert.equal(DEFAULT_GEMINI_LYRICS_MODEL, "gemini-3-pro-preview")
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
      assert.match(calls[0].url, /gemini-3-pro-preview:generateContent/)
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
