import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadProviderModule() {
  const dir = join(tmpdir(), `scripture-provider-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
  await symlink(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'), 'dir');
  for (const name of ['types.ts', 'provider.ts']) {
    const source = await readFile(new URL(`./${name}`, import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    const output = compiled.outputText.replaceAll("from './types';", "from './types.mjs';");
    await writeFile(join(dir, name.replace('.ts', '.mjs')), output);
  }
  return import(`${pathToFileURL(join(dir, 'provider.mjs')).href}?v=${Date.now()}`);
}

const john = { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' };

const fixture = `
  <html><body>
    <div class="leftCont">
      <span><span class="number">16&nbsp;&nbsp;&nbsp;</span>하나님이 세상을 이처럼 사랑하사 <font size="2">1)</font> 독생자를 주셨으니</span><br />
      <div id="D_1" class="D2">또는 설명</div>
      <span><span class="number">17&nbsp;&nbsp;&nbsp;</span>하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요</span>
    </div>
  </body></html>
`;

test('extracts verse text from bskorea html', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  const verses = parseBskoreaChapterHtml(fixture, john, 3);

  assert.equal(verses.length, 2);
  assert.deepEqual(verses[0], {
    book: john,
    chapter: 3,
    verse: 16,
    text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니',
  });
});

test('throws when no verses are found', async () => {
  const { parseBskoreaChapterHtml } = await loadProviderModule();
  assert.throws(() => parseBskoreaChapterHtml('<html></html>', john, 3), /본문을 찾지 못했습니다/);
});
