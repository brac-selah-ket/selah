import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

async function loadPptxHelpersModule() {
  const dir = join(tmpdir(), `pptx-helpers-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const compile = async (inputName, outputName) => {
    const source = await readFile(new URL(inputName, import.meta.url), 'utf8');
    const rewrittenSource = source
      .replaceAll('@/lib/utils/arrangement-items', './arrangement-items.mjs')
      .replaceAll('@/lib/utils/mashup-presets', './mashup-presets.mjs');
    const compiled = ts.transpileModule(rewrittenSource, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
    });
    await writeFile(join(dir, outputName), compiled.outputText);
  };

  await mkdir(dir, { recursive: true });
  await compile('./mashup-presets.ts', 'mashup-presets.mjs');
  await compile('./arrangement-items.ts', 'arrangement-items.mjs');
  await compile('./pptx-helpers.ts', 'pptx-helpers.mjs');
  return import(`${pathToFileURL(join(dir, 'pptx-helpers.mjs')).href}?v=${Date.now()}`);
}

function contiSong(
  id,
  songId,
  name,
  sortOrder,
  overrides = {},
  mashup = null,
) {
  const now = new Date('2026-06-22T00:00:00Z');
  return {
    id,
    contiId: 'conti-1',
    songId,
    sortOrder,
    keys: null,
    tempos: null,
    sectionOrder: null,
    lyrics: null,
    sectionLyricsMap: null,
    notes: null,
    sheetMusicFileIds: null,
    presetId: overrides.presetId ?? null,
    mashupGroupId: mashup?.groupId ?? null,
    mashupPartOrder: mashup?.partOrder ?? null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
    song: { id: songId, name, createdAt: now, updatedAt: now },
    overrides: {
      keys: overrides.keys ?? [],
      tempos: overrides.tempos ?? [],
      sectionOrder: overrides.sectionOrder ?? [],
      lyrics: overrides.lyrics ?? [],
      sectionLyricsMap: overrides.sectionLyricsMap ?? {},
      notes: overrides.notes ?? null,
      sheetMusicFileIds: overrides.sheetMusicFileIds ?? null,
      presetId: overrides.presetId ?? null,
    },
    appliedPreset: mashup
      ? {
          id: overrides.presetId ?? 'preset-m',
          name: mashup.presetName ?? 'Mashup',
          displayTitle: mashup.displayTitle ?? null,
          presetType: mashup.presetType ?? 'mashup',
          youtubeReference: null,
          youtubeTitle: null,
        }
      : null,
  };
}

test('buildPptxSongData merges mashup rows by default and uses display title', async () => {
  const { buildPptxSongData } = await loadPptxHelpersModule();

  const result = buildPptxSongData(
    [
      contiSong(
        'cs-1',
        'song-a',
        'A',
        0,
        {
          presetId: 'preset-m',
          sectionOrder: ['Verse', 'Chorus'],
          lyrics: ['A verse', 'A chorus'],
          sectionLyricsMap: { 0: [0], 1: [1] },
        },
        { groupId: 'group-1', partOrder: 0, displayTitle: 'A / B' },
      ),
      contiSong(
        'cs-2',
        'song-b',
        'B',
        1,
        {
          presetId: 'preset-m',
          sectionOrder: ['Bridge'],
          lyrics: ['B bridge'],
          sectionLyricsMap: { 0: [0] },
        },
        { groupId: 'group-1', partOrder: 1, displayTitle: 'A / B' },
      ),
    ],
    '찬양',
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'A / B');
  assert.equal(result[0].section_name, '찬양 1');
  assert.deepEqual(result[0].section_order, ['Verse', 'Chorus']);
  assert.deepEqual(result[0].lyrics, ['A verse', 'A chorus']);
  assert.deepEqual(result[0].section_lyrics_map, { 0: [0], 1: [1] });
});

test('buildPptxSongData can export mashup rows separately', async () => {
  const { buildPptxSongData } = await loadPptxHelpersModule();

  const result = buildPptxSongData(
    [
      contiSong(
        'cs-1',
        'song-a',
        'A',
        0,
        {
          presetId: 'preset-m',
          sectionOrder: ['Verse'],
          lyrics: ['A verse'],
          sectionLyricsMap: { 0: [0] },
        },
        { groupId: 'group-1', partOrder: 0, displayTitle: 'A / B' },
      ),
      contiSong(
        'cs-2',
        'song-b',
        'B',
        1,
        {
          presetId: 'preset-m',
          sectionOrder: ['Bridge'],
          lyrics: ['B bridge'],
          sectionLyricsMap: { 0: [0] },
        },
        { groupId: 'group-1', partOrder: 1, displayTitle: 'A / B' },
      ),
    ],
    '찬양',
    { separateMashups: true },
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'A');
  assert.equal(result[0].section_name, '찬양 1');
  assert.equal(result[1].title, 'B');
  assert.equal(result[1].section_name, '찬양 2');
});

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

test('builds scripture data with optional sermon title fields', async () => {
  const { buildPptxScriptureData } = await loadPptxHelpersModule();

  const result = buildPptxScriptureData(
    '롬 3:20~31',
    [
      {
        title: '롬 3:20-21',
        text: '20 본문\n21 본문',
        verseStart: '3:20',
        verseEnd: '3:21',
      },
    ],
    '봉독 말씀',
    {
      sermonTitle: '모든 사람에게 미치는 하나님의 의',
      sermonTitleSectionName: '말씀 제목',
    },
  );

  assert.equal(result.sermon_title, '모든 사람에게 미치는 하나님의 의');
  assert.equal(result.sermon_title_section_name, '말씀 제목');
});

test('normalizes line breaks in scripture sermon title payload', async () => {
  const { buildPptxScriptureData } = await loadPptxHelpersModule();

  const result = buildPptxScriptureData(
    '롬 3:20~31',
    [],
    '봉독 말씀',
    {
      sermonTitle: '모든 사람에게 미치는\n하나님의 의\r\n',
    },
  );

  assert.equal(result.sermon_title, '모든 사람에게 미치는 하나님의 의');
});

test('finds only explicitly listed pptx files', async () => {
  const { findAllowedPptxFile } = await loadPptxHelpersModule();
  const files = [
    { file_id: 'template-1', name: '260517예배.pptx', modified_time: '' },
    { file_id: 'template-2', name: '260524예배.pptx', modified_time: '' },
  ];

  assert.deepEqual(findAllowedPptxFile(files, 'template-2'), files[1]);
  assert.equal(findAllowedPptxFile(files, 'outside-folder'), null);
});
