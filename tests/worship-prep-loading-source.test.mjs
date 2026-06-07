import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

test("worship prep route renders a skeleton while server data loads", async () => {
  const source = await readFile(
    new URL("../app/(authenticated)/worship-prep/loading.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /import \{ Skeleton \} from "@\/components\/ui\/skeleton"/)
  assert.match(source, /export default function WorshipPrepLoading/)
  assert.match(source, /Array\.from\(\{ length: 6 \}\)/)
  assert.match(source, /data-slot="worship-prep-loading"/)
  assert.match(source, /h-32 rounded-xl/)
})
