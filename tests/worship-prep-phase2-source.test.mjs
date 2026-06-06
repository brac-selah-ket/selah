import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("worship prep element cards use compact source and value hierarchy", async () => {
  const source = await readFile(
    new URL("../components/worship-prep/prep-element-cards.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /"use client"/)
  assert.match(source, /sourceLabel/)
  assert.match(source, /구글 시트/)
  assert.match(source, /콘티/)
  assert.match(source, /valueClassName/)
  assert.match(source, /gap-2/)
})

test("connected conti card is a single link without nested links", async () => {
  const source = await readFile(
    new URL("../components/worship-prep/prep-element-cards.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /href=\{`\/contis\/\$\{conti\.id\}`\}/)
  assert.equal(source.match(/<Link\b/g)?.length, 1)
})

test("worship prep page uses tighter section spacing and groups controls", async () => {
  const source = await readFile(
    new URL("../app/(authenticated)/worship-prep/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /className='flex flex-col gap-5'/)
  assert.match(
    source,
    /<div className='space-y-4'>\s*<WorshipDateSelector selectedDate=\{selectedDate\} \/>\s*<PrepAutomationPanel \/>\s*<\/div>/,
  )
})
