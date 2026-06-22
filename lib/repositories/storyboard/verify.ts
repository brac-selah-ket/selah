import type {
  SnapshotCollectionName,
  SnapshotCounts,
  StoryboardSnapshot,
  VerificationResult,
} from './types';

const snapshotCollections = [
  'songs',
  'sheetMusicFiles',
  'songPresets',
  'songPresetSongs',
  'presetSheetMusic',
  'contis',
  'contiSongs',
  'contiPdfExports',
  'songPageImages',
] as const satisfies readonly SnapshotCollectionName[];

type SnapshotRow = StoryboardSnapshot[SnapshotCollectionName][number];

export async function verifyStoryboardSnapshots(
  neon: StoryboardSnapshot,
  turso: StoryboardSnapshot,
): Promise<VerificationResult> {
  const errors: string[] = [];
  const counts = createCounts(neon, turso, errors);

  for (const collection of snapshotCollections) {
    compareRows(collection, neon[collection], turso[collection], errors);
  }

  verifyTursoRelationships(turso, errors);

  return {
    ok: errors.length === 0,
    counts,
    errors,
  };
}

function createCounts(
  neon: StoryboardSnapshot,
  turso: StoryboardSnapshot,
  errors: string[],
): SnapshotCounts {
  const counts = {} as SnapshotCounts;

  for (const collection of snapshotCollections) {
    const neonCount = neon[collection].length;
    const tursoCount = turso[collection].length;

    counts[collection] = {
      neon: neonCount,
      turso: tursoCount,
    };

    if (neonCount !== tursoCount) {
      errors.push(`${collection} count mismatch: Neon has ${neonCount}, Turso has ${tursoCount}`);
    }
  }

  return counts;
}

function compareRows(
  collection: SnapshotCollectionName,
  neonRows: readonly SnapshotRow[],
  tursoRows: readonly SnapshotRow[],
  errors: string[],
) {
  const neonById = indexById(neonRows);
  const tursoById = indexById(tursoRows);
  const missingIds = [...neonById.keys()].filter((id) => !tursoById.has(id)).sort();
  const extraIds = [...tursoById.keys()].filter((id) => !neonById.has(id)).sort();

  if (missingIds.length > 0) {
    errors.push(`${collection} missing in Turso: ${missingIds.join(', ')}`);
  }

  if (extraIds.length > 0) {
    errors.push(`${collection} extra in Turso: ${extraIds.join(', ')}`);
  }

  for (const [id, neonRow] of neonById) {
    const tursoRow = tursoById.get(id);

    if (!tursoRow) {
      continue;
    }

    if (stableStringify(neonRow) !== stableStringify(tursoRow)) {
      errors.push(`${collection} ${id} mismatch`);
    }
  }
}

function indexById(rows: readonly SnapshotRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function verifyTursoRelationships(turso: StoryboardSnapshot, errors: string[]) {
  const songIds = new Set(turso.songs.map((song) => song.id));
  const sheetMusicFileIds = new Set(turso.sheetMusicFiles.map((file) => file.id));
  const songPresetIds = new Set(turso.songPresets.map((preset) => preset.id));
  const contiIds = new Set(turso.contis.map((conti) => conti.id));

  for (const file of turso.sheetMusicFiles) {
    verifyReference(errors, 'sheetMusicFiles', file.id, 'song', file.songId, songIds);
  }

  for (const preset of turso.songPresets) {
    verifyReference(errors, 'songPresets', preset.id, 'song', preset.songId, songIds);
  }

  for (const presetSong of turso.songPresetSongs) {
    verifyReference(
      errors,
      'songPresetSongs',
      presetSong.id,
      'song preset',
      presetSong.presetId,
      songPresetIds,
    );
    verifyReference(errors, 'songPresetSongs', presetSong.id, 'song', presetSong.songId, songIds);
  }

  for (const presetFile of turso.presetSheetMusic) {
    verifyReference(
      errors,
      'presetSheetMusic',
      presetFile.id,
      'song preset',
      presetFile.presetId,
      songPresetIds,
    );
    verifyReference(
      errors,
      'presetSheetMusic',
      presetFile.id,
      'sheet music file',
      presetFile.sheetMusicFileId,
      sheetMusicFileIds,
    );
  }

  for (const contiSong of turso.contiSongs) {
    verifyReference(errors, 'contiSongs', contiSong.id, 'conti', contiSong.contiId, contiIds);
    verifyReference(errors, 'contiSongs', contiSong.id, 'song', contiSong.songId, songIds);

    if (contiSong.presetId !== null) {
      verifyReference(
        errors,
        'contiSongs',
        contiSong.id,
        'song preset',
        contiSong.presetId,
        songPresetIds,
      );
    }

    if (contiSong.preMashupPresetId !== null) {
      verifyReference(
        errors,
        'contiSongs',
        contiSong.id,
        'pre-mashup song preset',
        contiSong.preMashupPresetId,
        songPresetIds,
      );
    }

    if (contiSong.sheetMusicFileIds !== null) {
      verifyContiSongSheetMusicFileIds(
        errors,
        contiSong.id,
        contiSong.sheetMusicFileIds,
        sheetMusicFileIds,
      );
    }
  }

  for (const pdfExport of turso.contiPdfExports) {
    verifyReference(errors, 'contiPdfExports', pdfExport.id, 'conti', pdfExport.contiId, contiIds);
  }

  for (const pageImage of turso.songPageImages) {
    verifyReference(errors, 'songPageImages', pageImage.id, 'song', pageImage.songId, songIds);
    verifyReference(errors, 'songPageImages', pageImage.id, 'conti', pageImage.contiId, contiIds);

    if (pageImage.sheetMusicFileId !== null) {
      verifyReference(
        errors,
        'songPageImages',
        pageImage.id,
        'sheet music file',
        pageImage.sheetMusicFileId,
        sheetMusicFileIds,
      );
    }
  }
}

function verifyContiSongSheetMusicFileIds(
  errors: string[],
  contiSongId: string,
  sheetMusicFileIdsJson: string,
  validSheetMusicFileIds: ReadonlySet<string>,
) {
  let sheetMusicFileIds: unknown;

  try {
    sheetMusicFileIds = JSON.parse(sheetMusicFileIdsJson);
  } catch {
    errors.push(`contiSongs ${contiSongId} has invalid sheetMusicFileIds`);
    return;
  }

  if (
    !Array.isArray(sheetMusicFileIds) ||
    sheetMusicFileIds.some((sheetMusicFileId) => typeof sheetMusicFileId !== 'string')
  ) {
    errors.push(`contiSongs ${contiSongId} has invalid sheetMusicFileIds`);
    return;
  }

  for (const sheetMusicFileId of sheetMusicFileIds) {
    if (!validSheetMusicFileIds.has(sheetMusicFileId)) {
      errors.push(
        `contiSongs ${contiSongId} references missing sheet music ${sheetMusicFileId}`,
      );
    }
  }
}

function verifyReference(
  errors: string[],
  collection: string,
  rowId: string,
  referencedName: string,
  referencedId: string,
  validIds: ReadonlySet<string>,
) {
  if (!validIds.has(referencedId)) {
    errors.push(`${collection} ${rowId} references missing ${referencedName} ${referencedId}`);
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
  }

  return value;
}
