import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadExportService() {
  const source = await readFile(new URL('../lib/pptx/export-service.ts', import.meta.url), 'utf8');
  const testableSource = source.replace(
    "import { findAllowedPptxFile } from '@/lib/utils/pptx-helpers';",
    'const findAllowedPptxFile = () => null;'
  );
  const transpiled = ts.transpileModule(testableSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

test('sendPptxTextInspectRequest rejects malformed success data', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalApiUrl = process.env.PPTX_API_URL;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
    if (originalApiUrl === undefined) {
      delete process.env.PPTX_API_URL;
    } else {
      process.env.PPTX_API_URL = originalApiUrl;
    }
  });

  process.env.AUTH_SECRET = 'test-secret';
  process.env.PPTX_API_URL = 'http://pptx.test/api';
  globalThis.fetch = async () => ({
    text: async () => JSON.stringify({
      success: true,
      data: { status: 'ok' },
    }),
  });

  const { sendPptxTextInspectRequest } = await loadExportService();
  const result = await sendPptxTextInspectRequest('file-1');

  assert.equal(result.success, false);
  assert.equal(result.error, 'PPT 텍스트 응답 형식이 올바르지 않습니다');
});
