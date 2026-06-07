import assert from "node:assert/strict"
import { test } from "vitest"
import {
  buildBatchImportItems,
  type YouTubeImportReviewItem,
} from "./youtube-import-model.ts"

const defaultPresetName = "2026-03-08"

const existingItem: YouTubeImportReviewItem = {
  id: "yt-1",
  originalTitle: "주를 바라보며",
  editedName: "주를 바라보며",
  videoId: "playlist-video",
  matchedSong: { id: "song-1", name: "주를 바라보며" } as YouTubeImportReviewItem["matchedSong"],
  isAlreadyInConti: false,
  excluded: false,
  selectedPresetId: "preset-1",
  createNewPreset: false,
  presetName: "2026-03-08",
  presets: [],
  existingYoutubeRef: "existing-video",
  replaceExistingYoutube: false,
}

test("existing preset can preserve its YouTube reference while keeping playlist metadata in payload", () => {
  const [item] = buildBatchImportItems([existingItem], defaultPresetName)

  assert.equal(item.replaceExistingYoutube, false)
  assert.equal(item.videoId, "playlist-video")
  assert.equal(item.title, "주를 바라보며")
})

test("existing preset can explicitly replace its YouTube reference", () => {
  const [item] = buildBatchImportItems(
    [{ ...existingItem, replaceExistingYoutube: true }],
    defaultPresetName,
  )

  assert.equal(item.replaceExistingYoutube, true)
})

test("new song path creates a new song payload and defaults to playlist YouTube", () => {
  const [item] = buildBatchImportItems(
    [
      {
        id: "yt-2",
        originalTitle: "새 노래",
        editedName: "  새 노래  ",
        videoId: "new-video",
        matchedSong: null,
        isAlreadyInConti: false,
        excluded: false,
        selectedPresetId: null,
        createNewPreset: true,
        presetName: "",
        presets: null,
        existingYoutubeRef: null,
        replaceExistingYoutube: false,
      },
    ],
    defaultPresetName,
  )

  assert.equal(item.songId, null)
  assert.equal(item.newSongName, "새 노래")
  assert.equal(item.createNewPreset, true)
  assert.equal(item.videoId, "new-video")
  assert.equal(item.replaceExistingYoutube, true)
  assert.equal(item.presetName, defaultPresetName)
})

test("excluded review items are omitted from the batch payload", () => {
  const items = buildBatchImportItems(
    [
      existingItem,
      {
        ...existingItem,
        id: "yt-3",
        videoId: "excluded-video",
        excluded: true,
      },
    ],
    defaultPresetName,
  )

  assert.equal(items.length, 1)
  assert.equal(items[0]?.videoId, "playlist-video")
})
