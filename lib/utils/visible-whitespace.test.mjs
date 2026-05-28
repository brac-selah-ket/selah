import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadVisibleWhitespaceModule() {
  const source = await readFile(new URL('./visible-whitespace.ts', import.meta.url), 'utf8');
  const dir = join(tmpdir(), `visible-whitespace-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  await writeFile(join(dir, 'visible-whitespace.mjs'), compiled.outputText);
  return import(`${pathToFileURL(join(dir, 'visible-whitespace.mjs')).href}?v=${Date.now()}`);
}

test('renders spaces tabs and newlines as visible markers', async () => {
  const { toVisibleWhitespaceText } = await loadVisibleWhitespaceModule();

  assert.equal(toVisibleWhitespaceText('대표 기도\t김소망\n다같이'), '대표·기도→김소망↵\n다같이');
});

test('leaves ordinary text unchanged while marking only whitespace', async () => {
  const { toVisibleWhitespaceText } = await loadVisibleWhitespaceModule();

  assert.equal(toVisibleWhitespaceText('광고 1'), '광고·1');
  assert.equal(toVisibleWhitespaceText(''), '');
});
