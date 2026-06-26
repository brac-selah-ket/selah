import assert from "node:assert/strict"
import { test } from "vitest"
import {
  buildMashupFallbackLyrics,
  type MashupLyricsCandidate,
} from "./mashup-lyrics.ts"

test("buildMashupFallbackLyrics appends default single preset lyrics in member song order", () => {
  const candidates: MashupLyricsCandidate[] = [
    {
      songId: "song-b",
      presetType: "single",
      isDefault: false,
      sortOrder: 0,
      lyrics: JSON.stringify(["B alternate"]),
    },
    {
      songId: "song-a",
      presetType: "single",
      isDefault: true,
      sortOrder: 1,
      lyrics: JSON.stringify(["A page 1", "A page 2"]),
    },
    {
      songId: "song-b",
      presetType: "single",
      isDefault: true,
      sortOrder: 9,
      lyrics: JSON.stringify(["B default"]),
    },
  ]

  assert.deepEqual(buildMashupFallbackLyrics(["song-a", "song-b"], candidates), [
    "A page 1",
    "A page 2",
    "B default",
  ])
})

test("buildMashupFallbackLyrics uses the first single preset with lyrics when default lyrics are empty", () => {
  const candidates: MashupLyricsCandidate[] = [
    {
      songId: "song-a",
      presetType: "mashup",
      isDefault: true,
      sortOrder: -1,
      lyrics: JSON.stringify(["wrong mashup page"]),
    },
    {
      songId: "song-a",
      presetType: "single",
      isDefault: true,
      sortOrder: 0,
      lyrics: JSON.stringify([]),
    },
    {
      songId: "song-a",
      presetType: "single",
      isDefault: false,
      sortOrder: 2,
      lyrics: null,
    },
    {
      songId: "song-a",
      presetType: "single",
      isDefault: false,
      sortOrder: 1,
      lyrics: JSON.stringify(["A fallback"]),
    },
    {
      songId: "song-b",
      presetType: "single",
      isDefault: true,
      sortOrder: 0,
      lyrics: JSON.stringify(["B default"]),
    },
  ]

  assert.deepEqual(buildMashupFallbackLyrics(["song-a", "song-b"], candidates), [
    "A fallback",
    "B default",
  ])
})
