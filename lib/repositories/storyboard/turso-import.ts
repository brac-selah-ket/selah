import { getTursoDb } from '@/lib/db/turso';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPageImages,
  songPresets,
  songs,
} from '@/lib/db/turso-schema';

import type { StoryboardSnapshot } from './types';

export async function importSnapshotToTurso(snapshot: StoryboardSnapshot): Promise<void> {
  const tursoDb = getTursoDb();

  await tursoDb.transaction(async (tx) => {
    await tx.delete(songPageImages);
    await tx.delete(contiPdfExports);
    await tx.delete(presetSheetMusic);
    await tx.delete(contiSongs);
    await tx.delete(songPresets);
    await tx.delete(sheetMusicFiles);
    await tx.delete(contis);
    await tx.delete(songs);

    if (snapshot.songs.length > 0) {
      await tx.insert(songs).values(snapshot.songs);
    }

    if (snapshot.contis.length > 0) {
      await tx.insert(contis).values(snapshot.contis);
    }

    if (snapshot.sheetMusicFiles.length > 0) {
      await tx.insert(sheetMusicFiles).values(snapshot.sheetMusicFiles);
    }

    if (snapshot.songPresets.length > 0) {
      await tx.insert(songPresets).values(snapshot.songPresets);
    }

    if (snapshot.contiSongs.length > 0) {
      await tx.insert(contiSongs).values(snapshot.contiSongs);
    }

    if (snapshot.presetSheetMusic.length > 0) {
      await tx.insert(presetSheetMusic).values(snapshot.presetSheetMusic);
    }

    if (snapshot.contiPdfExports.length > 0) {
      await tx.insert(contiPdfExports).values(snapshot.contiPdfExports);
    }

    if (snapshot.songPageImages.length > 0) {
      await tx.insert(songPageImages).values(snapshot.songPageImages);
    }
  });
}
