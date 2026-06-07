import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("section lyrics mapper uses append/remove helpers for repeatable page mappings", async () => {
  const source = await readFile(
    new URL("../components/contis/section-lyrics-mapper.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /addLyricsPageToSection/)
  assert.match(source, /removeLyricsPageOccurrence/)
  assert.match(source, /pruneInvalidLyricsPages/)
  assert.doesNotMatch(source, /type="checkbox"/)
  assert.doesNotMatch(source, /\.includes\(lyricsIndex\)/)
})

test("section lyrics mapper shows selected order with individually removable repeated pages", async () => {
  const source = await readFile(
    new URL("../components/contis/section-lyrics-mapper.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /선택된 순서/)
  assert.match(source, /aria-label=\{`페이지 \$\{lyricsIndex \+ 1\} 매핑 제거`\}/)
  assert.match(source, /배치된 가사 페이지가 없습니다/)
})

test("section lyrics mapper keeps lyric preview tooltips on page controls and preview badges", async () => {
  const source = await readFile(
    new URL("../components/contis/section-lyrics-mapper.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /<Tooltip\b/)
  assert.match(source, /<TooltipTrigger/)
  assert.match(source, /<TooltipContent className="whitespace-pre-wrap">/)
  assert.match(source, /\{lyric \|\| "\([\uBE48] 페이지\)"\}/)
  assert.match(source, /\{lyrics\[lyricsIndex\] \|\| "\([\uBE48] 페이지\)"\}/)
})

test("section lyrics page controls are visibly interactive and screen-reader explicit", async () => {
  const source = await readFile(
    new URL("../components/contis/section-lyrics-mapper.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /aria-label=\{`페이지 \$\{lyricsIndex \+ 1\} 가사 추가`\}/)
  assert.match(source, /cursor-pointer/)
})
