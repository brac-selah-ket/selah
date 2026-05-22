import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadReferenceModule() {
  const sources = [
    ['types.ts', ''],
    ['books.ts', await readFile(new URL('./books.ts', import.meta.url), 'utf8')],
    ['reference.ts', await readFile(new URL('./reference.ts', import.meta.url), 'utf8')],
  ];
  const dir = join(tmpdir(), `scripture-reference-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await import('node:fs/promises').then(({ mkdir }) => mkdir(dir, { recursive: true }));
  for (const [name, source] of sources) {
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText
      .replaceAll("from './books';", "from './books.mjs';")
      .replaceAll("from './types';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }
  return import(`${pathToFileURL(join(dir, 'reference.mjs')).href}?v=${Date.now()}`);
}

test('parses abbreviated same-chapter range', async () => {
  const { parseScriptureReference, formatScriptureReference } = await loadReferenceModule();
  const ref = parseScriptureReference('요 3:16~18');

  assert.equal(ref.book.abbreviation, '요');
  assert.equal(ref.book.bskoreaCode, 'jhn');
  assert.equal(ref.start.chapter, 3);
  assert.equal(ref.start.verse, 16);
  assert.equal(ref.end.chapter, 3);
  assert.equal(ref.end.verse, 18);
  assert.equal(formatScriptureReference(ref), '요 3:16~18');
});

test('parses full book name and dash range', async () => {
  const { parseScriptureReference, formatScriptureReference } = await loadReferenceModule();
  const ref = parseScriptureReference('요한복음 3:16-18');

  assert.equal(ref.book.name, '요한복음');
  assert.equal(formatScriptureReference(ref), '요 3:16~18');
});

test('parses single verse', async () => {
  const { parseScriptureReference, formatScriptureReference } = await loadReferenceModule();
  const ref = parseScriptureReference('창1:1');

  assert.equal(ref.book.bskoreaCode, 'gen');
  assert.equal(ref.start.chapter, 1);
  assert.equal(ref.start.verse, 1);
  assert.equal(ref.end.chapter, 1);
  assert.equal(ref.end.verse, 1);
  assert.equal(formatScriptureReference(ref), '창 1:1');
});

test('parses cross-chapter range', async () => {
  const { parseScriptureReference, formatScriptureReference } = await loadReferenceModule();
  const ref = parseScriptureReference('요 3:35~4:2');

  assert.equal(ref.start.chapter, 3);
  assert.equal(ref.start.verse, 35);
  assert.equal(ref.end.chapter, 4);
  assert.equal(ref.end.verse, 2);
  assert.equal(formatScriptureReference(ref), '요 3:35~4:2');
});

test('rejects unknown book names', async () => {
  const { parseScriptureReference } = await loadReferenceModule();
  assert.throws(() => parseScriptureReference('없는책 1:1'), /알 수 없는 성경 권/);
});

test('rejects reversed ranges', async () => {
  const { parseScriptureReference } = await loadReferenceModule();
  assert.throws(() => parseScriptureReference('요 4:2~3:35'), /끝 절이 시작 절보다 앞/);
});
