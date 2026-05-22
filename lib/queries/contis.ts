import { db } from '@/lib/db';
import { contis, contiSongs, songs, sheetMusicFiles, contiPdfExports, songPresets } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { parseContiSongOverrides, parsePresetPdfMetadata } from '@/lib/db/helpers';
import type {
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  ContiPdfExport,
  PresetPdfMetadata,
  ContiWithSongSummaries,
} from '@/lib/types';

export async function getContis() {
  return await db.select().from(contis).orderBy(desc(contis.date));
}

export async function getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
  const contiRows = await getContis();
  if (contiRows.length === 0) return [];

  const contiIds = contiRows.map((conti) => conti.id);

  const rows = await db
    .select({
      contiSong: contiSongs,
      songName: songs.name,
      presetName: songPresets.name,
      youtubeReference: songPresets.youtubeReference,
      youtubeTitle: songPresets.youtubeTitle,
    })
    .from(contiSongs)
    .leftJoin(songs, eq(contiSongs.songId, songs.id))
    .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
    .where(inArray(contiSongs.contiId, contiIds))
    .orderBy(contiSongs.sortOrder);

  const byContiId = new Map<string, ContiWithSongSummaries["songSummaries"]>();

  for (const row of rows) {
    const parsed = parseContiSongOverrides({
      keys: row.contiSong.keys,
      tempos: row.contiSong.tempos,
      sectionOrder: row.contiSong.sectionOrder,
      lyrics: row.contiSong.lyrics,
      sectionLyricsMap: row.contiSong.sectionLyricsMap,
      notes: row.contiSong.notes,
      sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
      presetId: row.contiSong.presetId,
    });

    const summaries = byContiId.get(row.contiSong.contiId) ?? [];
    summaries.push({
      id: row.contiSong.id,
      songId: row.contiSong.songId,
      sortOrder: row.contiSong.sortOrder,
      songName: row.songName ?? "알 수 없는 곡",
      keys: parsed.keys,
      tempos: parsed.tempos,
      sectionOrder: parsed.sectionOrder,
      presetId: parsed.presetId,
      presetName: row.presetName ?? null,
      youtubeReference: row.youtubeReference ?? null,
      youtubeTitle: row.youtubeTitle ?? null,
      hasSheetMusicSelection: parsed.sheetMusicFileIds !== null && parsed.sheetMusicFileIds.length > 0,
    });
    byContiId.set(row.contiSong.contiId, summaries);
  }

  return contiRows.map((conti) => {
    const songSummaries = byContiId.get(conti.id) ?? [];
    return {
      ...conti,
      songSummaries,
      songCount: songSummaries.length,
    };
  });
}

export async function getContiByDate(date: string) {
  const result = await db.select().from(contis).where(eq(contis.date, date)).limit(1);
  return result[0] ?? null;
}

export async function getConti(id: string): Promise<ContiWithSongs | null> {
  const conti = await db.select().from(contis).where(eq(contis.id, id)).limit(1);

  if (conti.length === 0) {
    return null;
  }

  const contiSongsData = await db
    .select()
    .from(contiSongs)
    .leftJoin(songs, eq(contiSongs.songId, songs.id))
    .where(eq(contiSongs.contiId, id))
    .orderBy(contiSongs.sortOrder);

  const songsWithOverrides = contiSongsData.map((row) => ({
    ...row.conti_songs,
    song: row.songs!,
    overrides: parseContiSongOverrides({
      keys: row.conti_songs.keys,
      tempos: row.conti_songs.tempos,
      sectionOrder: row.conti_songs.sectionOrder,
      lyrics: row.conti_songs.lyrics,
      sectionLyricsMap: row.conti_songs.sectionLyricsMap,
      notes: row.conti_songs.notes,
      sheetMusicFileIds: row.conti_songs.sheetMusicFileIds,
      presetId: row.conti_songs.presetId,
    }),
  }));

  return {
    ...conti[0],
    songs: songsWithOverrides,
  };
}

export async function getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
  const conti = await getConti(id);
  if (!conti) return null;

  const presetIds = Array.from(
    new Set(
      conti.songs
        .map((contiSong) => contiSong.overrides.presetId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const presetRows = presetIds.length > 0
    ? await db
        .select({
          id: songPresets.id,
          pdfMetadata: songPresets.pdfMetadata,
        })
        .from(songPresets)
        .where(inArray(songPresets.id, presetIds))
    : [];

  const presetPdfMetadataById = new Map(
    presetRows.map((row) => [
      row.id,
      parsePresetPdfMetadata<PresetPdfMetadata>(row.pdfMetadata),
    ]),
  );

  const songsWithSheetMusic = await Promise.all(
    conti.songs.map(async (contiSong) => {
      const selectedIds = contiSong.overrides.sheetMusicFileIds;

      let sheetMusic;
      if (selectedIds && selectedIds.length > 0) {
        // Use selected sheet music only, preserving selection order
        sheetMusic = await db
          .select()
          .from(sheetMusicFiles)
          .where(inArray(sheetMusicFiles.id, selectedIds));
        // Sort by the order in selectedIds
        const idOrder = new Map(selectedIds.map((smId, i) => [smId, i]));
        sheetMusic.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
      } else {
        // Fallback: all sheet music for the song
        sheetMusic = await db
          .select()
          .from(sheetMusicFiles)
          .where(eq(sheetMusicFiles.songId, contiSong.songId))
          .orderBy(sheetMusicFiles.sortOrder);
      }

      return {
        ...contiSong,
        sheetMusic,
        presetPdfMetadata: contiSong.overrides.presetId
          ? presetPdfMetadataById.get(contiSong.overrides.presetId) ?? null
          : null,
      };
    })
  );

  return { ...conti, songs: songsWithSheetMusic };
}

export async function getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
  const result = await db
    .select()
    .from(contiPdfExports)
    .where(eq(contiPdfExports.contiId, contiId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
