import assert from "node:assert/strict"
import { test } from "vitest"
import { readFile } from "node:fs/promises"

test("preset editor refreshes the song detail route after successful create or update", async () => {
  const source = await readFile(
    new URL("../components/songs/preset-editor.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /import \{ useRouter \} from "next\/navigation"/)
  assert.match(source, /const router = useRouter\(\)/)
  assert.match(source, /if \(result\.success\) \{\s*router\.refresh\(\)\s*\}/)
})

test("preset list refreshes and synchronizes selected preset state after mutations", async () => {
  const source = await readFile(
    new URL("../components/songs/preset-list.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /import \{ useRouter \} from "next\/navigation"/)
  assert.match(source, /const router = useRouter\(\)/)
  assert.match(source, /router\.refresh\(\)/)
  assert.match(source, /const refreshedPreset = presets\.find\(\(preset\) => preset\.id === editingPreset\.id\)/)
  assert.match(source, /setEditingPreset\(refreshedPreset\)/)
  assert.match(source, /setEditorOpen\(false\)/)
})
