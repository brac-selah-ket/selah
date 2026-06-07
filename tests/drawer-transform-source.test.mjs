import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

test("app shell drawer uses inline transform instead of cascading transform utilities", async () => {
  const source = await readFile(
    new URL("../components/layout/app-shell.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /useEffect, useState/)
  assert.match(source, /matchMedia\("\(min-width: 768px\)"\)/)
  assert.doesNotMatch(source, /drawer-transform/)
  assert.doesNotMatch(source, /translate-x-full/)
  assert.doesNotMatch(source, /translate-y-full/)
  assert.doesNotMatch(source, /md:translate-x-0/)
  assert.doesNotMatch(source, /md:translate-y-0/)
  assert.match(
    source,
    /const drawerTransform = isOpen\s*\?\s*"translate3d\(0, 0, 0\)"\s*:\s*isDesktopDrawer\s*\?\s*"translate3d\(100%, 0, 0\)"\s*:\s*"translate3d\(0, 100%, 0\)"/,
  )
  assert.match(
    source,
    /const drawerTransition = isOpen\s*\?\s*"none"\s*:\s*"transform 300ms ease-in-out"/,
  )
  assert.match(
    source,
    /style=\{\{ transform: drawerTransform, transition: drawerTransition \}\}/,
  )
  assert.doesNotMatch(source, /transition-transform/)
})
