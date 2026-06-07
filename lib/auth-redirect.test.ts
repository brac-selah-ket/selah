import assert from "node:assert/strict"
import { test } from "vitest"
import { getSafeNextPath } from "./auth-redirect.ts"

test("accepts internal next paths with query strings", () => {
  assert.equal(getSafeNextPath("/contis/abc?tab=songs"), "/contis/abc?tab=songs")
})

test("rejects absolute and protocol-relative next values", () => {
  assert.equal(getSafeNextPath("https://example.com/steal"), "/worship-prep")
  assert.equal(getSafeNextPath("//example.com/steal"), "/worship-prep")
})

test("rejects empty next values", () => {
  assert.equal(getSafeNextPath(null), "/worship-prep")
  assert.equal(getSafeNextPath(""), "/worship-prep")
})
