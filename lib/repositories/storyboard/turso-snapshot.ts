import { asc } from 'drizzle-orm';

import { getTursoDb } from '@/lib/db/turso';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPageImages,
  songPresetSongs,
  songPresets,
  songs,
} from '@/lib/db/turso-schema';

import type { StoryboardSnapshot } from './types';

export async function readTursoSnapshot(): Promise<StoryboardSnapshot> {
  const tursoDb = getTursoDb();

  const [
    songRows,
    sheetMusicFileRows,
    songPresetRows,
    songPresetSongRows,
    presetSheetMusicRows,
    contiRows,
    contiSongRows,
    contiPdfExportRows,
    songPageImageRows,
  ] = await Promise.all([
    tursoDb.select().from(songs).orderBy(asc(songs.id)),
    tursoDb.select().from(sheetMusicFiles).orderBy(asc(sheetMusicFiles.id)),
    tursoDb.select().from(songPresets).orderBy(asc(songPresets.id)),
    tursoDb.select().from(songPresetSongs).orderBy(asc(songPresetSongs.id)),
    tursoDb.select().from(presetSheetMusic).orderBy(asc(presetSheetMusic.id)),
    tursoDb.select().from(contis).orderBy(asc(contis.id)),
    tursoDb.select().from(contiSongs).orderBy(asc(contiSongs.id)),
    tursoDb.select().from(contiPdfExports).orderBy(asc(contiPdfExports.id)),
    tursoDb.select().from(songPageImages).orderBy(asc(songPageImages.id)),
  ]);

  return {
    songs: songRows,
    sheetMusicFiles: sheetMusicFileRows,
    songPresets: songPresetRows,
    songPresetSongs: songPresetSongRows,
    presetSheetMusic: presetSheetMusicRows,
    contis: contiRows,
    contiSongs: contiSongRows,
    contiPdfExports: contiPdfExportRows,
    songPageImages: songPageImageRows,
  };
}
