import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPptxTextOverridesModule() {
  const source = await readFile(new URL('./pptx-text-overrides.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `pptx-text-overrides-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'pptx-text-overrides.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'pptx-text-overrides.mjs')).href}?v=${Date.now()}`);
}

const structure = {
  file_id: 'ppt-1',
  sections: [
    {
      name: '봉독 말씀',
      slide_ids: [101],
      slides: [
        {
          slide_id: 101,
          slide_index: 0,
          section_name: '봉독 말씀',
          title: '봉독 말씀 1p',
          shapes: [
            { shape_id: '4', shape_name: 'TextBox 4', text: '요 3:16', left: 0, top: 0, width: 10, height: 10 },
          ],
        },
      ],
    },
    {
      name: '기도 봉헌 광고',
      slide_ids: [201],
      slides: [
        {
          slide_id: 201,
          slide_index: 1,
          section_name: '기도 봉헌 광고',
          title: '대표기도',
          shapes: [
            { shape_id: '7', shape_name: 'TextBox 7', text: '대표기도', left: 0, top: 0, width: 10, height: 10 },
          ],
        },
      ],
    },
  ],
};

test('chooses prayer offering announcement as the default section when present', async () => {
  const { getDefaultPptxTextSectionName } = await loadPptxTextOverridesModule();

  assert.equal(getDefaultPptxTextSectionName(structure), '기도 봉헌 광고');
});

test('builds text drafts and emits only changed overrides', async () => {
  const {
    buildInitialPptxTextDrafts,
    buildPptxTextOverrides,
    makePptxTextOverrideKey,
  } = await loadPptxTextOverridesModule();

  const drafts = buildInitialPptxTextDrafts(structure);
  drafts[makePptxTextOverrideKey(201, '7')] = '대표기도\n김소망 집사';

  assert.deepEqual(buildPptxTextOverrides(structure, drafts), [
    {
      slide_id: 201,
      shape_id: '7',
      text: '대표기도\n김소망 집사',
    },
  ]);
});
