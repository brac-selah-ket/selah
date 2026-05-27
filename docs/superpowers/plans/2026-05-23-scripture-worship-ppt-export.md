# Scripture Worship PPT Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a worship-prep PPT export flow that inserts the selected week's scripture passage and selected conti songs into one PowerPoint file.

**Architecture:** Add a small scripture domain layer for reference parsing, non-official bskorea HTML fetching, and verse pagination. Extend the existing PPTX export payload and Python processor with an optional `scripture` object, then add a worship-prep dialog that combines scripture settings, conti selection, Drive file selection, and save mode.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript server actions, node:test with TypeScript transpilation, Python `python-pptx`, Google Drive API, Vercel Blob, `cheerio` for server-side HTML parsing.

---

## Scope Check

This is one implementation plan. The feature touches parser/provider logic, the existing PPT export API, and worship-prep UI, but all pieces are required to deliver one testable workflow: export scripture plus conti songs into one PPTX file from the worship-prep tab.

## File Structure

- Create `lib/scripture/types.ts`: shared scripture parser/provider/page types.
- Create `lib/scripture/books.ts`: Korean book aliases plus bskorea book codes.
- Create `lib/scripture/reference.ts`: parse and normalize scripture references.
- Create `lib/scripture/pagination.ts`: split ordered verses into slide pages.
- Create `lib/scripture/provider.ts`: fetch and parse bskorea legacy chapter HTML.
- Create `lib/scripture/reference.test.mjs`: node:test coverage for reference parsing.
- Create `lib/scripture/pagination.test.mjs`: node:test coverage for pagination.
- Create `lib/scripture/provider.test.mjs`: node:test coverage for HTML parsing with inline fixture.
- Modify `lib/types.ts`: add scripture PPTX request/result types.
- Modify `lib/utils/pptx-helpers.ts`: add scripture payload builder and keep song payload behavior unchanged.
- Create `lib/actions/worship-pptx-export.ts`: preview scripture slide count and export combined worship PPT.
- Modify `lib/actions/pptx-export.ts`: accept optional scripture payload.
- Modify `api/pptx.py`: process optional scripture section before songs and isolate song base slide selection to song sections.
- Create `components/worship-prep/worship-pptx-export-button.tsx`: combined export dialog.
- Modify `app/(authenticated)/worship-prep/page.tsx`: fetch conti list and render the new button.
- Modify `.env.example` and `.env.local.example`: document scripture section env vars.
- Modify `package.json` / `pnpm-lock.yaml`: add `cheerio`.

## Commands

Use these commands throughout implementation:

```bash
pnpm add cheerio
node lib/scripture/reference.test.mjs
node lib/scripture/pagination.test.mjs
node lib/scripture/provider.test.mjs
python -m py_compile api/pptx.py
pnpm lint
pnpm build
```

---

### Task 1: Add Scripture Reference Parser

**Files:**
- Create: `lib/scripture/types.ts`
- Create: `lib/scripture/books.ts`
- Create: `lib/scripture/reference.ts`
- Create: `lib/scripture/reference.test.mjs`

- [ ] **Step 1: Install parser dependency**

Run:

```bash
pnpm add cheerio
```

Expected: `package.json` and `pnpm-lock.yaml` update with `cheerio`.

- [ ] **Step 2: Write the failing reference parser tests**

Create `lib/scripture/reference.test.mjs`:

```js
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
```

- [ ] **Step 3: Run reference tests and verify they fail**

Run:

```bash
node lib/scripture/reference.test.mjs
```

Expected: FAIL because `books.ts` and `reference.ts` do not exist yet.

- [ ] **Step 4: Create scripture shared types**

Create `lib/scripture/types.ts`:

```ts
export interface ScriptureBook {
  name: string;
  abbreviation: string;
  bskoreaCode: string;
  order: number;
}

export interface ScripturePoint {
  chapter: number;
  verse: number;
}

export interface ScriptureReference {
  book: ScriptureBook;
  start: ScripturePoint;
  end: ScripturePoint;
}

export interface ScriptureVerse {
  book: ScriptureBook;
  chapter: number;
  verse: number;
  text: string;
}

export interface ScriptureSlidePage {
  title: string;
  text: string;
  verseStart: string;
  verseEnd: string;
}
```

- [ ] **Step 5: Create scripture book mapping**

Create `lib/scripture/books.ts`:

```ts
import type { ScriptureBook } from './types';

export const SCRIPTURE_BOOKS: ScriptureBook[] = [
  { order: 1, name: '창세기', abbreviation: '창', bskoreaCode: 'gen' },
  { order: 2, name: '출애굽기', abbreviation: '출', bskoreaCode: 'exo' },
  { order: 3, name: '레위기', abbreviation: '레', bskoreaCode: 'lev' },
  { order: 4, name: '민수기', abbreviation: '민', bskoreaCode: 'num' },
  { order: 5, name: '신명기', abbreviation: '신', bskoreaCode: 'deu' },
  { order: 6, name: '여호수아', abbreviation: '수', bskoreaCode: 'jos' },
  { order: 7, name: '사사기', abbreviation: '삿', bskoreaCode: 'jdg' },
  { order: 8, name: '룻기', abbreviation: '룻', bskoreaCode: 'rut' },
  { order: 9, name: '사무엘상', abbreviation: '삼상', bskoreaCode: '1sa' },
  { order: 10, name: '사무엘하', abbreviation: '삼하', bskoreaCode: '2sa' },
  { order: 11, name: '열왕기상', abbreviation: '왕상', bskoreaCode: '1ki' },
  { order: 12, name: '열왕기하', abbreviation: '왕하', bskoreaCode: '2ki' },
  { order: 13, name: '역대상', abbreviation: '대상', bskoreaCode: '1ch' },
  { order: 14, name: '역대하', abbreviation: '대하', bskoreaCode: '2ch' },
  { order: 15, name: '에스라', abbreviation: '스', bskoreaCode: 'ezr' },
  { order: 16, name: '느헤미야', abbreviation: '느', bskoreaCode: 'neh' },
  { order: 17, name: '에스더', abbreviation: '에', bskoreaCode: 'est' },
  { order: 18, name: '욥기', abbreviation: '욥', bskoreaCode: 'job' },
  { order: 19, name: '시편', abbreviation: '시', bskoreaCode: 'psa' },
  { order: 20, name: '잠언', abbreviation: '잠', bskoreaCode: 'pro' },
  { order: 21, name: '전도서', abbreviation: '전', bskoreaCode: 'ecc' },
  { order: 22, name: '아가', abbreviation: '아', bskoreaCode: 'sng' },
  { order: 23, name: '이사야', abbreviation: '사', bskoreaCode: 'isa' },
  { order: 24, name: '예레미야', abbreviation: '렘', bskoreaCode: 'jer' },
  { order: 25, name: '예레미야애가', abbreviation: '애', bskoreaCode: 'lam' },
  { order: 26, name: '에스겔', abbreviation: '겔', bskoreaCode: 'ezk' },
  { order: 27, name: '다니엘', abbreviation: '단', bskoreaCode: 'dan' },
  { order: 28, name: '호세아', abbreviation: '호', bskoreaCode: 'hos' },
  { order: 29, name: '요엘', abbreviation: '욜', bskoreaCode: 'jol' },
  { order: 30, name: '아모스', abbreviation: '암', bskoreaCode: 'amo' },
  { order: 31, name: '오바댜', abbreviation: '옵', bskoreaCode: 'oba' },
  { order: 32, name: '요나', abbreviation: '욘', bskoreaCode: 'jon' },
  { order: 33, name: '미가', abbreviation: '미', bskoreaCode: 'mic' },
  { order: 34, name: '나훔', abbreviation: '나', bskoreaCode: 'nam' },
  { order: 35, name: '하박국', abbreviation: '합', bskoreaCode: 'hab' },
  { order: 36, name: '스바냐', abbreviation: '습', bskoreaCode: 'zep' },
  { order: 37, name: '학개', abbreviation: '학', bskoreaCode: 'hag' },
  { order: 38, name: '스가랴', abbreviation: '슥', bskoreaCode: 'zec' },
  { order: 39, name: '말라기', abbreviation: '말', bskoreaCode: 'mal' },
  { order: 40, name: '마태복음', abbreviation: '마', bskoreaCode: 'mat' },
  { order: 41, name: '마가복음', abbreviation: '막', bskoreaCode: 'mrk' },
  { order: 42, name: '누가복음', abbreviation: '눅', bskoreaCode: 'luk' },
  { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' },
  { order: 44, name: '사도행전', abbreviation: '행', bskoreaCode: 'act' },
  { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' },
  { order: 46, name: '고린도전서', abbreviation: '고전', bskoreaCode: '1co' },
  { order: 47, name: '고린도후서', abbreviation: '고후', bskoreaCode: '2co' },
  { order: 48, name: '갈라디아서', abbreviation: '갈', bskoreaCode: 'gal' },
  { order: 49, name: '에베소서', abbreviation: '엡', bskoreaCode: 'eph' },
  { order: 50, name: '빌립보서', abbreviation: '빌', bskoreaCode: 'php' },
  { order: 51, name: '골로새서', abbreviation: '골', bskoreaCode: 'col' },
  { order: 52, name: '데살로니가전서', abbreviation: '살전', bskoreaCode: '1th' },
  { order: 53, name: '데살로니가후서', abbreviation: '살후', bskoreaCode: '2th' },
  { order: 54, name: '디모데전서', abbreviation: '딤전', bskoreaCode: '1ti' },
  { order: 55, name: '디모데후서', abbreviation: '딤후', bskoreaCode: '2ti' },
  { order: 56, name: '디도서', abbreviation: '딛', bskoreaCode: 'tit' },
  { order: 57, name: '빌레몬서', abbreviation: '몬', bskoreaCode: 'phm' },
  { order: 58, name: '히브리서', abbreviation: '히', bskoreaCode: 'heb' },
  { order: 59, name: '야고보서', abbreviation: '약', bskoreaCode: 'jas' },
  { order: 60, name: '베드로전서', abbreviation: '벧전', bskoreaCode: '1pe' },
  { order: 61, name: '베드로후서', abbreviation: '벧후', bskoreaCode: '2pe' },
  { order: 62, name: '요한일서', abbreviation: '요일', bskoreaCode: '1jn' },
  { order: 63, name: '요한이서', abbreviation: '요이', bskoreaCode: '2jn' },
  { order: 64, name: '요한삼서', abbreviation: '요삼', bskoreaCode: '3jn' },
  { order: 65, name: '유다서', abbreviation: '유', bskoreaCode: 'jud' },
  { order: 66, name: '요한계시록', abbreviation: '계', bskoreaCode: 'rev' },
];

const EXTRA_ALIASES: Record<string, string> = {
  예레미야애가: '애',
  예레미야애가서: '애',
  예레미야애: '애',
  애가: '애',
  요한1서: '요일',
  요한2서: '요이',
  요한3서: '요삼',
};

const BOOK_BY_ALIAS = new Map<string, ScriptureBook>();

for (const book of SCRIPTURE_BOOKS) {
  BOOK_BY_ALIAS.set(book.name, book);
  BOOK_BY_ALIAS.set(book.abbreviation, book);
  BOOK_BY_ALIAS.set(book.name.replace(/서$/, ''), book);
}

for (const [alias, abbreviation] of Object.entries(EXTRA_ALIASES)) {
  const book = SCRIPTURE_BOOKS.find((candidate) => candidate.abbreviation === abbreviation);
  if (book) BOOK_BY_ALIAS.set(alias, book);
}

export function findScriptureBook(rawBook: string): ScriptureBook | null {
  const normalized = rawBook.replace(/\s+/g, '').trim();
  return BOOK_BY_ALIAS.get(normalized) ?? null;
}
```

- [ ] **Step 6: Create reference parser implementation**

Create `lib/scripture/reference.ts`:

```ts
import { findScriptureBook } from './books';
import type { ScripturePoint, ScriptureReference } from './types';

function splitBookAndRange(input: string): { book: string; range: string } {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  const withSpace = trimmed.match(/^(.+?)\s+(\d+.*)$/);
  if (withSpace) return { book: withSpace[1], range: withSpace[2] };

  const withoutSpace = trimmed.match(/^([가-힣0-9]+?)(\d+\s*:\s*\d+.*)$/);
  if (withoutSpace) return { book: withoutSpace[1], range: withoutSpace[2] };

  throw new Error('성경 본문 형식이 올바르지 않습니다. 예: 요 3:16~18');
}

function parsePoint(value: string): ScripturePoint {
  const match = value.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) {
    throw new Error('장절 형식이 올바르지 않습니다. 예: 요 3:16');
  }
  return {
    chapter: Number.parseInt(match[1], 10),
    verse: Number.parseInt(match[2], 10),
  };
}

function comparePoints(a: ScripturePoint, b: ScripturePoint): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

function parseRange(range: string): { start: ScripturePoint; end: ScripturePoint } {
  const normalized = range.replace(/[-–—]/g, '~');
  const [startRaw, endRaw] = normalized.split('~').map((part) => part.trim());
  const start = parsePoint(startRaw);

  if (!endRaw) return { start, end: { ...start } };

  const end = endRaw.includes(':')
    ? parsePoint(endRaw)
    : { chapter: start.chapter, verse: Number.parseInt(endRaw, 10) };

  if (!Number.isFinite(end.verse)) {
    throw new Error('끝 절 형식이 올바르지 않습니다. 예: 요 3:16~18');
  }

  if (comparePoints(start, end) > 0) {
    throw new Error('끝 절이 시작 절보다 앞에 있습니다.');
  }

  return { start, end };
}

export function parseScriptureReference(input: string): ScriptureReference {
  const { book: rawBook, range } = splitBookAndRange(input);
  const book = findScriptureBook(rawBook);
  if (!book) {
    throw new Error(`알 수 없는 성경 권입니다: ${rawBook}`);
  }

  const { start, end } = parseRange(range);
  return { book, start, end };
}

function formatPoint(point: ScripturePoint): string {
  return `${point.chapter}:${point.verse}`;
}

export function formatScriptureReference(reference: ScriptureReference): string {
  const { book, start, end } = reference;
  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${book.abbreviation} ${formatPoint(start)}`;
  }
  if (start.chapter === end.chapter) {
    return `${book.abbreviation} ${formatPoint(start)}~${end.verse}`;
  }
  return `${book.abbreviation} ${formatPoint(start)}~${formatPoint(end)}`;
}

export function formatVerseLabel(reference: ScriptureReference, point: ScripturePoint): string {
  return `${reference.book.abbreviation} ${formatPoint(point)}`;
}
```

- [ ] **Step 7: Run reference tests and verify they pass**

Run:

```bash
node lib/scripture/reference.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit parser work**

Run:

```bash
git add package.json pnpm-lock.yaml lib/scripture/types.ts lib/scripture/books.ts lib/scripture/reference.ts lib/scripture/reference.test.mjs
git commit -m "feat: add scripture reference parser"
```

Expected: commit succeeds.

---

### Task 2: Add Scripture Provider And Pagination

**Files:**
- Create: `lib/scripture/pagination.ts`
- Create: `lib/scripture/provider.ts`
- Create: `lib/scripture/pagination.test.mjs`
- Create: `lib/scripture/provider.test.mjs`

- [ ] **Step 1: Write failing pagination tests**

Create `lib/scripture/pagination.test.mjs`:

```js
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
  const pages = paginateScriptureVerses([verse(3, 16), verse(3, 17), verse(3, 18)], 2);

  assert.equal(pages.length, 2);
  assert.equal(pages[0].title, '요 3:16-17');
  assert.equal(pages[0].text, '16 본문 16\n17 본문 17');
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
```

- [ ] **Step 2: Write failing provider parser tests**

Create `lib/scripture/provider.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadProviderModule() {
  const dir = join(tmpdir(), `scripture-provider-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });
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
```

- [ ] **Step 3: Run provider and pagination tests and verify they fail**

Run:

```bash
node lib/scripture/pagination.test.mjs
node lib/scripture/provider.test.mjs
```

Expected: FAIL because `pagination.ts` and `provider.ts` do not exist yet.

- [ ] **Step 4: Create pagination implementation**

Create `lib/scripture/pagination.ts`:

```ts
import type { ScriptureSlidePage, ScriptureVerse } from './types';

function pointLabel(verse: ScriptureVerse): string {
  return `${verse.chapter}:${verse.verse}`;
}

function pageTitle(start: ScriptureVerse, end: ScriptureVerse): string {
  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${start.book.abbreviation} ${pointLabel(start)}`;
  }
  if (start.chapter === end.chapter) {
    return `${start.book.abbreviation} ${pointLabel(start)}-${end.verse}`;
  }
  return `${start.book.abbreviation} ${pointLabel(start)}-${pointLabel(end)}`;
}

export function paginateScriptureVerses(
  verses: ScriptureVerse[],
  versesPerSlide = 2,
): ScriptureSlidePage[] {
  if (!Number.isInteger(versesPerSlide) || versesPerSlide < 1 || versesPerSlide > 5) {
    throw new Error('절/슬라이드 값은 1에서 5 사이여야 합니다.');
  }

  const pages: ScriptureSlidePage[] = [];
  for (let index = 0; index < verses.length; index += versesPerSlide) {
    const chunk = verses.slice(index, index + versesPerSlide);
    const start = chunk[0];
    const end = chunk[chunk.length - 1];
    pages.push({
      title: pageTitle(start, end),
      text: chunk.map((verse) => `${verse.verse} ${verse.text}`.trim()).join('\n'),
      verseStart: pointLabel(start),
      verseEnd: pointLabel(end),
    });
  }
  return pages;
}
```

- [ ] **Step 5: Create provider implementation**

Create `lib/scripture/provider.ts`:

```ts
import * as cheerio from 'cheerio';
import type { ScriptureBook, ScriptureReference, ScriptureVerse } from './types';

const BSKOREA_LEGACY_URL = 'https://www.bskorea.or.kr/bible/korbibReadpage.php';

function cleanVerseText(value: string): string {
  return value
    .replace(/\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBskoreaChapterHtml(
  html: string,
  book: ScriptureBook,
  chapter: number,
): ScriptureVerse[] {
  const $ = cheerio.load(html);
  const verses: ScriptureVerse[] = [];
  const seen = new Set<number>();

  $('.leftCont span').each((_, element) => {
    const text = $(element).text().replace(/\u00a0/g, ' ').trim();
    const match = text.match(/^(\d+)\s+(.+)$/s);
    if (!match) return;

    const verse = Number.parseInt(match[1], 10);
    if (!Number.isFinite(verse) || seen.has(verse)) return;

    const verseText = cleanVerseText(match[2]);
    if (!verseText) return;

    seen.add(verse);
    verses.push({ book, chapter, verse, text: verseText });
  });

  if (verses.length === 0) {
    throw new Error(`${book.abbreviation} ${chapter}장에서 본문을 찾지 못했습니다.`);
  }

  return verses.sort((a, b) => a.verse - b.verse);
}

async function fetchChapterHtml(book: ScriptureBook, chapter: number): Promise<string> {
  const url = new URL(BSKOREA_LEGACY_URL);
  url.searchParams.set('version', 'GAE');
  url.searchParams.set('book', book.bskoreaCode);
  url.searchParams.set('chap', String(chapter));

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'storyboard-worship-ppt-export/1.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`성경 본문 조회 실패 (${response.status})`);
  }

  return response.text();
}

function chaptersInReference(reference: ScriptureReference): number[] {
  const chapters: number[] = [];
  for (let chapter = reference.start.chapter; chapter <= reference.end.chapter; chapter += 1) {
    chapters.push(chapter);
  }
  return chapters;
}

export async function fetchScriptureVerses(reference: ScriptureReference): Promise<ScriptureVerse[]> {
  const chapterCache = new Map<number, ScriptureVerse[]>();
  const allVerses: ScriptureVerse[] = [];

  for (const chapter of chaptersInReference(reference)) {
    let chapterVerses = chapterCache.get(chapter);
    if (!chapterVerses) {
      const html = await fetchChapterHtml(reference.book, chapter);
      chapterVerses = parseBskoreaChapterHtml(html, reference.book, chapter);
      chapterCache.set(chapter, chapterVerses);
    }

    const filtered = chapterVerses.filter((verse) => {
      if (verse.chapter === reference.start.chapter && verse.verse < reference.start.verse) return false;
      if (verse.chapter === reference.end.chapter && verse.verse > reference.end.verse) return false;
      return true;
    });
    allVerses.push(...filtered);
  }

  if (allVerses.length === 0) {
    throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
  }

  const first = allVerses[0];
  const last = allVerses[allVerses.length - 1];
  if (first.chapter !== reference.start.chapter || first.verse !== reference.start.verse) {
    throw new Error(`시작 절을 찾지 못했습니다: ${reference.book.abbreviation} ${reference.start.chapter}:${reference.start.verse}`);
  }
  if (last.chapter !== reference.end.chapter || last.verse !== reference.end.verse) {
    throw new Error(`끝 절을 찾지 못했습니다: ${reference.book.abbreviation} ${reference.end.chapter}:${reference.end.verse}`);
  }

  return allVerses;
}
```

- [ ] **Step 6: Run provider and pagination tests and verify they pass**

Run:

```bash
node lib/scripture/pagination.test.mjs
node lib/scripture/provider.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit provider and pagination work**

Run:

```bash
git add lib/scripture/pagination.ts lib/scripture/provider.ts lib/scripture/pagination.test.mjs lib/scripture/provider.test.mjs
git commit -m "feat: fetch and paginate scripture text"
```

Expected: commit succeeds.

---

### Task 3: Extend PPTX Export Types And Server Actions

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/utils/pptx-helpers.ts`
- Modify: `lib/actions/pptx-export.ts`
- Create: `lib/actions/worship-pptx-export.ts`

- [ ] **Step 1: Extend PPTX types**

In `lib/types.ts`, add these interfaces after `PptxExportSongData` and extend request/result types:

```ts
export interface PptxExportScripturePage {
  title: string;
  text: string;
  verse_start: string;
  verse_end: string;
}

export interface PptxExportScriptureData {
  section_name: string;
  reference: string;
  pages: PptxExportScripturePage[];
}
```

Update `PptxExportRequest`:

```ts
export interface PptxExportRequest {
  action: 'export_lyrics';
  file_id: string;
  overwrite: boolean;
  output_file_name?: string;
  output_folder_id?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
}
```

Update `PptxExportResult`:

```ts
export interface PptxExportResult {
  file_id: string;
  file_name: string;
  web_view_link: string;
  download_url?: string;
  songs_processed: number;
  slides_generated: number;
  scripture_pages_generated?: number;
}
```

- [ ] **Step 2: Add scripture payload helper**

Modify `lib/utils/pptx-helpers.ts` to import `PptxExportScriptureData` and `ScriptureSlidePage`, then add:

```ts
import type {
  ContiSongWithSong,
  PptxExportScriptureData,
  PptxExportSongData,
} from '@/lib/types';
import type { ScriptureSlidePage } from '@/lib/scripture/types';
```

Keep the existing `buildPptxSongData` implementation unchanged, then add:

```ts
export function buildPptxScriptureData(options: {
  sectionName: string;
  reference: string;
  pages: ScriptureSlidePage[];
}): PptxExportScriptureData {
  return {
    section_name: options.sectionName,
    reference: options.reference,
    pages: options.pages.map((page) => ({
      title: page.title,
      text: page.text,
      verse_start: page.verseStart,
      verse_end: page.verseEnd,
    })),
  };
}
```

- [ ] **Step 3: Extend existing export action options**

Modify `exportContiToPptx` in `lib/actions/pptx-export.ts` so its options include scripture:

```ts
import type {
  ActionResult,
  PptxDriveFile,
  PptxExportResult,
  PptxExportScriptureData,
  PptxExportSongData,
  PptxTemplateStructure,
} from '@/lib/types';
```

```ts
export async function exportContiToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
```

Add `scripture: options.scripture,` to the JSON body:

```ts
body: JSON.stringify({
  action: 'export_lyrics',
  file_id: options.fileId,
  overwrite: options.overwrite,
  output_file_name: options.outputFileName,
  output_folder_id: options.outputFolderId,
  songs: options.songs,
  scripture: options.scripture,
}),
```

- [ ] **Step 4: Create worship PPTX export action**

Create `lib/actions/worship-pptx-export.ts`:

```ts
'use server';

import { getConti } from '@/lib/queries/contis';
import { parseScriptureReference, formatScriptureReference } from '@/lib/scripture/reference';
import { fetchScriptureVerses } from '@/lib/scripture/provider';
import { paginateScriptureVerses } from '@/lib/scripture/pagination';
import { buildPptxScriptureData, buildPptxSongData } from '@/lib/utils/pptx-helpers';
import { exportContiToPptx } from '@/lib/actions/pptx-export';
import type {
  ActionResult,
  PptxExportResult,
  PptxExportScriptureData,
} from '@/lib/types';

const SONG_SECTION_PREFIX = process.env.PPTX_SECTION_PREFIX || process.env.NEXT_PUBLIC_PPTX_SECTION_PREFIX || '찬양';
const SCRIPTURE_SECTION_NAME = process.env.PPTX_SCRIPTURE_SECTION_NAME || '봉독 말씀';

function normalizeVersesPerSlide(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error('절/슬라이드 값은 1에서 5 사이여야 합니다.');
  }
  return value;
}

async function buildScriptureData(
  scriptureReference: string,
  versesPerSlide: number,
): Promise<PptxExportScriptureData> {
  const parsed = parseScriptureReference(scriptureReference);
  const normalizedReference = formatScriptureReference(parsed);
  const verses = await fetchScriptureVerses(parsed);
  const pages = paginateScriptureVerses(verses, normalizeVersesPerSlide(versesPerSlide));

  return buildPptxScriptureData({
    sectionName: SCRIPTURE_SECTION_NAME,
    reference: normalizedReference,
    pages,
  });
}

export async function previewWorshipScripturePptx(options: {
  scriptureReference: string;
  versesPerSlide: number;
}): Promise<ActionResult<{ scripture: PptxExportScriptureData; slideCount: number }>> {
  try {
    const scripture = await buildScriptureData(options.scriptureReference, options.versesPerSlide);
    return {
      success: true,
      data: {
        scripture,
        slideCount: scripture.pages.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '말씀 본문을 가져오지 못했습니다',
    };
  }
}

export async function exportWorshipToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  contiId: string;
  scriptureReference: string;
  versesPerSlide: number;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const conti = await getConti(options.contiId);
    if (!conti) {
      return { success: false, error: '선택한 콘티를 찾을 수 없습니다' };
    }

    const songs = buildPptxSongData(conti.songs, SONG_SECTION_PREFIX);
    if (songs.length === 0) {
      return { success: false, error: 'PPT로 내보낼 찬양 섹션이 없습니다' };
    }

    const scripture = await buildScriptureData(options.scriptureReference, options.versesPerSlide);

    return exportContiToPptx({
      fileId: options.fileId,
      overwrite: options.overwrite,
      outputFileName: options.overwrite ? undefined : options.outputFileName,
      songs,
      scripture,
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '예배 PPT 내보내기 중 오류가 발생했습니다',
    };
  }
}
```

- [ ] **Step 5: Run TypeScript validation**

Run:

```bash
pnpm lint
```

Expected: PASS. If this command fails, stop and correct the reported errors in the files changed by this task before continuing.

- [ ] **Step 6: Commit action/type work**

Run:

```bash
git add lib/types.ts lib/utils/pptx-helpers.ts lib/actions/pptx-export.ts lib/actions/worship-pptx-export.ts
git commit -m "feat: prepare worship pptx export payload"
```

Expected: commit succeeds.

---

### Task 4: Extend Python PPTX Processor For Scripture Sections

**Files:**
- Modify: `api/pptx.py`

- [ ] **Step 1: Update song base slide selection**

In `api/pptx.py`, modify `process_all_songs` to choose the shared base slide only from sections requested by the song payload:

```python
def process_all_songs(prs, songs):
    """Process all songs in the presentation."""
    sections = parse_sections(prs)
    slide_id_map = get_slide_id_map(prs)
    requested_section_names = {
        song.get('section_name', '')
        for song in songs
        if song.get('section_name', '')
    }
    candidate_sections = [
        section
        for section in sections
        if section['name'] in requested_section_names
    ]

    # Find shared base slide from requested song sections only.
    shared_base_slide_id = None
    for section in candidate_sections:
        if len(section['slide_ids']) >= 2:
            candidate_id = section['slide_ids'][1]
            candidate_slide = slide_id_map[candidate_id]['slide']
            textbox = get_first_textbox(candidate_slide)
            if textbox is not None and textbox.text_frame.text.strip():
                shared_base_slide_id = candidate_id
                break

    if shared_base_slide_id is None:
        for section in candidate_sections:
            if len(section['slide_ids']) >= 2:
                shared_base_slide_id = section['slide_ids'][1]
                break

    if shared_base_slide_id is None:
        raise ValueError("No requested song section has a base slide (slide_ids[1])")

    total_slides = 0
    songs_processed = 0

    for song in songs:
        section_name = song.get('section_name', '')
        if not section_name:
            raise ValueError(f"Song '{song.get('title', '?')}' has no section_name")

        section = find_section_by_name(sections, section_name)
        if section is None:
            available = [s['name'] for s in sections]
            raise ValueError(
                f"Section '{section_name}' not found in template. "
                f"Available sections: {available}"
            )

        slides = process_song_section(prs, song, section, slide_id_map, shared_base_slide_id)
        total_slides += slides
        songs_processed += 1

        slide_id_map = get_slide_id_map(prs)

    delete_slide_by_id(prs, shared_base_slide_id)

    return {
        'songs_processed': songs_processed,
        'slides_generated': total_slides,
    }
```

- [ ] **Step 2: Add scripture section processor**

Add these functions before `process_all_songs`:

```python
def process_scripture_section(prs, scripture):
    """Inject scripture pages into a configured scripture section."""
    section_name = scripture.get('section_name', '')
    reference = scripture.get('reference', '')
    pages = scripture.get('pages', [])

    if not section_name:
        raise ValueError("scripture.section_name is required")
    if not reference:
        raise ValueError("scripture.reference is required")
    if not pages:
        raise ValueError("scripture.pages must contain at least one page")

    sections = parse_sections(prs)
    slide_id_map = get_slide_id_map(prs)
    section = find_section_by_name(sections, section_name)
    if section is None:
        available = [s['name'] for s in sections]
        raise ValueError(
            f"Scripture section '{section_name}' not found in template. "
            f"Available sections: {available}"
        )

    slide_ids = section['slide_ids']
    if len(slide_ids) < 2:
        raise ValueError(
            f"Scripture section '{section_name}' needs at least 2 slides "
            f"(title + base), but has {len(slide_ids)}"
        )

    title_slide_id = slide_ids[0]
    body_base_slide_id = slide_ids[1]
    title_slide = slide_id_map[title_slide_id]['slide']
    title_shape = get_first_textbox(title_slide)
    if title_shape:
        inject_text_into_shape(title_shape, reference)

    base_slide = slide_id_map[body_base_slide_id]['slide']
    for sid in slide_ids[2:]:
        delete_slide_by_id(prs, sid)

    generated_slide_ids = []
    last_slide_id = body_base_slide_id

    for idx, page in enumerate(pages, 1):
        text = page.get('text', '')
        title = page.get('title') or f"{reference}-{idx}"
        new_slide, new_sid, _ = duplicate_slide(prs, base_slide)
        textbox = get_first_textbox(new_slide)
        if textbox:
            inject_text_into_shape(textbox, text)
        set_morph_transition(new_slide)
        set_slide_notes(new_slide, title)
        move_slide_id_after(prs, new_sid, last_slide_id)
        generated_slide_ids.append(new_sid)
        last_slide_id = new_sid

    delete_slide_by_id(prs, body_base_slide_id)

    section_el = section['element']
    ns_fn = section.get('ns_fn', _pn)
    sld_id_lst = section_el.find(ns_fn('sldIdLst'))

    for child in list(sld_id_lst):
        sld_id_lst.remove(child)

    title_entry = etree.SubElement(sld_id_lst, ns_fn('sldId'))
    title_entry.set('id', str(title_slide_id))

    for gen_sid in generated_slide_ids:
        entry = etree.SubElement(sld_id_lst, ns_fn('sldId'))
        entry.set('id', str(gen_sid))

    return {
        'scripture_pages_generated': len(generated_slide_ids),
    }
```

- [ ] **Step 3: Modify export handler to accept optional scripture**

In `_handle_export_lyrics`, change:

```python
songs = body.get('songs', [])
```

to:

```python
songs = body.get('songs', [])
scripture = body.get('scripture')
```

Change the no-songs guard:

```python
if not songs:
    self.send_json(400, {"success": False, "error": "No songs provided"})
    return
```

to:

```python
if not songs and not scripture:
    self.send_json(400, {"success": False, "error": "No songs or scripture provided"})
    return
```

Change the processing block:

```python
prs = Presentation(template_path)
result_stats = process_all_songs(prs, songs)
prs.save(output_path)
```

to:

```python
prs = Presentation(template_path)
scripture_stats = {'scripture_pages_generated': 0}
if scripture:
    scripture_stats = process_scripture_section(prs, scripture)
result_stats = process_all_songs(prs, songs) if songs else {
    'songs_processed': 0,
    'slides_generated': 0,
}
result_stats.update(scripture_stats)
prs.save(output_path)
```

In both success JSON responses, add:

```python
"scripture_pages_generated": result_stats.get('scripture_pages_generated', 0),
```

- [ ] **Step 4: Compile Python**

Run:

```bash
python -m py_compile api/pptx.py
```

Expected: no output and exit code 0.

- [ ] **Step 5: Commit Python processor work**

Run:

```bash
git add api/pptx.py
git commit -m "feat: insert scripture into pptx export"
```

Expected: commit succeeds.

---

### Task 5: Add Worship Prep Export UI

**Files:**
- Create: `components/worship-prep/worship-pptx-export-button.tsx`
- Modify: `app/(authenticated)/worship-prep/page.tsx`

- [ ] **Step 1: Create combined export button component**

Create `components/worship-prep/worship-pptx-export-button.tsx`:

```tsx
"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  Loading03Icon,
  Presentation01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { listPptxFiles } from "@/lib/actions/pptx-export"
import {
  exportWorshipToPptx,
  previewWorshipScripturePptx,
} from "@/lib/actions/worship-pptx-export"
import type { Conti, PptxDriveFile } from "@/lib/types"

type Step = "file-list" | "worship-data" | "mode-select" | "confirm"
const SCRIPTURE_SECTION_NAME = process.env.NEXT_PUBLIC_PPTX_SCRIPTURE_SECTION_NAME || "봉독 말씀"

interface WorshipPptxExportButtonProps {
  scripture: string | null
  selectedDate: string
  initialContiId: string | null
  contis: Conti[]
}

export function WorshipPptxExportButton({
  scripture,
  selectedDate,
  initialContiId,
  contis,
}: WorshipPptxExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("file-list")
  const [files, setFiles] = useState<PptxDriveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<PptxDriveFile | null>(null)
  const [scriptureReference, setScriptureReference] = useState(scripture ?? "")
  const [contiId, setContiId] = useState(initialContiId ?? "")
  const [versesPerSlide, setVersesPerSlide] = useState(2)
  const [overwrite, setOverwrite] = useState(true)
  const [outputFileName, setOutputFileName] = useState("")
  const [scriptureSlideCount, setScriptureSlideCount] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedConti = useMemo(
    () => contis.find((conti) => conti.id === contiId) ?? null,
    [contis, contiId],
  )

  function resetDialog() {
    setStep("file-list")
    setFiles([])
    setFilesError(null)
    setSelectedFile(null)
    setScriptureReference(scripture ?? "")
    setContiId(initialContiId ?? "")
    setVersesPerSlide(2)
    setOverwrite(true)
    setOutputFileName("")
    setScriptureSlideCount(null)
  }

  function loadFilesIfNeeded() {
    if (files.length > 0 || filesLoading || filesError) return
    setFilesLoading(true)
    listPptxFiles().then((result) => {
      if (result.success && result.data) {
        setFiles(result.data.files)
      } else {
        setFilesError(result.error ?? "파일 목록을 가져오지 못했습니다")
      }
      setFilesLoading(false)
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      loadFilesIfNeeded()
      return
    }
    resetDialog()
  }

  function handleSelectFile(file: PptxDriveFile) {
    setSelectedFile(file)
    setOutputFileName(file.name)
    setStep("worship-data")
  }

  function handleWorshipDataConfirm() {
    if (!scriptureReference.trim()) {
      toast.error("말씀 본문을 입력해주세요")
      return
    }
    if (!contiId) {
      toast.error("콘티를 선택해주세요")
      return
    }
    setStep("mode-select")
  }

  function handleModeConfirm() {
    if (!overwrite && !outputFileName.trim()) {
      toast.error("파일명을 입력해주세요")
      return
    }

    startTransition(async () => {
      const result = await previewWorshipScripturePptx({
        scriptureReference: scriptureReference.trim(),
        versesPerSlide,
      })
      if (!result.success || !result.data) {
        toast.error(result.error ?? "말씀 본문을 가져오지 못했습니다")
        return
      }
      setScriptureSlideCount(result.data.slideCount)
      setStep("confirm")
    })
  }

  function handleBack() {
    if (step === "worship-data") setStep("file-list")
    if (step === "mode-select") setStep("worship-data")
    if (step === "confirm") setStep("mode-select")
  }

  function handleExport() {
    if (!selectedFile || !contiId) return

    startTransition(async () => {
      const result = await exportWorshipToPptx({
        fileId: selectedFile.file_id,
        overwrite,
        outputFileName: overwrite ? undefined : outputFileName.trim(),
        contiId,
        scriptureReference: scriptureReference.trim(),
        versesPerSlide,
      })

      if (!result.success || !result.data) {
        toast.error(result.error ?? "예배 PPT 내보내기에 실패했습니다")
        return
      }

      handleOpenChange(false)

      if (result.data.download_url) {
        const a = document.createElement("a")
        a.href = result.data.download_url
        a.download = result.data.file_name || "worship.pptx"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success("예배 PPT 다운로드를 시작했습니다")
        return
      }

      toast.success("예배 PPT 내보내기 완료", {
        description: `${result.data.file_name} (${result.data.slides_generated} 찬양 슬라이드, ${result.data.scripture_pages_generated ?? 0} 말씀 슬라이드)`,
        action: result.data.web_view_link
          ? {
              label: "Google Drive에서 열기",
              onClick: () => window.open(result.data!.web_view_link, "_blank"),
            }
          : undefined,
      })
    })
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)} disabled={contis.length === 0}>
        <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} data-icon="inline-start" />
        예배 PPT 내보내기
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] grid-rows-[auto_1fr_auto]">
          <DialogHeader>
            <DialogTitle>
              {step === "file-list" && "PPT 파일 선택"}
              {step === "worship-data" && "예배 데이터 선택"}
              {step === "mode-select" && "내보내기 방식"}
              {step === "confirm" && "내보내기 확인"}
            </DialogTitle>
            <DialogDescription>
              {step === "file-list" && "Google Drive에서 수정할 .pptx 파일을 선택하세요."}
              {step === "worship-data" && `${selectedDate} 예배의 말씀과 콘티를 확인하세요.`}
              {step === "mode-select" && "선택한 파일을 덮어쓰거나 새 파일로 저장할 수 있습니다."}
              {step === "confirm" && "아래 내용을 확인한 후 내보내기를 시작하세요."}
            </DialogDescription>
          </DialogHeader>

          {step === "file-list" && (
            <div className="flex flex-col gap-2 overflow-y-auto min-h-0">
              {filesLoading && <p className="py-4 text-center text-sm text-muted-foreground">파일 목록을 불러오는 중...</p>}
              {filesError && <p className="py-4 text-center text-sm text-destructive">{filesError}</p>}
              {!filesLoading && !filesError && files.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">.pptx 파일이 없습니다</p>
              )}
              {!filesLoading && files.map((file) => (
                <button
                  key={file.file_id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-foreground/30"
                >
                  <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    {file.modified_time && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.modified_time).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "worship-data" && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scripture-reference">말씀 본문</Label>
                <Input
                  id="scripture-reference"
                  value={scriptureReference}
                  onChange={(event) => setScriptureReference(event.target.value)}
                  placeholder="요 3:16~18"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>콘티</Label>
                <Select value={contiId} onValueChange={setContiId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="콘티 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {contis.map((conti) => (
                      <SelectItem key={conti.id} value={conti.id}>
                        {conti.title || `${conti.date} 콘티`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="verses-per-slide">절/슬라이드</Label>
                <Input
                  id="verses-per-slide"
                  type="number"
                  min={1}
                  max={5}
                  value={versesPerSlide}
                  onChange={(event) => setVersesPerSlide(Number(event.target.value))}
                />
              </div>
            </div>
          )}

          {step === "mode-select" && selectedFile && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">선택한 파일</p>
                <p className="text-sm font-medium">{selectedFile.name}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setOverwrite(true)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${overwrite ? "border-primary bg-primary/5" : "hover:border-foreground/30"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">덮어쓰기</p>
                    <p className="text-xs text-muted-foreground">Google Drive 파일을 직접 수정합니다</p>
                  </div>
                  {overwrite && <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setOverwrite(false)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${!overwrite ? "border-primary bg-primary/5" : "hover:border-foreground/30"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">새 파일</p>
                    <p className="text-xs text-muted-foreground">파일을 다운로드합니다</p>
                  </div>
                  {!overwrite && <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />}
                </button>
              </div>
              {!overwrite && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="output-name">파일명</Label>
                  <Input id="output-name" value={outputFileName} onChange={(event) => setOutputFileName(event.target.value)} />
                </div>
              )}
            </div>
          )}

          {step === "confirm" && selectedFile && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">파일</span>
                  <span className="font-medium text-right">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">말씀</span>
                  <span className="font-medium text-right">{scriptureReference}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">말씀 섹션</span>
                  <span className="font-medium">{SCRIPTURE_SECTION_NAME}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">말씀 슬라이드</span>
                  <span className="font-medium">{scriptureSlideCount ?? "-"}장</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">절/슬라이드</span>
                  <span className="font-medium">{versesPerSlide}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">콘티</span>
                  <span className="font-medium text-right">{selectedConti?.title || selectedConti?.date || "-"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">방식</span>
                  <span className="font-medium">{overwrite ? "덮어쓰기" : `새 파일: ${outputFileName}`}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {step !== "file-list" && (
              <Button variant="outline" onClick={handleBack} disabled={isPending}>
                <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} data-icon="inline-start" />
                뒤로
              </Button>
            )}
            {step === "file-list" && <Button variant="outline" onClick={() => handleOpenChange(false)}>취소</Button>}
            {step === "worship-data" && <Button onClick={handleWorshipDataConfirm}>다음</Button>}
            {step === "mode-select" && (
              <Button onClick={handleModeConfirm} disabled={isPending}>
                {isPending && <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />}
                {isPending ? "말씀 확인 중..." : "다음"}
              </Button>
            )}
            {step === "confirm" && (
              <Button onClick={handleExport} disabled={isPending}>
                {isPending && <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />}
                {isPending ? "내보내는 중..." : "내보내기"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Render button on worship-prep page**

Modify `app/(authenticated)/worship-prep/page.tsx` imports:

```ts
import { PageHeader } from '@/components/layout/page-header';
import { PrepAutomationPanel } from '@/components/worship-prep/prep-automation-panel';
import { PrepElementCards } from '@/components/worship-prep/prep-element-cards';
import { WorshipPptxExportButton } from '@/components/worship-prep/worship-pptx-export-button';
import { getWorshipPrepDetail } from '@/lib/queries/worship-prep';
import { Button } from '@/components/ui/button';
import { getContiByDate, getContis } from '@/lib/queries/contis';
```

Modify the data load:

```ts
const [item, conti, contis] = await Promise.all([
  getWorshipPrepDetail(selectedDate),
  getContiByDate(selectedDate),
  getContis(),
]);
```

Modify the `PageHeader`:

```tsx
<PageHeader title='예배 준비' description='가장 가까운 일요일 1주차를 기본으로 조회합니다'>
  {item && (
    <WorshipPptxExportButton
      scripture={item.scripture}
      selectedDate={selectedDate}
      initialContiId={conti?.id ?? null}
      contis={contis}
    />
  )}
</PageHeader>
```

- [ ] **Step 3: Run lint and build**

Run:

```bash
pnpm lint
pnpm build
```

Expected: PASS. If either command fails, stop and correct the reported errors in the files changed by this task before continuing.

- [ ] **Step 4: Commit UI work**

Run:

```bash
git add components/worship-prep/worship-pptx-export-button.tsx 'app/(authenticated)/worship-prep/page.tsx'
git commit -m "feat: add worship pptx export dialog"
```

Expected: commit succeeds.

---

### Task 6: Document Env Vars And Run Full Verification

**Files:**
- Modify: `.env.example`
- Modify: `.env.local.example`

- [ ] **Step 1: Add env var documentation**

Add these lines near the existing PPTX env vars in both `.env.example` and `.env.local.example`:

```bash
PPTX_SCRIPTURE_SECTION_NAME=봉독 말씀
NEXT_PUBLIC_PPTX_SCRIPTURE_SECTION_NAME=봉독 말씀
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
node lib/scripture/reference.test.mjs
node lib/scripture/pagination.test.mjs
node lib/scripture/provider.test.mjs
python -m py_compile api/pptx.py
```

Expected: all commands pass.

- [ ] **Step 3: Run app validation**

Run:

```bash
pnpm lint
pnpm build
```

Expected: both commands pass.

- [ ] **Step 4: Commit docs and validation finish**

Run:

```bash
git add .env.example .env.local.example
git commit -m "docs: add scripture pptx env vars"
```

Expected: commit succeeds.

---

## Manual QA

After implementation, verify the workflow with a real template:

1. The PPT template has a section named `봉독 말씀` with a title slide and body base slide.
2. The PPT template still has the existing `찬양 1`, `찬양 2`, etc. sections.
3. Open `/worship-prep?date=YYYY-MM-DD` for a row with a Sheets scripture value and matching conti.
4. Click `예배 PPT 내보내기`.
5. Select a PPTX file.
6. Confirm the scripture field defaults to the Sheets value.
7. Set `절/슬라이드` to `2`.
8. Confirm the slide count matches the fetched passage length.
9. Export as a downloaded file first.
10. Open the file and confirm:
    - The `봉독 말씀` section title slide contains the normalized reference.
    - The body slides contain the fetched New Korean Revised Version text.
    - The songs are still inserted into `찬양 N` sections.
11. Repeat with overwrite mode only after the downloaded-file path works.

## Implementation Notes

- Keep the legacy bskorea parser isolated to `lib/scripture/provider.ts`.
- Do not store fetched scripture text in Postgres.
- Do not remove or rename the existing conti detail `PPT 내보내기` button.
- Do not use Radix `asChild`; this app uses Base UI `render` where needed.
- Use `<HugeiconsIcon icon={IconName} strokeWidth={2} />` for icons.
