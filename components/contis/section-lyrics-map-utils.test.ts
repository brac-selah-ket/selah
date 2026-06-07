import assert from "node:assert/strict"
import test from "node:test"

import {
  addLyricsPageToSection,
  pruneInvalidLyricsPages,
  removeLyricsPageOccurrence,
} from "./section-lyrics-map-utils.ts"

test("allows adding the same lyrics page to the same section more than once in click order", () => {
  const initial: Record<number, number[]> = {}

  const first = addLyricsPageToSection(initial, 1, 0)
  const second = addLyricsPageToSection(first, 1, 2)
  const result = addLyricsPageToSection(second, 1, 0)

  assert.deepEqual(result, { 1: [0, 2, 0] })
  assert.deepEqual(initial, {})
  assert.deepEqual(first, { 1: [0] })
  assert.deepEqual(second, { 1: [0, 2] })
})

test("removes only the occurrence at the requested position", () => {
  const initial = { 1: [0, 2, 0] }

  const result = removeLyricsPageOccurrence(initial, 1, 1)

  assert.deepEqual(result, { 1: [0, 0] })
  assert.deepEqual(initial, { 1: [0, 2, 0] })
})

test("removes the section key when the last occurrence is removed", () => {
  const initial = { 1: [2] }

  const result = removeLyricsPageOccurrence(initial, 1, 0)

  assert.deepEqual(result, {})
  assert.deepEqual(initial, { 1: [2] })
})

test("prunes invalid page indexes without deduping valid repeated indexes", () => {
  const initial = { 0: [0, 2, 0, 4], 1: [3] }

  const result = pruneInvalidLyricsPages(initial, 3)

  assert.deepEqual(result, { 0: [0, 2, 0] })
  assert.deepEqual(initial, { 0: [0, 2, 0, 4], 1: [3] })
})
