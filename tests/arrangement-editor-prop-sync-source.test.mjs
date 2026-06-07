import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("arrangement editor resets opening draft before child effects can publish stale values", async () => {
  const source = await readFile(
    new URL("../components/shared/arrangement-editor/arrangement-editor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /import \{ useLayoutEffect, useMemo, useRef, useState \} from "react"/)
  assert.match(
    source,
    /useLayoutEffect\(\(\) => \{\s*if \(open && !wasOpenRef\.current\) \{/,
  )
})

test("preset editor does not mount arrangement editor while closed", async () => {
  const source = await readFile(
    new URL("../components/songs/preset-editor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /if \(!open\) \{\s*return null\s*\}/)
  assert.match(source, /initialDraft=\{initialDraft\}/)
})
