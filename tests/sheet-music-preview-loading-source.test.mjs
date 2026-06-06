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
  assert.match(source, /const \[sheetMusicPreviewPrepared, setSheetMusicPreviewPrepared\] = useState/)
  assert.match(source, /const openRef = useRef\(open\)/)
  assert.match(
    source,
    /useLayoutEffect\(\(\) => \{\s*openRef\.current = open\s*\}, \[open\]\)/,
  )
  assert.match(
    source,
    /if \(open\) \{[\s\S]*setSheetMusicLoading\(false\)[\s\S]*setSheetMusicPreviewPrepared\(false\)[\s\S]*setSheetMusicPreviewItem\(null\)[\s\S]*\}/,
  )
  assert.match(
    source,
    /const previewLoading =\s*sheetMusicLoading \|\|\s*\(\s*open &&\s*sheetMusic\.length > 0 &&\s*!sheetMusicPreviewItem &&\s*!sheetMusicPreviewPrepared\s*\)/,
  )
  assert.match(source, /if \(!openRef\.current\) \{\s*return\s*\}/)
  assert.match(source, /sheetMusicLoading=\{previewLoading\}/)
  assert.match(source, /onPreviewLoadingChange=\{handlePreviewLoadingChange\}/)
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
