import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPptxHelpersModule() {
  const source = await readFile(new URL('./pptx-helpers.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `pptx-helpers-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'pptx-helpers.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'pptx-helpers.mjs')).href}?v=${Date.now()}`);
}

test('builds scripture data with snake_case verse bounds', async () => {
  const { buildPptxScriptureData } = await loadPptxHelpersModule();

  const result = buildPptxScriptureData(
    '요 3:16~18',
    [
      {
        title: '요 3:16-17',
        text: '16 하나님이 세상을 이처럼 사랑하사\n17 하나님이 그 아들을 보내신 것은',
        verseStart: '3:16',
        verseEnd: '3:17',
      },
      {
        title: '요 3:18',
        text: '18 그를 믿는 자는 심판을 받지 아니하는 것이요',
        verseStart: '3:18',
        verseEnd: '3:18',
      },
    ],
    '말씀',
  );

  assert.deepEqual(result, {
    section_name: '말씀',
    reference: '요 3:16~18',
    pages: [
      {
        title: '요 3:16-17',
        text: '16 하나님이 세상을 이처럼 사랑하사\n17 하나님이 그 아들을 보내신 것은',
        verse_start: '3:16',
        verse_end: '3:17',
      },
      {
        title: '요 3:18',
        text: '18 그를 믿는 자는 심판을 받지 아니하는 것이요',
        verse_start: '3:18',
        verse_end: '3:18',
      },
    ],
  });
});
