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
