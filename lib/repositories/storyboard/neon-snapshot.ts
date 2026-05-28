import { asc } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPageImages,
  songPresets,
  songs,
} from '@/lib/db/schema';
import { dateToDbText } from '@/lib/db/time';

import type { StoryboardSnapshot } from './types';

export async function readNeonSnapshot(): Promise<StoryboardSnapshot> {
  const [
    songRows,
    sheetMusicFileRows,
    songPresetRows,
    presetSheetMusicRows,
    contiRows,
    contiSongRows,
    contiPdfExportRows,
    songPageImageRows,
  ] = await Promise.all([
    db.select().from(songs).orderBy(asc(songs.id)),
    db.select().from(sheetMusicFiles).orderBy(asc(sheetMusicFiles.id)),
    db.select().from(songPresets).orderBy(asc(songPresets.id)),
    db.select().from(presetSheetMusic).orderBy(asc(presetSheetMusic.id)),
    db.select().from(contis).orderBy(asc(contis.id)),
    db.select().from(contiSongs).orderBy(asc(contiSongs.id)),
    db.select().from(contiPdfExports).orderBy(asc(contiPdfExports.id)),
    db.select().from(songPageImages).orderBy(asc(songPageImages.id)),
  ]);

  return {
    songs: songRows.map((song) => ({
      ...song,
      createdAt: dateToDbText(song.createdAt),
      updatedAt: dateToDbText(song.updatedAt),
    })),
    sheetMusicFiles: sheetMusicFileRows.map((file) => ({
      ...file,
      createdAt: dateToDbText(file.createdAt),
    })),
    songPresets: songPresetRows.map((preset) => ({
      ...preset,
      createdAt: dateToDbText(preset.createdAt),
      updatedAt: dateToDbText(preset.updatedAt),
    })),
    presetSheetMusic: presetSheetMusicRows,
    contis: contiRows.map((conti) => ({
      ...conti,
      createdAt: dateToDbText(conti.createdAt),
      updatedAt: dateToDbText(conti.updatedAt),
    })),
    contiSongs: contiSongRows.map((contiSong) => ({
      ...contiSong,
      createdAt: dateToDbText(contiSong.createdAt),
      updatedAt: dateToDbText(contiSong.updatedAt),
    })),
    contiPdfExports: contiPdfExportRows.map((exportRow) => ({
      ...exportRow,
      createdAt: dateToDbText(exportRow.createdAt),
      updatedAt: dateToDbText(exportRow.updatedAt),
    })),
    songPageImages: songPageImageRows.map((image) => ({
      ...image,
      createdAt: dateToDbText(image.createdAt),
      updatedAt: dateToDbText(image.updatedAt),
    })),
  };
}
