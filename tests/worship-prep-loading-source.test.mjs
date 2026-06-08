import assert from "node:assert/strict"
import { constants } from "node:fs"
import { access, readFile } from "node:fs/promises"
import { test } from "vitest"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("worship prep page renders a stable shell and moves data loading under Suspense", async () => {
  const source = await read("app/(authenticated)/worship-prep/page.tsx")

  assert.match(source, /import \{[^}]*\bSuspense\b[^}]*\} from ["']react["']/)
  assert.match(source, /import \{[^}]*\bcache\b[^}]*\} from ["']react["']/)
  assert.match(source, /function WorshipPrepCardsSkeleton/)
  assert.match(source, /function DisabledWorshipPptxExportButton/)
  assert.match(source, /const getWorshipPrepPageData = cache\(async \(/)
  assert.match(source, /async function WorshipPrepHeaderAction/)
  assert.match(source, /async function WorshipPrepDataPanel/)
  assert.match(source, /export default function WorshipPrepPage/)
  assert.doesNotMatch(source, /export default async function WorshipPrepPage/)
  assert.match(source, /type WorshipPrepSearchParams = Promise<\{ date\?: string \| string\[\] \}>/)
  assert.match(source, /function normalizeDate\(value: string \| string\[\] \| undefined, fallback: string\): string/)
  assert.match(source, /Array\.isArray\(value\)/)
  assert.doesNotMatch(source, /const dataPromise = getWorshipPrepPageData\(searchParams, defaultDate\)/)
  assert.doesNotMatch(source, /const defaultDate = getDefaultWorshipPrepIsoDate\(\)/)
  assert.match(source, /const params = await searchParams;[\s\S]*getDefaultWorshipPrepIsoDate\(\)/)
  assert.match(source, /<WorshipDateSelector \/>/)
  assert.doesNotMatch(source, /<WorshipDateSelector defaultDate=\{defaultDate\} \/>/)
  assert.match(source, /<PrepAutomationPanel \/>/)
  assert.match(source, /<Suspense fallback=\{<DisabledWorshipPptxExportButton \/>\}>/)
  assert.match(source, /<WorshipPrepHeaderAction searchParams=\{searchParams\} \/>/)
  assert.match(source, /<Suspense fallback=\{<WorshipPrepCardsSkeleton \/>\}>/)
  assert.match(source, /<WorshipPrepDataPanel searchParams=\{searchParams\} \/>/)
  assert.match(source, /Array\.from\(\{ length: 6 \}\)/)
  assert.match(source, /data-slot="worship-prep-cards-loading"/)
  assert.match(source, /h-32 rounded-xl/)
  assert.match(source, /<Button disabled>/)
})

test("worship prep route no longer has a route-level full page loading fallback", async () => {
  await assert.rejects(
    access(new URL("../app/(authenticated)/worship-prep/loading.tsx", import.meta.url), constants.F_OK),
    /ENOENT/,
  )
})
