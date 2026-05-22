import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPaginationModule() {
  const dir = join(tmpdir(), `scripture-pagination-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  for (const name of ['types.ts', 'pagination.ts']) {
    const source = await readFile(new URL(`./${name}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const output = compiled.outputText.replaceAll("from './types';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }
  return import(`${pathToFileURL(join(dir, 'pagination.mjs')).href}?v=${Date.now()}`);
}

const john = { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' };

function verse(chapter, verseNumber, text = `본문 ${verseNumber}`) {
  return { book: john, chapter, verse: verseNumber, text };
}

test('paginates two verses per slide by default', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 16), verse(3, 17), verse(3, 18)]);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].title, '요 3:16-17');
  assert.equal(pages[0].text, '16 본문 16\n17 본문 17');
  assert.equal(pages[0].verseStart, '3:16');
  assert.equal(pages[0].verseEnd, '3:17');
  assert.equal(pages[1].title, '요 3:18');
});

test('supports one verse per slide', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 16), verse(3, 17)], 1);

  assert.deepEqual(pages.map((page) => page.title), ['요 3:16', '요 3:17']);
});

test('formats cross-chapter page labels', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  const pages = paginateScriptureVerses([verse(3, 35), verse(3, 36), verse(4, 1), verse(4, 2)], 3);

  assert.equal(pages[0].title, '요 3:35-4:1');
  assert.equal(pages[1].title, '요 4:2');
});

test('rejects invalid verses per slide values', async () => {
  const { paginateScriptureVerses } = await loadPaginationModule();
  assert.throws(() => paginateScriptureVerses([verse(3, 16)], 0), /1에서 5 사이/);
  assert.throws(() => paginateScriptureVerses([verse(3, 16)], 6), /1에서 5 사이/);
});
