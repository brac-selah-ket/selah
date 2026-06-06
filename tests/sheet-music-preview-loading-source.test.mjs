import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("sheet music gallery reports controlled preview loading state", async () => {
  const source = await readFile(
    new URL("../components/songs/sheet-music-gallery.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /onPreviewLoadingChange\?: \(loading: boolean\) => void/)
  assert.match(source, /previewLoadingChangeRef/)
  assert.match(source, /previewLoadingChangeRef\.current\?\.\(true\)/)
  assert.match(source, /previewLoadingChangeRef\.current\?\.\(false\)/)
})

test("preset editor forwards preview loading state to the arrangement editor", async () => {
  const source = await readFile(
    new URL("../components/songs/preset-editor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /const \[sheetMusicLoading, setSheetMusicLoading\] = useState/)
  assert.match(source, /sheetMusicLoading=\{sheetMusicLoading\}/)
  assert.match(source, /onPreviewLoadingChange=\{setSheetMusicLoading\}/)
})

test("conti song editor combines fetched and preview loading state", async () => {
  const source = await readFile(
    new URL("../components/contis/conti-song-editor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /const \[sheetMusicPreviewLoading, setSheetMusicPreviewLoading\] = useState/)
  assert.match(source, /sheetMusicLoading=\{sheetMusicLoading \|\| sheetMusicPreviewLoading\}/)
  assert.match(source, /onPreviewLoadingChange=\{setSheetMusicPreviewLoading\}/)
})
