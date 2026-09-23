import assert from "node:assert/strict"
import { test } from "vitest"
import {
  getPrimarySaveLabel,
  getPrimarySaveSuccessMessage,
  getSheetMusicSelectionSaveError,
  resolvePresetLyricsSave,
  shouldConfirmLyricsSaveScope,
  shouldShowYouTubeReferenceField,
} from "./save-rules.ts"

test("shows editable YouTube reference only in preset mode", () => {
  assert.equal(shouldShowYouTubeReferenceField("preset"), true)
  assert.equal(shouldShowYouTubeReferenceField("conti-song"), false)
})

test("rejects an explicit empty sheet music selection when files are available", () => {
  assert.equal(
    getSheetMusicSelectionSaveError([], 2),
    "악보를 최소 1개 이상 선택해주세요",
  )
})

test("allows all sheet music, a non-empty selection, or no available sheet music", () => {
  assert.equal(getSheetMusicSelectionSaveError(null, 2), null)
  assert.equal(getSheetMusicSelectionSaveError(["sheet-1"], 2), null)
  assert.equal(getSheetMusicSelectionSaveError([], 0), null)
})

test("confirms save scope only for changed existing single preset lyrics", () => {
  assert.equal(
    shouldConfirmLyricsSaveScope({
      mode: "preset",
      presetType: "single",
      hasExistingPreset: true,
      initialLyrics: ["old lyrics"],
      draftLyrics: ["new lyrics"],
    }),
    true,
  )

  assert.equal(
    shouldConfirmLyricsSaveScope({
      mode: "preset",
      presetType: "single",
      hasExistingPreset: true,
      initialLyrics: ["same lyrics"],
      draftLyrics: ["same lyrics"],
    }),
    false,
  )
})

test("does not confirm save scope for mashups, new presets, or conti songs", () => {
  assert.equal(
    shouldConfirmLyricsSaveScope({
      mode: "preset",
      presetType: "mashup",
      hasExistingPreset: true,
      initialLyrics: ["old lyrics"],
      draftLyrics: ["new lyrics"],
    }),
    false,
  )

  assert.equal(
    shouldConfirmLyricsSaveScope({
      mode: "preset",
      presetType: "single",
      hasExistingPreset: false,
      initialLyrics: ["old lyrics"],
      draftLyrics: ["new lyrics"],
    }),
    false,
  )

  assert.equal(
    shouldConfirmLyricsSaveScope({
      mode: "conti-song",
      presetType: "single",
      hasExistingPreset: true,
      initialLyrics: ["old lyrics"],
      draftLyrics: ["new lyrics"],
    }),
    false,
  )
})

test("asks lyrics scope and includes lyrics only when existing single preset lyrics changed", () => {
  assert.deepEqual(
    resolvePresetLyricsSave({
      presetType: "single",
      hasExistingPreset: true,
      baselineLyrics: ["a"],
      draftLyrics: ["b"],
    }),
    { includeLyrics: true, askScope: true },
  )
  assert.deepEqual(
    resolvePresetLyricsSave({
      presetType: "single",
      hasExistingPreset: true,
      baselineLyrics: ["a"],
      draftLyrics: ["a"],
    }),
    { includeLyrics: false, askScope: false },
  )
})

test("always includes lyrics without scope for new or mashup presets", () => {
  assert.deepEqual(
    resolvePresetLyricsSave({
      presetType: "single",
      hasExistingPreset: false,
      baselineLyrics: [],
      draftLyrics: ["a"],
    }),
    { includeLyrics: true, askScope: false },
  )
  assert.deepEqual(
    resolvePresetLyricsSave({
      presetType: "mashup",
      hasExistingPreset: true,
      baselineLyrics: ["a"],
      draftLyrics: ["b"],
    }),
    { includeLyrics: true, askScope: false },
  )
})

test("labels the primary save button and toast by save target", () => {
  assert.equal(getPrimarySaveLabel("preset"), "프리셋에 저장")
  assert.equal(getPrimarySaveLabel("conti-song"), "이 콘티에만 저장")
  assert.equal(getPrimarySaveSuccessMessage("preset"), "프리셋에 저장되었습니다")
  assert.equal(getPrimarySaveSuccessMessage("conti-song"), "이 콘티에 저장되었습니다")
})
