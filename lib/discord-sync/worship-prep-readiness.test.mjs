import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadReadiness() {
  const source = await readFile(new URL('./worship-prep-readiness.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const outputPath = join(tmpdir(), `worship-prep-readiness-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  await writeFile(outputPath, compiled.outputText);
  return import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
}

const completeRow = {
  date: '2026-06-07',
  preacher: '설교자',
  leader: '인도자',
  worshipLeader: '찬양 인도자',
  title: '설교 제목',
  scripture: '요 3:16',
  songs: ['찬양 1'],
};

test('detects readiness only when sheet fields and conti are complete', async () => {
  const { isWorshipPrepReady } = await loadReadiness();

  assert.equal(isWorshipPrepReady({ row: completeRow, hasLinkedConti: true }), true);
  assert.equal(isWorshipPrepReady({ row: { ...completeRow, title: null }, hasLinkedConti: true }), false);
  assert.equal(isWorshipPrepReady({ row: { ...completeRow, songs: [] }, hasLinkedConti: true }), false);
  assert.equal(isWorshipPrepReady({ row: completeRow, hasLinkedConti: false }), false);
});

test('converts between yymmdd and iso dates', async () => {
  const { toIsoDateFromYYMMDD, toYYMMDDFromIsoDate } = await loadReadiness();

  assert.equal(toIsoDateFromYYMMDD('260607'), '2026-06-07');
  assert.equal(toYYMMDDFromIsoDate('2026-06-07'), '260607');
  assert.throws(() => toIsoDateFromYYMMDD('2026-06-07'), /YYMMDD/);
  assert.throws(() => toIsoDateFromYYMMDD('260230'), /valid calendar date/);
  assert.throws(() => toYYMMDDFromIsoDate('260607'), /YYYY-MM-DD/);
  assert.throws(() => toYYMMDDFromIsoDate('2026-02-30'), /valid calendar date/);
  assert.throws(() => toYYMMDDFromIsoDate('2026-13-01'), /valid calendar date/);
});

test('builds worship prep URL and ready message', async () => {
  const { buildWorshipPrepUrl, buildWorshipPrepReadyMessage } = await loadReadiness();

  const url = buildWorshipPrepUrl('https://storyboard.example.com/', '2026-06-07');
  assert.equal(url, 'https://storyboard.example.com/worship-prep?date=2026-06-07');
  assert.equal(
    buildWorshipPrepReadyMessage(url),
    '광고 외에 PPT 작성 준비가 완료되었습니다. https://storyboard.example.com/worship-prep?date=2026-06-07 에서 작업해주세요.',
  );
});
