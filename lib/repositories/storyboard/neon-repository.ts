import { db } from '@/lib/db';
import { parseContiSongOverrides, parsePresetPdfMetadata } from '@/lib/db/helpers';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPresets,
  songs,
} from '@/lib/db/schema';
import type {
  ContiPdfExport,
  ContiWithSongSummaries,
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  PresetPdfMetadata,
  SongPresetWithSheetMusic,
  SongWithSheetMusic,
} from '@/lib/types';
import { desc, eq, ilike, inArray } from 'drizzle-orm';

export const neonStoryboardRepository = {
  async getSongs() {
    return await db.select().from(songs).orderBy(desc(songs.createdAt));
  },

  async getSong(id: string): Promise<SongWithSheetMusic | null> {
    const song = await db.select().from(songs).where(eq(songs.id, id)).limit(1);

    if (song.length === 0) {
      return null;
    }

    const sheetMusic = await db
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, id))
      .orderBy(sheetMusicFiles.sortOrder);

    const presets = await this.getSongPresetsWithSheetMusic(id);

    return {
      ...song[0],
      sheetMusic,
      presets,
    };
  },

  async getSongPresets(songId: string) {
    return await db
      .select()
      .from(songPresets)
      .where(eq(songPresets.songId, songId))
      .orderBy(songPresets.sortOrder);
  },

  async searchSongs(query: string) {
    return await db
      .select()
      .from(songs)
      .where(ilike(songs.name, `%${query}%`))
      .orderBy(desc(songs.createdAt));
  },

  async getSongPresetsWithSheetMusic(songId: string): Promise<SongPresetWithSheetMusic[]> {
    const presets = await this.getSongPresets(songId);

    const presetsWithSheetMusic = await Promise.all(
      presets.map(async (preset) => {
        const sheetMusicRows = await db
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
    return await db.select().from(contis).orderBy(desc(contis.date));
  },

  async getContisWithSongSummaries(): Promise<ContiWithSongSummaries[]> {
    const contiRows = await this.getContis();
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
  },

  async getContiByDate(date: string) {
    const result = await db.select().from(contis).where(eq(contis.date, date)).limit(1);
    return result[0] ?? null;
  },

  async getConti(id: string): Promise<ContiWithSongs | null> {
    const conti = await db.select().from(contis).where(eq(contis.id, id)).limit(1);

    if (conti.length === 0) {
      return null;
    }

    const contiSongsData = await db
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
      ...row.contiSong,
      song: row.song!,
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
      ...conti[0],
      songs: songsWithOverrides,
    };
  },

  async getContiForExport(id: string): Promise<ContiWithSongsAndSheetMusic | null> {
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
  },

  async getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
    const result = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  },
};
