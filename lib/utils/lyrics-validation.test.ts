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
