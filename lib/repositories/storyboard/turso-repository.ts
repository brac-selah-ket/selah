import { getTursoDb } from '@/lib/db/turso';
import { parseContiSongOverrides, parsePresetPdfMetadata, stringifyContiSongOverrides } from '@/lib/db/helpers';
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
import { dbTextToDate, dateToDbText } from '@/lib/db/time';
import { generateId } from '@/lib/id';
import type {
  Conti,
  ContiPdfExport,
  ContiSong,
  ContiSongOverrides,
  ContiWithSongSummaries,
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  PdfLayoutState,
  PresetPdfMetadata,
  SheetMusicFile,
  Song,
  SongPageImage,
  SongPreset,
  SongPresetWithSheetMusic,
  SongWithSheetMusic,
} from '@/lib/types';
import type {
  BatchImportSongsToContiItem,
  BatchImportSongsToContiResult,
  ContiInput,
  ResolvedYouTubeMetadata,
  SheetMusicFileInput,
  SongPageImageInput,
  StoryboardRepository,
} from './types';
import { extractPresetPdfMetadataFromLayout } from '@/lib/utils/pdf-export-helpers';
import { songPresetToContiOverrides } from '@/lib/utils/preset-overrides';
import { normalizeYouTubeReference } from '@/lib/utils/youtube';
import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm';

type TursoSong = typeof songs.$inferSelect;
type TursoSheetMusicFile = typeof sheetMusicFiles.$inferSelect;
type TursoSongPreset = typeof songPresets.$inferSelect;
type TursoConti = typeof contis.$inferSelect;
type TursoContiSong = typeof contiSongs.$inferSelect;
type TursoContiPdfExport = typeof contiPdfExports.$inferSelect;
type TursoSongPageImage = typeof songPageImages.$inferSelect;

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

function mapSongPageImage(row: TursoSongPageImage): SongPageImage {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

async function insertTursoSong(name: string): Promise<Song> {
  const tursoDb = getTursoDb();
  const now = dateToDbText(new Date());
  const song = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(songs).values(song);
  return mapSong(song);
}

async function insertTursoContiSong(
  contiId: string,
  songId: string,
  sortOrder: number,
  overrides?: Partial<ContiSongOverrides>,
): Promise<ContiSong> {
  const tursoDb = getTursoDb();
  const now = dateToDbText(new Date());
  const serialized = overrides
    ? stringifyContiSongOverrides(overrides)
    : { keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}' };
  const contiSong = {
    id: generateId(),
    contiId,
    songId,
    sortOrder,
    keys: serialized.keys ?? '[]',
    tempos: serialized.tempos ?? '[]',
    sectionOrder: serialized.sectionOrder ?? '[]',
    lyrics: serialized.lyrics ?? '[]',
    sectionLyricsMap: serialized.sectionLyricsMap ?? '{}',
    notes: overrides?.notes ?? null,
    sheetMusicFileIds: serialized.sheetMusicFileIds ?? null,
    presetId: serialized.presetId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(contiSongs).values(contiSong);
  return mapContiSong(contiSong);
}

async function insertTursoSongPreset(
  songId: string,
  data: { name: string; youtubeReference?: string | null; youtubeTitle?: string | null },
): Promise<SongPreset> {
  const tursoDb = getTursoDb();
  const existing = await tursoDb
    .select({ sortOrder: songPresets.sortOrder })
    .from(songPresets)
    .where(eq(songPresets.songId, songId));
  const maxSort = existing.length > 0 ? Math.max(...existing.map(p => p.sortOrder)) : -1;
  const now = dateToDbText(new Date());
  const preset = {
    id: generateId(),
    songId,
    name: data.name,
    keys: '[]',
    tempos: '[]',
    sectionOrder: '[]',
    lyrics: '[]',
    sectionLyricsMap: '{}',
    notes: null,
    youtubeReference: data.youtubeReference ?? null,
    youtubeTitle: data.youtubeTitle ?? null,
    pdfMetadata: null,
    isDefault: false,
    sortOrder: maxSort + 1,
    createdAt: now,
    updatedAt: now,
  };

  await tursoDb.insert(songPresets).values(preset);
  return mapSongPreset(preset);
}

async function updateTursoSongPresetYoutubeRef(
  presetId: string,
  youtubeReference: string | null,
  youtubeTitle?: string | null,
) {
  const tursoDb = getTursoDb();
  await tursoDb
    .update(songPresets)
    .set({
      youtubeReference,
      youtubeTitle: youtubeReference ? youtubeTitle ?? null : null,
      updatedAt: dateToDbText(new Date()),
    })
    .where(eq(songPresets.id, presetId));
}

async function getPresetOverridesForSong(presetId: string, songId: string): Promise<ContiSongOverrides | null> {
  const tursoDb = getTursoDb();
  const presetRows = await tursoDb
    .select()
    .from(songPresets)
    .where(and(eq(songPresets.id, presetId), eq(songPresets.songId, songId)))
    .limit(1);

  if (presetRows.length === 0) return null;

  const sheetMusicRows = await tursoDb
    .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
    .from(presetSheetMusic)
    .where(eq(presetSheetMusic.presetId, presetId))
    .orderBy(presetSheetMusic.sortOrder);

  return songPresetToContiOverrides(
    mapSongPreset(presetRows[0]),
    sheetMusicRows.map((row) => row.sheetMusicFileId),
  );
}

export const tursoStoryboardRepository: StoryboardRepository = {
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

  async getSongPresetWithSheetMusic(presetId: string): Promise<SongPresetWithSheetMusic | null> {
    const tursoDb = getTursoDb();
    const presetRows = await tursoDb
      .select()
      .from(songPresets)
      .where(eq(songPresets.id, presetId))
      .limit(1);

    if (presetRows.length === 0) {
      return null;
    }

    const sheetMusicFileIds = await this.getPresetSheetMusicFileIds(presetId);

    return {
      ...mapSongPreset(presetRows[0]),
      sheetMusicFileIds,
    };
  },

  async getPresetSheetMusicFileIds(presetId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
      .from(presetSheetMusic)
      .where(eq(presetSheetMusic.presetId, presetId))
      .orderBy(presetSheetMusic.sortOrder);

    return rows.map((row) => row.sheetMusicFileId);
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

  async getContiSong(contiSongId: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    return result[0] ? mapContiSong(result[0]) : null;
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

  async getContiPdfExportById(exportId: string): Promise<ContiPdfExport | null> {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    return result[0] ? mapContiPdfExport(result[0]) : null;
  },

  async getSheetMusicForSong(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, songId))
      .orderBy(sheetMusicFiles.sortOrder);

    return rows.map(mapSheetMusicFile);
  },

  async getSheetMusicFile(fileId: string) {
    const tursoDb = getTursoDb();
    const result = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    return result[0] ? mapSheetMusicFile(result[0]) : null;
  },

  async getPageImagesForSong(songId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.songId, songId))
      .orderBy(songPageImages.createdAt);

    return rows.map(mapSongPageImage);
  },

  async getPageImagesForConti(contiId: string) {
    const tursoDb = getTursoDb();
    const rows = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId))
      .orderBy(songPageImages.createdAt);

    return rows.map(mapSongPageImage);
  },

  async createSong(name: string) {
    return await insertTursoSong(name);
  },

  async updateSong(id: string, data: { name: string }) {
    const tursoDb = getTursoDb();
    await tursoDb
      .update(songs)
      .set({ name: data.name, updatedAt: dateToDbText(new Date()) })
      .where(eq(songs.id, id));

    const result = await tursoDb.select().from(songs).where(eq(songs.id, id)).limit(1);
    return result[0] ? mapSong(result[0]) : null;
  },

  async deleteSong(id: string) {
    const tursoDb = getTursoDb();
    const usedInConti = await tursoDb
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.songId, id))
      .limit(1);

    if (usedInConti.length > 0) {
      return { blockedByConti: true };
    }

    await tursoDb.delete(songs).where(eq(songs.id, id));
    return { blockedByConti: false };
  },

  async createConti(data: ContiInput) {
    const tursoDb = getTursoDb();
    const now = dateToDbText(new Date());
    const conti = {
      id: generateId(),
      title: data.title,
      date: data.date,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(contis).values(conti);
    return mapConti(conti);
  },

  async updateConti(id: string, data: ContiInput) {
    const tursoDb = getTursoDb();
    await tursoDb
      .update(contis)
      .set({ ...data, updatedAt: dateToDbText(new Date()) })
      .where(eq(contis.id, id));

    const result = await tursoDb.select().from(contis).where(eq(contis.id, id)).limit(1);
    return result[0] ? mapConti(result[0]) : null;
  },

  async deleteConti(id: string) {
    const tursoDb = getTursoDb();
    await tursoDb.delete(contis).where(eq(contis.id, id));
  },

  async createSheetMusicFile(data: SheetMusicFileInput) {
    const tursoDb = getTursoDb();
    const maxSortOrderResult = await tursoDb
      .select({ maxOrder: max(sheetMusicFiles.sortOrder) })
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, data.songId));

    const sheetMusicFile = {
      id: generateId(),
      ...data,
      sortOrder: (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      createdAt: dateToDbText(new Date()),
    };

    await tursoDb.insert(sheetMusicFiles).values(sheetMusicFile);
    return mapSheetMusicFile(sheetMusicFile);
  },

  async deleteSheetMusicFile(fileId: string) {
    const tursoDb = getTursoDb();
    const file = await tursoDb
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    if (file.length === 0) {
      return null;
    }

    await tursoDb.delete(sheetMusicFiles).where(eq(sheetMusicFiles.id, fileId));
    return mapSheetMusicFile(file[0]);
  },

  async reorderSheetMusic(songId: string, orderedIds: string[]) {
    const tursoDb = getTursoDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await tursoDb
        .update(sheetMusicFiles)
        .set({ sortOrder: i })
        .where(and(eq(sheetMusicFiles.songId, songId), eq(sheetMusicFiles.id, orderedIds[i])));
    }
  },

  async addSongToConti(contiId: string, songId: string, initialOverrides?: Partial<ContiSongOverrides>) {
    const tursoDb = getTursoDb();
    const maxSortOrderResult = await tursoDb
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    return await insertTursoContiSong(
      contiId,
      songId,
      (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      initialOverrides,
    );
  },

  async removeContiSong(contiSongId: string) {
    const tursoDb = getTursoDb();
    await tursoDb.delete(contiSongs).where(eq(contiSongs.id, contiSongId));
  },

  async updateContiSong(contiSongId: string, data: Partial<ContiSongOverrides>) {
    const tursoDb = getTursoDb();
    await tursoDb
      .update(contiSongs)
      .set({ ...stringifyContiSongOverrides(data), updatedAt: dateToDbText(new Date()) })
      .where(eq(contiSongs.id, contiSongId));
  },

  async reorderContiSongs(contiId: string, orderedIds: string[]) {
    const tursoDb = getTursoDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await tursoDb
        .update(contiSongs)
        .set({ sortOrder: i })
        .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.id, orderedIds[i])));
    }
  },

  async getContiSongPresetSource(contiSongId: string) {
    const tursoDb = getTursoDb();
    const contiSongRow = await tursoDb
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    if (contiSongRow.length === 0) {
      return null;
    }

    const cs = contiSongRow[0];
    const overrides = parseContiSongOverrides(cs);
    const orderedSongs = await tursoDb
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, cs.contiId))
      .orderBy(asc(contiSongs.sortOrder));
    const songIndex = orderedSongs.findIndex((item) => item.id === contiSongId);
    const contiExport = await tursoDb
      .select({ layoutState: contiPdfExports.layoutState })
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, cs.contiId))
      .limit(1);

    let pdfMetadata: PresetPdfMetadata | null = null;
    if (songIndex >= 0) {
      const layoutStateText = contiExport[0]?.layoutState;
      if (layoutStateText) {
        try {
          const parsed = JSON.parse(layoutStateText) as PdfLayoutState;
          pdfMetadata = extractPresetPdfMetadataFromLayout(parsed.pages, songIndex);
        } catch {
          pdfMetadata = null;
        }
      }
    }

    return {
      songId: cs.songId,
      overrides,
      pdfMetadata,
    };
  },

  async syncPresetPdfMetadataFromContiLayout(contiId: string, layoutState: PdfLayoutState) {
    const tursoDb = getTursoDb();
    const orderedSongs = await tursoDb
      .select({ id: contiSongs.id, presetId: contiSongs.presetId })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId))
      .orderBy(asc(contiSongs.sortOrder));

    let updatedPresetCount = 0;

    for (let songIndex = 0; songIndex < orderedSongs.length; songIndex++) {
      const presetId = orderedSongs[songIndex].presetId;
      if (!presetId) continue;

      const metadata = extractPresetPdfMetadataFromLayout(layoutState.pages, songIndex);
      await tursoDb
        .update(songPresets)
        .set({
          pdfMetadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: dateToDbText(new Date()),
        })
        .where(eq(songPresets.id, presetId));
      updatedPresetCount += 1;
    }

    return { updatedPresetCount };
  },

  async batchImportSongsToConti(
    contiId: string,
    items: BatchImportSongsToContiItem[],
  ): Promise<BatchImportSongsToContiResult> {
    const tursoDb = getTursoDb();
    let created = 0;
    let presetUpdated = 0;

    const maxResult = await tursoDb
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    let nextSortOrder = (maxResult[0]?.maxOrder ?? -1) + 1;
    const newSongMap = new Map<string, string>();

    for (const item of items) {
      let resolvedSongId: string;
      let appliedPresetId = item.presetId ?? null;
      let appliedPresetOverrides: ContiSongOverrides | null = null;

      if (item.songId) {
        resolvedSongId = item.songId;
      } else {
        const trimmedName = item.newSongName!.trim();
        const normalizedKey = trimmedName.toLowerCase();

        if (newSongMap.has(normalizedKey)) {
          resolvedSongId = newSongMap.get(normalizedKey)!;
        } else {
          const newSong = await insertTursoSong(trimmedName);
          newSongMap.set(normalizedKey, newSong.id);
          resolvedSongId = newSong.id;
          created++;
        }
      }

      if (item.videoId) {
        if (!item.songId && item.createNewPreset !== false) {
          const preset = await insertTursoSongPreset(resolvedSongId, {
            name: item.presetName || 'YouTube Import',
            youtubeReference: item.videoId,
            youtubeTitle: item.title,
          });
          appliedPresetId = preset.id;
          appliedPresetOverrides = songPresetToContiOverrides(preset);
        } else if (item.songId && item.presetId) {
          appliedPresetOverrides = await getPresetOverridesForSong(item.presetId, resolvedSongId);
          if (!appliedPresetOverrides) {
            throw new Error('PRESET_NOT_FOUND');
          }
          if (item.replaceExistingYoutube !== false) {
            await updateTursoSongPresetYoutubeRef(item.presetId, item.videoId, item.title);
          }
          appliedPresetId = item.presetId;
        } else if (item.songId && item.createNewPreset) {
          const preset = await insertTursoSongPreset(resolvedSongId, {
            name: item.presetName || 'YouTube Import',
            youtubeReference: item.videoId,
            youtubeTitle: item.title,
          });
          appliedPresetId = preset.id;
          appliedPresetOverrides = songPresetToContiOverrides(preset);
        }
      }

      if (appliedPresetId && !appliedPresetOverrides) {
        appliedPresetOverrides = await getPresetOverridesForSong(appliedPresetId, resolvedSongId);
        if (!appliedPresetOverrides) {
          throw new Error('PRESET_NOT_FOUND');
        }
      }

      if (item.alreadyInConti) {
        if (appliedPresetOverrides) {
          await tursoDb
            .update(contiSongs)
            .set({ ...stringifyContiSongOverrides(appliedPresetOverrides), updatedAt: dateToDbText(new Date()) })
            .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, resolvedSongId)));
        }
        presetUpdated++;
      } else {
        await insertTursoContiSong(
          contiId,
          resolvedSongId,
          nextSortOrder++,
          appliedPresetOverrides ?? undefined,
        );
      }
    }

    return { added: items.length - presetUpdated, created, presetUpdated };
  },

  async createSongPreset(songId: string, data, resolvedYoutube: ResolvedYouTubeMetadata | null) {
    const tursoDb = getTursoDb();
    if (data.isDefault) {
      await tursoDb.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const existing = await this.getSongPresets(songId);
    const maxSort = existing.length > 0 ? Math.max(...existing.map(p => p.sortOrder)) : -1;
    const now = dateToDbText(new Date());
    const presetRecord = {
      id: generateId(),
      songId,
      name: data.name,
      keys: JSON.stringify(data.keys),
      tempos: JSON.stringify(data.tempos),
      sectionOrder: JSON.stringify(data.sectionOrder),
      lyrics: JSON.stringify(data.lyrics),
      sectionLyricsMap: JSON.stringify(data.sectionLyricsMap),
      notes: data.notes,
      youtubeReference: resolvedYoutube?.videoId ?? null,
      youtubeTitle: resolvedYoutube?.title ?? null,
      pdfMetadata: data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null,
      isDefault: data.isDefault,
      sortOrder: maxSort + 1,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(songPresets).values(presetRecord);

    if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
      await tursoDb.insert(presetSheetMusic).values(
        data.sheetMusicFileIds.map((fileId, index) => ({
          id: generateId(),
          presetId: presetRecord.id,
          sheetMusicFileId: fileId,
          sortOrder: index,
        })),
      );
    }

    return mapSongPreset(presetRecord);
  },

  async updateSongPreset(presetId: string, data, resolvedYoutube?: ResolvedYouTubeMetadata | null) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    const songId = existing[0].songId;
    if (data.isDefault) {
      await tursoDb.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const updateData: Record<string, unknown> = { updatedAt: dateToDbText(new Date()) };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.keys !== undefined) updateData.keys = JSON.stringify(data.keys);
    if (data.tempos !== undefined) updateData.tempos = JSON.stringify(data.tempos);
    if (data.sectionOrder !== undefined) updateData.sectionOrder = JSON.stringify(data.sectionOrder);
    if (data.lyrics !== undefined) updateData.lyrics = JSON.stringify(data.lyrics);
    if (data.sectionLyricsMap !== undefined) updateData.sectionLyricsMap = JSON.stringify(data.sectionLyricsMap);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.youtubeReference !== undefined) {
      updateData.youtubeReference = resolvedYoutube?.videoId ?? null;
      const existingYoutube = normalizeYouTubeReference(existing[0].youtubeReference);
      const shouldPreserveExistingYoutubeTitle =
        resolvedYoutube?.videoId &&
        !resolvedYoutube.title &&
        !data.youtubeTitle?.trim() &&
        existingYoutube?.videoId === resolvedYoutube.videoId &&
        !!existing[0].youtubeTitle?.trim();
      updateData.youtubeTitle = shouldPreserveExistingYoutubeTitle
        ? existing[0].youtubeTitle
        : resolvedYoutube?.title ?? null;
    } else if (data.youtubeTitle !== undefined && existing[0].youtubeReference) {
      updateData.youtubeTitle = data.youtubeTitle?.trim() || null;
    }
    if (data.pdfMetadata !== undefined) updateData.pdfMetadata = data.pdfMetadata ? JSON.stringify(data.pdfMetadata) : null;

    await tursoDb.update(songPresets).set(updateData).where(eq(songPresets.id, presetId));

    if (data.sheetMusicFileIds !== undefined) {
      await tursoDb.delete(presetSheetMusic).where(eq(presetSheetMusic.presetId, presetId));
      if (data.sheetMusicFileIds.length > 0) {
        await tursoDb.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId,
            sheetMusicFileId: fileId,
            sortOrder: index,
          })),
        );
      }
    }

    const result = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    return result[0] ? mapSongPreset(result[0]) : null;
  },

  async deleteSongPreset(presetId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    await tursoDb.delete(songPresets).where(eq(songPresets.id, presetId));
    return mapSongPreset(existing[0]);
  },

  async setDefaultPreset(songId: string, presetId: string) {
    const tursoDb = getTursoDb();
    await tursoDb.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    await tursoDb
      .update(songPresets)
      .set({ isDefault: true, updatedAt: dateToDbText(new Date()) })
      .where(eq(songPresets.id, presetId));
  },

  async upsertContiPdfExport(contiId: string, data: { pdfUrl?: string | null; layoutState?: string | null }) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);
    const now = dateToDbText(new Date());

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = { updatedAt: now };
      if ('pdfUrl' in data) updateData.pdfUrl = data.pdfUrl ?? null;
      if ('layoutState' in data) updateData.layoutState = data.layoutState ?? null;
      await tursoDb.update(contiPdfExports).set(updateData).where(eq(contiPdfExports.id, existing[0].id));
      const result = await tursoDb.select().from(contiPdfExports).where(eq(contiPdfExports.id, existing[0].id)).limit(1);
      return mapContiPdfExport(result[0]);
    }

    const newExport = {
      id: generateId(),
      contiId,
      pdfUrl: data.pdfUrl ?? null,
      layoutState: data.layoutState ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(contiPdfExports).values(newExport);
    return mapContiPdfExport(newExport);
  },

  async deleteContiPdfExport(exportId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    await tursoDb.delete(contiPdfExports).where(eq(contiPdfExports.id, exportId));
    return mapContiPdfExport(existing[0]);
  },

  async createSongPageImage(data: SongPageImageInput) {
    const tursoDb = getTursoDb();
    const now = dateToDbText(new Date());
    const record = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await tursoDb.insert(songPageImages).values(record);
    return mapSongPageImage(record);
  },

  async deletePageImagesForConti(contiId: string) {
    const tursoDb = getTursoDb();
    const existing = await tursoDb
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId));

    await tursoDb.delete(songPageImages).where(eq(songPageImages.contiId, contiId));
    return existing.map(mapSongPageImage);
  },
};
