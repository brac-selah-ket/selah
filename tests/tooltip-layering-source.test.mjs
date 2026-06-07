import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("tooltip content renders above the app drawer layer", async () => {
  const source = await readFile(
    new URL("../components/ui/tooltip.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /className="isolate z-\[70\]"/)
  assert.match(source, /bg-foreground text-background z-\[70\]/)
})
