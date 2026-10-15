import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("globals define a dedicated diff-removed token in all four themes", async () => {
  const source = await read("app/globals.css")

  assert.match(source, /--color-diff-removed:\s*var\(--diff-removed\);/)

  const rootBlock = source.match(/:root\s*\{[^}]*\}/s)?.[0] ?? ""
  const darkBlock = source.match(/\n\.dark\s*\{[^}]*\}/s)?.[0] ?? ""
  const chapelBlock = source.match(/\n\.theme-chapel\s*\{[^}]*\}/s)?.[0] ?? ""
  const darkChapelBlock = source.match(/\n\.dark \.theme-chapel\s*\{[^}]*\}/s)?.[0] ?? ""

  for (const [name, block] of [
    ["root", rootBlock],
    ["dark", darkBlock],
    ["chapel", chapelBlock],
    ["dark chapel", darkChapelBlock],
  ]) {
    assert.match(block, /--diff-removed:\s*#[0-9a-f]{6};/, `${name} theme is missing --diff-removed`)
  }
})

test("removed-lyric diff spans use the diff-removed token and keep line-through", async () => {
  const files = [
    "components/contis/spell-check-dialog.tsx",
    "components/contis/lyrics-editor.tsx",
    "components/contis/ocr-region-selector.tsx",
    "components/contis/sheet-music-lyrics-generator-dialog.tsx",
  ]

  for (const file of files) {
    const source = await read(file)
    assert.match(
      source,
      /bg-diff-removed\/10[^"]*text-diff-removed[^"]*line-through|text-diff-removed[^"]*line-through/,
      `${file} is missing the diff-removed + line-through pairing`,
    )
    assert.doesNotMatch(source, /bg-destructive\/10 text-destructive line-through/, `${file} still uses the raw destructive diff token`)
    assert.doesNotMatch(source, /bg-destructive\/10 px-0\.5 text-destructive line-through/, `${file} still uses the raw destructive diff token`)
  }
})

test("added-lyric diff highlight boosts opacity in dark mode", async () => {
  const files = [
    "components/contis/spell-check-dialog.tsx",
    "components/contis/lyrics-editor.tsx",
    "components/contis/ocr-region-selector.tsx",
    "components/contis/sheet-music-lyrics-generator-dialog.tsx",
  ]

  for (const file of files) {
    const source = await read(file)
    assert.match(source, /bg-success\/10[^"]*dark:bg-success\/20|dark:bg-success\/20[^"]*bg-success\/10/, `${file} is missing dark:bg-success/20`)
  }
})

test("OCR page delete button keeps a fixed, documented overlay color instead of theme destructive", async () => {
  const source = await read("components/contis/ocr-region-selector.tsx")

  assert.match(source, /oxlint-disable-next-line shadcn\/no-raw-colors -- PDF overlay delete control/)
  assert.match(source, /bg-red-600 text-white rounded-full size-4[^"]*hover:bg-red-600\/90/)
  assert.doesNotMatch(source, /className="bg-destructive text-white rounded-full size-4/)
})
