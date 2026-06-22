import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { verifyStoryboardSnapshots } from './verify.ts';
import type { StoryboardSnapshot } from './types.ts';

const now = '2026-05-28T00:00:00.000Z';

function snapshot(overrides: Partial<StoryboardSnapshot> = {}): StoryboardSnapshot {
  return {
    songs: [
      {
        id: 'song-1',
        name: 'Song One',
        createdAt: now,
        updatedAt: now,
      },
    ],
    sheetMusicFiles: [
      {
        id: 'sheet-1',
        songId: 'song-1',
        fileUrl: 'https://example.com/sheet.pdf',
        fileName: 'sheet.pdf',
        fileType: 'application/pdf',
        sortOrder: 0,
        createdAt: now,
      },
    ],
    songPresets: [
      {
        id: 'preset-1',
        songId: 'song-1',
        presetType: 'single',
        displayTitle: null,
        mashupPairKey: null,
        name: 'Default',
        keys: '["C"]',
        tempos: '[120]',
        sectionOrder: '["verse"]',
        lyrics: '["lyrics"]',
        sectionLyricsMap: '{"0":[0]}',
        notes: null,
        youtubeReference: null,
        youtubeTitle: null,
        pdfMetadata: null,
        isDefault: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    songPresetSongs: [
      {
        id: 'preset-song-1',
        presetId: 'preset-1',
        songId: 'song-1',
        sortOrder: 0,
        partLabel: null,
      },
    ],
    presetSheetMusic: [
      {
        id: 'preset-sheet-1',
        presetId: 'preset-1',
        sheetMusicFileId: 'sheet-1',
        sortOrder: 0,
      },
    ],
    contis: [
      {
        id: 'conti-1',
        title: 'Sunday',
        date: '2026-05-31',
        description: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    contiSongs: [
      {
        id: 'conti-song-1',
        contiId: 'conti-1',
        songId: 'song-1',
        sortOrder: 0,
        keys: '["C"]',
        tempos: '[120]',
        sectionOrder: '["verse"]',
        lyrics: '["lyrics"]',
        sectionLyricsMap: '{"0":[0]}',
        notes: null,
        sheetMusicFileIds: '["sheet-1"]',
        presetId: 'preset-1',
        mashupGroupId: null,
        mashupPartOrder: null,
        preMashupPresetId: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    contiPdfExports: [
      {
        id: 'pdf-1',
        contiId: 'conti-1',
        pdfUrl: null,
        layoutState: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    songPageImages: [
      {
        id: 'page-image-1',
        songId: 'song-1',
        contiId: 'conti-1',
        imageUrl: 'https://example.com/page.png',
        pageIndex: 0,
        sheetMusicFileId: 'sheet-1',
        pdfPageIndex: 0,
        presetSnapshot: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  };
}

describe('verifyStoryboardSnapshots', () => {
  it('passes equal snapshots with no errors', async () => {
    const result = await verifyStoryboardSnapshots(snapshot(), snapshot());

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });

  it('fails when collection counts differ', async () => {
    const result = await verifyStoryboardSnapshots(snapshot(), snapshot({ songs: [] }));

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /songs count mismatch/);
    assert.deepEqual(result.counts.songs, { neon: 1, turso: 0 });
  });

  it('fails when Turso contiSongs reference a missing song', async () => {
    const turso = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          songId: 'missing-song',
        },
      ],
    });

    const result = await verifyStoryboardSnapshots(snapshot(), turso);

    assert.equal(result.ok, false);
    assert.match(
      result.errors.join('\n'),
      /contiSongs conti-song-1 references missing song missing-song/,
    );
  });

  it('fails when Turso contiSongs sheetMusicFileIds reference missing sheet music', async () => {
    const turso = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          sheetMusicFileIds: '["sheet-1","missing-sheet"]',
        },
      ],
    });

    const result = await verifyStoryboardSnapshots(snapshot(), turso);

    assert.equal(result.ok, false);
    assert.match(
      result.errors.join('\n'),
      /contiSongs conti-song-1 references missing sheet music missing-sheet/,
    );
  });

  it('fails when Turso contiSongs sheetMusicFileIds is malformed or not string array JSON', async () => {
    const invalidJson = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          sheetMusicFileIds: 'not-json',
        },
      ],
    });
    const nonArray = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          sheetMusicFileIds: '{"sheet":"sheet-1"}',
        },
      ],
    });
    const nonStringArray = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          sheetMusicFileIds: '["sheet-1",7]',
        },
      ],
    });

    const invalidJsonResult = await verifyStoryboardSnapshots(snapshot(), invalidJson);
    const nonArrayResult = await verifyStoryboardSnapshots(snapshot(), nonArray);
    const nonStringArrayResult = await verifyStoryboardSnapshots(snapshot(), nonStringArray);

    assert.equal(invalidJsonResult.ok, false);
    assert.equal(nonArrayResult.ok, false);
    assert.equal(nonStringArrayResult.ok, false);
    assert.match(
      invalidJsonResult.errors.join('\n'),
      /contiSongs conti-song-1 has invalid sheetMusicFileIds/,
    );
    assert.match(
      nonArrayResult.errors.join('\n'),
      /contiSongs conti-song-1 has invalid sheetMusicFileIds/,
    );
    assert.match(
      nonStringArrayResult.errors.join('\n'),
      /contiSongs conti-song-1 has invalid sheetMusicFileIds/,
    );
  });

  it('fails when songPresetSongs reference a missing preset or song', async () => {
    const base = snapshot({
      songPresetSongs: [
        {
          id: 'preset-song-1',
          presetId: 'missing-preset',
          songId: 'missing-song',
          sortOrder: 0,
          partLabel: null,
        },
      ],
    });

    const result = await verifyStoryboardSnapshots(snapshot(), base);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /songPresetSongs preset-song-1 references missing song preset missing-preset/);
    assert.match(result.errors.join('\n'), /songPresetSongs preset-song-1 references missing song missing-song/);
  });

  it('fails when contiSongs preMashupPresetId references a missing preset', async () => {
    const turso = snapshot({
      contiSongs: [
        {
          ...snapshot().contiSongs[0],
          mashupGroupId: 'group-1',
          mashupPartOrder: 0,
          preMashupPresetId: 'missing-preset',
        },
      ],
    });

    const result = await verifyStoryboardSnapshots(snapshot(), turso);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /contiSongs conti-song-1 references missing pre-mashup song preset missing-preset/);
  });

  it('detects missing, extra, and mismatched Turso rows by id', async () => {
    const neon = snapshot({
      songs: [
        ...snapshot().songs,
        {
          id: 'song-2',
          name: 'Song Two',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const turso = snapshot({
      songs: [
        {
          updatedAt: now,
          createdAt: now,
          name: 'Renamed Song One',
          id: 'song-1',
        },
        {
          id: 'song-extra',
          name: 'Extra Song',
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const result = await verifyStoryboardSnapshots(neon, turso);

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /songs missing in Turso: song-2/);
    assert.match(result.errors.join('\n'), /songs extra in Turso: song-extra/);
    assert.match(result.errors.join('\n'), /songs song-1 mismatch/);
  });
});
