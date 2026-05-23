import assert from "node:assert/strict"
import test from "node:test"
import {
  getSheetMusicSelectionSaveError,
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
