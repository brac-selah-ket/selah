import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('PPTX export service supports an explicit local API URL override', async () => {
  const source = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(
    source,
    /function getPptxApiUrl\(\): string \{[\s\S]+if \(process\.env\.PPTX_API_URL\) \{[\s\S]+return process\.env\.PPTX_API_URL;/,
  );
});

test('PPTX Drive listing falls back to split Google service account variables', async () => {
  const source = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(source, /function parseServiceAccountJson\(rawJson: string\)/);
  assert.match(source, /rawJson\.replace\(/);
  assert.match(source, /function getServiceAccountCredentials\(\): \{ clientEmail: string; privateKey: string \}/);
  assert.match(
    source,
    /parseServiceAccountJson\(rawJson\)/,
  );
  assert.match(source, /process\.env\.GOOGLE_SERVICE_ACCOUNT_EMAIL/);
  assert.match(source, /process\.env\.GOOGLE_PRIVATE_KEY/);
  assert.match(
    source,
    /const \{ clientEmail, privateKey \} = getServiceAccountCredentials\(\)/,
  );
});

test('PPTX export request can carry text overrides', async () => {
  const typesSource = await readFile(new URL('../lib/types.ts', import.meta.url), 'utf8');
  const serviceSource = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(typesSource, /export interface PptxTextOverride/);
  assert.match(typesSource, /text_overrides\?: PptxTextOverride\[\]/);
  assert.match(typesSource, /text_overrides_applied\?: number/);
  assert.match(serviceSource, /textOverrides\?: PptxTextOverride\[\]/);
  assert.match(serviceSource, /body\.text_overrides = options\.textOverrides/);
});

test('PPTX export service supports text inspection', async () => {
  const serviceSource = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');

  assert.match(serviceSource, /PptxTextStructure/);
  assert.match(serviceSource, /export async function sendPptxTextInspectRequest/);
  assert.match(serviceSource, /'X-Action': 'inspect-text'/);
  assert.match(serviceSource, /'X-File-Id': fileId/);
});

test('worship PPT action exposes text inspection and passes overrides', async () => {
  const actionSource = await readFile(new URL('../lib/actions/worship-pptx-export.ts', import.meta.url), 'utf8');

  assert.match(actionSource, /export async function inspectWorshipPptxText/);
  assert.match(actionSource, /sendPptxTextInspectRequest\(allowedFile\.data!\.file_id\)/);
  assert.match(actionSource, /textOverrides\?: PptxTextOverride\[\]/);
  assert.match(actionSource, /textOverrides: options\.textOverrides/);
});
