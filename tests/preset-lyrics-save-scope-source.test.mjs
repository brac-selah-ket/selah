import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("song schemas expose canonical lyrics storage", async () => {
  const tursoSchema = await read("lib/db/turso-schema.ts")

  assert.match(tursoSchema, /export const songs = sqliteTable\('songs', \{[\s\S]*lyrics: text\('lyrics'\)/)
})

test("preset save flow can route single-preset lyrics to song or preset scope", async () => {
  const [types, editor, presetEditor, action] = await Promise.all([
    read("components/shared/arrangement-editor/types.ts"),
    read("components/shared/arrangement-editor/arrangement-editor.tsx"),
    read("components/songs/preset-editor.tsx"),
    read("lib/actions/song-presets.ts"),
  ])

  assert.match(types, /lyricsSaveScope\?: "song" \| "preset"/)
  assert.match(editor, /shouldConfirmLyricsSaveScope/)
  assert.match(editor, /이 프리셋에만 적용/)
  assert.match(editor, /lyricsSaveScope: presetOnlyLyrics \? "preset" : "song"/)
  assert.match(presetEditor, /lyricsSaveScope/)
  assert.match(action, /lyricsSaveScopeSchema/)
})
