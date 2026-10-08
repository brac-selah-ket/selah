import assert from "node:assert/strict"
import { test } from "vitest"
import {
  MAX_EXPORT_VIDEO_IDS,
  buildYouTubeWatchVideosUrl,
  collectYouTubeVideoIdsForExport,
} from "./youtube-playlist-export.ts"
import type { ContiSongWithSong } from "@/lib/types"

function makeContiSong(
  overrides: Partial<ContiSongWithSong> & { sortOrder: number },
): ContiSongWithSong {
  return {
    id: `cs-${overrides.sortOrder}`,
    contiId: "conti-1",
    songId: `song-${overrides.sortOrder}`,
    keys: null,
    tempos: null,
    sectionOrder: null,
    lyrics: null,
    sectionLyricsMap: null,
    notes: null,
    sheetMusicFileIds: null,
    presetId: null,
    mashupGroupId: null,
    mashupPartOrder: null,
    preMashupPresetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    song: { id: `song-${overrides.sortOrder}`, name: `Song ${overrides.sortOrder}`, createdAt: new Date(), updatedAt: new Date() },
    overrides: {
      keys: [],
      tempos: [],
      sectionOrder: [],
      lyrics: [],
      sectionLyricsMap: {},
      notes: null,
      sheetMusicFileIds: null,
      presetId: null,
    },
    appliedPreset: null,
    ...overrides,
  }
}

test("collectYouTubeVideoIdsForExport collects video ids in conti order", () => {
  const songs = [
    makeContiSong({
      sortOrder: 1,
      appliedPreset: {
        id: "preset-2",
        name: "p2",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "https://youtu.be/secondvide2",
        youtubeTitle: null,
      },
    }),
    makeContiSong({
      sortOrder: 0,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "firstvideo1",
        youtubeTitle: null,
      },
    }),
  ]

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.deepEqual(result.videoIds, ["firstvideo1", "secondvide2"])
  assert.equal(result.missingCount, 0)
  assert.equal(result.totalCount, 2)
  assert.equal(result.truncated, false)
})

test("collectYouTubeVideoIdsForExport skips songs without a youtube reference and counts them", () => {
  const songs = [
    makeContiSong({ sortOrder: 0, appliedPreset: null }),
    makeContiSong({
      sortOrder: 1,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "firstvideo1",
        youtubeTitle: null,
      },
    }),
  ]

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.deepEqual(result.videoIds, ["firstvideo1"])
  assert.equal(result.missingCount, 1)
  assert.equal(result.totalCount, 2)
})

test("collectYouTubeVideoIdsForExport includes both parts of a mashup in order", () => {
  const songs = [
    makeContiSong({
      sortOrder: 0,
      mashupGroupId: "group-1",
      mashupPartOrder: 0,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "mashup",
        displayTitle: "Mashup",
        youtubeReference: "partonevid1",
        youtubeTitle: null,
      },
    }),
    makeContiSong({
      sortOrder: 1,
      mashupGroupId: "group-1",
      mashupPartOrder: 1,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "mashup",
        displayTitle: "Mashup",
        youtubeReference: "parttwovid2",
        youtubeTitle: null,
      },
    }),
  ]

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.deepEqual(result.videoIds, ["partonevid1", "parttwovid2"])
})

test("collectYouTubeVideoIdsForExport collapses a mashup's consecutive duplicate video id into one", () => {
  const songs = [
    makeContiSong({
      sortOrder: 0,
      mashupGroupId: "group-1",
      mashupPartOrder: 0,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "mashup",
        displayTitle: "Mashup",
        youtubeReference: "sharedvide1",
        youtubeTitle: null,
      },
    }),
    makeContiSong({
      sortOrder: 1,
      mashupGroupId: "group-1",
      mashupPartOrder: 1,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "mashup",
        displayTitle: "Mashup",
        youtubeReference: "sharedvide1",
        youtubeTitle: null,
      },
    }),
  ]

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.deepEqual(result.videoIds, ["sharedvide1"])
  assert.equal(result.missingCount, 0)
  assert.equal(result.totalCount, 2)
})

test("collectYouTubeVideoIdsForExport keeps non-consecutive repeats of the same video id", () => {
  const songs = [
    makeContiSong({
      sortOrder: 0,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "repeatvide1",
        youtubeTitle: null,
      },
    }),
    makeContiSong({
      sortOrder: 1,
      appliedPreset: {
        id: "preset-2",
        name: "p2",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "differentv2",
        youtubeTitle: null,
      },
    }),
    makeContiSong({
      sortOrder: 2,
      appliedPreset: {
        id: "preset-1",
        name: "p1",
        presetType: "single",
        displayTitle: null,
        youtubeReference: "repeatvide1",
        youtubeTitle: null,
      },
    }),
  ]

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.deepEqual(result.videoIds, ["repeatvide1", "differentv2", "repeatvide1"])
})

test("collectYouTubeVideoIdsForExport truncates to MAX_EXPORT_VIDEO_IDS", () => {
  const songs = Array.from({ length: MAX_EXPORT_VIDEO_IDS + 5 }, (_, index) =>
    makeContiSong({
      sortOrder: index,
      appliedPreset: {
        id: `preset-${index}`,
        name: `p${index}`,
        presetType: "single",
        displayTitle: null,
        youtubeReference: `video${String(index).padStart(6, "0")}`,
        youtubeTitle: null,
      },
    }),
  )

  const result = collectYouTubeVideoIdsForExport(songs)
  assert.equal(result.videoIds.length, MAX_EXPORT_VIDEO_IDS)
  assert.equal(result.truncated, true)
  assert.equal(result.totalCount, MAX_EXPORT_VIDEO_IDS + 5)
})

test("buildYouTubeWatchVideosUrl joins video ids into a watch_videos URL", () => {
  assert.equal(
    buildYouTubeWatchVideosUrl(["abc", "def"]),
    "https://www.youtube.com/watch_videos?video_ids=abc,def",
  )
})
