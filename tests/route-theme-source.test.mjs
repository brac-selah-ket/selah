import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "vitest"

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8")
}

test("authenticated app shell chooses chapel theme for conti and song routes", async () => {
  const source = await read("components/layout/app-shell.tsx")

  assert.match(source, /usePathname/)
  assert.match(source, /function getSectionThemeClassName\(pathname: string\): string/)
  assert.match(source, /pathname\.startsWith\("\/contis"\)/)
  assert.match(source, /pathname\.startsWith\("\/songs"\)/)
  assert.match(source, /return "theme-chapel"/)
  assert.match(source, /getSectionThemeClassName\(pathname\)/)
})

test("globals define chapel green as a full route primary token set", async () => {
  const source = await read("app/globals.css")

  assert.match(source, /\.theme-chapel\s*\{/)
  assert.match(source, /--primary:\s*#305a53;/)
  assert.match(source, /--primary-foreground:\s*#f8f1de;/)
  assert.match(source, /--sidebar:\s*#305a53;/)
  assert.match(source, /--sidebar-foreground:\s*#f8f1de;/)
  assert.match(source, /--ring:\s*#55776d;/)
  assert.match(source, /\.dark\s+\.theme-chapel\s*\{/)
})
