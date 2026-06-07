import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("package and root metadata use the selah product name", async () => {
  const pkg = JSON.parse(await read("package.json"))
  const layout = await read("app/layout.tsx")

  assert.equal(pkg.name, "selah")
  assert.match(layout, /applicationName:\s*"\(selah\)"/)
  assert.match(layout, /title:\s*"\(selah\)"/)
  assert.match(layout, /description:\s*"예배 준비를 한 흐름으로 맞추는 워크스페이스"/)
  assert.match(layout, /icons:\s*\{\s*icon:\s*"\/icon\.svg"\s*\}/)
})

test("visible app chrome no longer uses Storyboard copy", async () => {
  const sidebar = await read("components/layout/sidebar.tsx")
  const readme = await read("README.md")
  const designSystem = await read("docs/design-system.md")

  assert.doesNotMatch(sidebar, /Storyboard/)
  assert.match(sidebar, /worship preparation workspace/)
  assert.match(readme, /# \(selah\)/)
  assert.match(readme, /예배 준비를 한 흐름으로 맞추는 예배 준비 워크스페이스/)
  assert.doesNotMatch(designSystem, /Storyboard may remain/)
})

test("environment examples avoid hard-coded storyboard service names", async () => {
  const envExample = await read(".env.example")
  const envLocalExample = await read(".env.local.example")

  assert.match(envExample, /APP_BASE_URL=https:\/\/your-app-domain\.example/)
  assert.doesNotMatch(envExample, /storyboard-eta\.vercel\.app/)
  assert.doesNotMatch(envExample, /R2_BUCKET_NAME=storyboard-assets/)
  assert.match(envExample, /R2_BUCKET_NAME=your-r2-bucket-name/)
  assert.match(envLocalExample, /APP_BASE_URL=https:\/\/your-app-domain\.example/)
})

test("selah icon is svg based and the default favicon file is removed", async () => {
  const icon = await read("app/icon.svg")

  assert.equal(existsSync(new URL("../app/favicon.ico", import.meta.url)), false)
  assert.match(icon, /<svg/)
  assert.match(icon, /#5a3c31/)
  assert.match(icon, /#f5edcf/)
  assert.match(icon, />\(s\)</)
})
