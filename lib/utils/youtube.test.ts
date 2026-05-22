import assert from "node:assert/strict"
import test from "node:test"
import {
  getYouTubeReferenceLabel,
  extractYouTubeVideoId,
  formatYouTubeDisplayUrl,
  normalizeYouTubeReference,
  toYouTubeInputValue,
  toYouTubeWatchUrl,
} from "./youtube.ts"

test("extractYouTubeVideoId accepts video IDs and common YouTube URLs", () => {
  assert.equal(extractYouTubeVideoId("dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
  assert.equal(extractYouTubeVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
})

test("extractYouTubeVideoId rejects unsupported values", () => {
  assert.equal(extractYouTubeVideoId(""), null)
  assert.equal(extractYouTubeVideoId("not a video"), null)
  assert.equal(extractYouTubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null)
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/not-watch?v=dQw4w9WgXcQ"), null)
  assert.equal(extractYouTubeVideoId("https://music.youtube.com/embed/dQw4w9WgXcQ"), null)
  assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ/extra"), null)
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ/extra"), null)
  assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ/extra"), null)
  assert.equal(extractYouTubeVideoId("ftp://www.youtube.com/watch?v=dQw4w9WgXcQ"), null)
})

test("normalizeYouTubeReference returns storage and display values", () => {
  assert.deepEqual(normalizeYouTubeReference("https://youtu.be/dQw4w9WgXcQ"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    displayUrl: "youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.equal(normalizeYouTubeReference(null), null)
  assert.equal(normalizeYouTubeReference("   "), null)
})

test("toYouTubeWatchUrl and formatYouTubeDisplayUrl are stable", () => {
  assert.equal(toYouTubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(formatYouTubeDisplayUrl("dQw4w9WgXcQ"), "youtube.com/watch?v=dQw4w9WgXcQ")
})

test("toYouTubeInputValue returns a canonical full watch URL", () => {
  assert.equal(toYouTubeInputValue("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(toYouTubeInputValue("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(toYouTubeInputValue(null), "")
  assert.equal(toYouTubeInputValue("not a video"), "")
})

test("getYouTubeReferenceLabel prefers a title and falls back to compact URL", () => {
  assert.equal(getYouTubeReferenceLabel("dQw4w9WgXcQ", "  My Video  "), "My Video")
  assert.equal(getYouTubeReferenceLabel("dQw4w9WgXcQ", null), "youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(getYouTubeReferenceLabel("not a video", "Title"), null)
})
