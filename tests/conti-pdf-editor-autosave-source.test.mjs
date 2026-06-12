import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

function sliceBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern)
  assert.notEqual(start, -1, `missing start pattern ${startPattern}`)
  const rest = source.slice(start)
  const end = rest.search(endPattern)
  assert.notEqual(end, -1, `missing end pattern ${endPattern}`)
  return rest.slice(0, end)
}

test("pdf autosave debounces first edit and collapses overlapping saves", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-auto-save.ts")

  assert.doesNotMatch(source, /lastSaveRef/)
  assert.match(source, /activeSavePromiseRef/)
  assert.match(source, /pendingSaveRef/)
  assert.match(source, /saveLatestRef/)

  const triggerBody = sliceBetween(
    source,
    /const triggerAutoSave = useCallback/,
    /async function handleManualSave/
  )
  const beforeTimer = triggerBody.split(/setTimeout/)[0]

  assert.match(triggerBody, /setTimeout/)
  assert.match(triggerBody, /3000/)
  assert.match(triggerBody, /saveLatestRef\.current\(\)/)
  assert.doesNotMatch(beforeTimer, /saveLatestRef\.current\(\)/)
  assert.doesNotMatch(beforeTimer, /performSaveRef\.current\(\)/)
  assert.doesNotMatch(triggerBody, /Date\.now/)
  assert.doesNotMatch(triggerBody, /return;\s*\}/)
})

test("overlay dragging updates local state during move and autosaves once on pointer up", async () => {
  const source = await read("components/contis/pdf-export/hooks/use-overlays.ts")

  assert.match(source, /hasDraggedRef/)
  assert.match(source, /updateOverlayPosition/)

  const moveBody = sliceBetween(
    source,
    /function handlePointerMove/,
    /function handlePointerUp/
  )
  assert.match(moveBody, /updateOverlayPosition\(overlayId/)
  assert.match(moveBody, /hasDraggedRef\.current\s*=\s*true/)
  assert.doesNotMatch(moveBody, /triggerAutoSave\(\)/)
  assert.doesNotMatch(moveBody, /updateOverlay\(overlayId/)

  const upBody = sliceBetween(
    source,
    /function handlePointerUp/,
    /return \{/
  )
  assert.match(upBody, /hasDraggedRef\.current/)
  assert.match(upBody, /triggerAutoSave\(\)/)
})
