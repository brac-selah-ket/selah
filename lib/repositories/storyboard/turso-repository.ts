import { getTursoDb } from '@/lib/db/turso';
import { parseContiSongOverrides, parsePresetPdfMetadata } from '@/lib/db/helpers';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPresets,
  songs,
} from '@/lib/db/turso-schema';
import { dbTextToDate } from '@/lib/db/time';
import type {
  Conti,
  ContiPdfExport,
  ContiSong,
  ContiWithSongSummaries,
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  PresetPdfMetadata,
  SheetMusicFile,
  Song,
  SongPreset,
  SongPresetWithSheetMusic,
  SongWithSheetMusic,
} from '@/lib/types';
import { desc, eq, inArray, sql } from 'drizzle-orm';

type TursoSong = typeof songs.$inferSelect;
type TursoSheetMusicFile = typeof sheetMusicFiles.$inferSelect;
type TursoSongPreset = typeof songPresets.$inferSelect;
type TursoConti = typeof contis.$inferSelect;
type TursoContiSong = typeof contiSongs.$inferSelect;
type TursoContiPdfExport = typeof contiPdfExports.$inferSelect;

function mapSong(row: TursoSong): Song {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapSheetMusicFile(row: TursoSheetMusicFile): SheetMusicFile {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
  };
}

function mapSongPreset(row: TursoSongPreset): SongPreset {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapConti(row: TursoConti): Conti {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapContiSong(row: TursoContiSong): ContiSong {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapContiPdfExport(row: TursoContiPdfExport): ContiPdfExport {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

export const tursoStoryboardRepository = {
  async getSongs() {
    const tursoDb = getTursoDb();
    const rows = await tursoDb.select().from(songs).orderBy(desc(songs.createdAt));
    return rows.map(mapSong);
  },

  async getSong(id: string): Promise<SongWithSheetMusic | null> {
    const tursoDb = getTursoDb();
    const song = await tursoDb.select().from(songs).where(eq(songs.id, id)).limit(1);

    if (song.length === 0) {
      return null;
    }

    const sheetMusicRows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, id))
      .orderBy(sheetMusicFiles.sortOrder);

    const presets = await this.getSongPresetsWithSheetMusic(id);

    return {
      ...mapSong(song[0]),
      sheetMusic: sheetMusicRows.map(mapSheetMusicFile),
      presets,
    };
  },

  async getSongPresets(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songPresets)
      .where(eq(songPresets.songId, songId))
      .orderBy(songPresets.sortOrder);

    return rows.map(mapSongPreset);
  },

  async searchSongs(query: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songs)
      .where(sql`lower(${songs.name}) like lower(${`%${query}%`})`)
      .orderBy(desc(songs.createdAt));

    return rows.map(mapSong);
  },

  async getSongPresetsWithSheetMusic(songId: string): Promise<SongPresetWithSheetMusic[]> {
    const tursoDb = getTursoDb();
    const presets = await this.getSongPresets(songId);

    const presetsWithSheetMusic = await Promise.all(
      presets.map(async (preset) => {
        const sheetMusicRows = await tursoDb
          .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
          .from(presetSheetMusic)
          .where(eq(presetSheetMusic.presetId, preset.id))
          .orderBy(presetSheetMusic.sortOrder);

        return {
          ...preset,
          sheetMusicFileIds: sheetMusicRows.map(r => r.sheetMusicFileId),
        };
      })
    );

    return presetsWithSheetMusic;
  },

  async getContis() {
    const tursoDb = getTursoDb();
    const rows = await tursoDb.select().from(contis).orderBy(desc(contis.date));
    return rows.map(mapConti);
  },

  async getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
    const tursoDb = getTursoDb();
    const contiRows = await this.getContis();
    if (contiRows.length === 0) return [];

    const contiIds = contiRows.map((conti) => conti.id);

    const rows = await tursoDb
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
  },

  async getContiByDate(date: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb.select().from(contis).where(eq(contis.date, date)).limit(1);
    return result[0] ? mapConti(result[0]) : null;
  },

  async getConti(id: string): Promise<ContiWithSongs | null> {
    const tursoDb = getTursoDb();
    const conti = await tursoDb.select().from(contis).where(eq(contis.id, id)).limit(1);

    if (conti.length === 0) {
      return null;
    }

    const contiSongsData = await tursoDb
      .select({
        contiSong: contiSongs,
        song: songs,
        preset: {
          id: songPresets.id,
          name: songPresets.name,
          youtubeReference: songPresets.youtubeReference,
          youtubeTitle: songPresets.youtubeTitle,
        },
      })
      .from(contiSongs)
      .leftJoin(songs, eq(contiSongs.songId, songs.id))
      .leftJoin(songPresets, eq(contiSongs.presetId, songPresets.id))
      .where(eq(contiSongs.contiId, id))
      .orderBy(contiSongs.sortOrder);

    const songsWithOverrides = contiSongsData.map((row) => ({
      ...mapContiSong(row.contiSong),
      song: mapSong(row.song!),
      overrides: parseContiSongOverrides({
        keys: row.contiSong.keys,
        tempos: row.contiSong.tempos,
        sectionOrder: row.contiSong.sectionOrder,
        lyrics: row.contiSong.lyrics,
        sectionLyricsMap: row.contiSong.sectionLyricsMap,
        notes: row.contiSong.notes,
        sheetMusicFileIds: row.contiSong.sheetMusicFileIds,
        presetId: row.contiSong.presetId,
      }),
      appliedPreset: row.preset?.id ? row.preset : null,
    }));

    return {
      ...mapConti(conti[0]),
      songs: songsWithOverrides,
    };
  },

  async getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
    const tursoDb = getTursoDb();
    const conti = await this.getConti(id);
    if (!conti) return null;

    const presetIds = Array.from(
      new Set(
        conti.songs
          .map((contiSong) => contiSong.overrides.presetId)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const presetRows = presetIds.length > 0
      ? await tursoDb
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
          const sheetMusicRows = await tursoDb
            .select()
            .from(sheetMusicFiles)
            .where(inArray(sheetMusicFiles.id, selectedIds));
          // Sort by the order in selectedIds
          const idOrder = new Map(selectedIds.map((smId, i) => [smId, i]));
          sheetMusic = sheetMusicRows
            .map(mapSheetMusicFile)
            .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
        } else {
          // Fallback: all sheet music for the song
          const sheetMusicRows = await tursoDb
            .select()
            .from(sheetMusicFiles)
            .where(eq(sheetMusicFiles.songId, contiSong.songId))
            .orderBy(sheetMusicFiles.sortOrder);
          sheetMusic = sheetMusicRows.map(mapSheetMusicFile);
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
  },

  async getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    return result.length > 0 ? mapContiPdfExport(result[0]) : null;
  },
};
