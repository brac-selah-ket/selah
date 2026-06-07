import assert from "node:assert/strict"
import { test } from "vitest"
import { getDefaultWorshipPrepIsoDate } from "../lib/worship-prep/default-date.ts"

test("keeps the current Sunday as the default worship prep date", () => {
  assert.equal(
    getDefaultWorshipPrepIsoDate(new Date(2026, 5, 7, 12)),
    "2026-06-07",
  )
})

test("moves to the next Sunday after the current Sunday has passed", () => {
  assert.equal(
    getDefaultWorshipPrepIsoDate(new Date(2026, 5, 8, 12)),
    "2026-06-14",
  )
})

test("uses the Korea calendar date when the server timezone is UTC", () => {
  const originalTz = process.env.TZ
  process.env.TZ = "UTC"

  try {
    assert.equal(
      getDefaultWorshipPrepIsoDate(new Date("2026-06-07T16:30:00.000Z")),
      "2026-06-14",
    )
  } finally {
    if (originalTz === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = originalTz
    }
  }
})

test("uses the nearest upcoming Sunday before Sunday", () => {
  assert.equal(
    getDefaultWorshipPrepIsoDate(new Date(2026, 5, 6, 12)),
    "2026-06-07",
  )
})
