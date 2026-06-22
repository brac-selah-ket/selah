import { db } from '@/lib/db';
import { parseContiSongOverrides, parsePresetPdfMetadata, stringifyContiSongOverrides } from '@/lib/db/helpers';
import { insertContiSong, insertSong, insertSongPreset, updateSongPresetYoutubeRef } from '@/lib/db/insert-helpers';
import {
  contiPdfExports,
  contis,
  contiSongs,
  presetSheetMusic,
  sheetMusicFiles,
  songPageImages,
  songPresets,
  songPresetSongs,
  songs,
} from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type {
  ContiSongOverrides,
  ContiPdfExport,
  ContiWithSongSummaries,
  ContiWithSongs,
  ContiWithSongsAndSheetMusic,
  PdfLayoutState,
  PresetPdfMetadata,
  SongPreset,
  SongPresetMember,
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
import { buildArrangementItems } from '@/lib/utils/arrangement-items';
import { buildBlankMashupPresetData, getOrderedSongPairKey } from '@/lib/utils/mashup-presets';
import { songPresetToContiOverrides } from '@/lib/utils/preset-overrides';
import { normalizeYouTubeReference } from '@/lib/utils/youtube';
import { and, asc, desc, eq, ilike, inArray, max } from 'drizzle-orm';

export function getAdjacentOrderedContiSongPair<T extends { id: string }>(
  orderedRows: T[],
  pairIds: readonly [string, string],
): [T, T] | null {
  const firstIndex = orderedRows.findIndex((row) => row.id === pairIds[0]);
  const secondIndex = orderedRows.findIndex((row) => row.id === pairIds[1]);
  if (firstIndex === -1 || secondIndex === -1) return null;

  const earlierIndex = Math.min(firstIndex, secondIndex);
  const laterIndex = Math.max(firstIndex, secondIndex);
  if (laterIndex !== earlierIndex + 1) return null;

  return [orderedRows[earlierIndex], orderedRows[laterIndex]];
}

async function getPresetMemberRows(presetId: string): Promise<SongPresetMember[]> {
  const rows = await db
    .select({
      id: songPresetSongs.id,
      presetId: songPresetSongs.presetId,
      songId: songPresetSongs.songId,
      sortOrder: songPresetSongs.sortOrder,
      partLabel: songPresetSongs.partLabel,
      songName: songs.name,
    })
    .from(songPresetSongs)
    .leftJoin(songs, eq(songPresetSongs.songId, songs.id))
    .where(eq(songPresetSongs.presetId, presetId))
    .orderBy(songPresetSongs.sortOrder);

  return rows.map((row) => ({
    id: row.id,
    presetId: row.presetId,
    songId: row.songId,
    sortOrder: row.sortOrder,
    partLabel: row.partLabel,
    songName: row.songName ?? undefined,
  }));
}

async function getNextPresetSortOrderForSong(songId: string): Promise<number> {
  const rows = await db
    .select({ sortOrder: songPresets.sortOrder })
    .from(songPresetSongs)
    .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
    .where(eq(songPresetSongs.songId, songId));

  return rows.length > 0 ? Math.max(...rows.map((row) => row.sortOrder)) + 1 : 0;
}

async function getPresetOverridesForSong(presetId: string, songId: string): Promise<ContiSongOverrides | null> {
  const presetRows = await db
    .select()
    .from(songPresetSongs)
    .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
    .where(and(eq(songPresetSongs.presetId, presetId), eq(songPresetSongs.songId, songId)))
    .limit(1);

  if (presetRows.length === 0) return null;

  const sheetMusicRows = await db
    .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
    .from(presetSheetMusic)
    .where(eq(presetSheetMusic.presetId, presetId))
    .orderBy(presetSheetMusic.sortOrder);

  return songPresetToContiOverrides(
    presetRows[0].song_presets,
    sheetMusicRows.map((row) => row.sheetMusicFileId),
  );
}

export const neonStoryboardRepository: StoryboardRepository = {
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
    const rows = await db
      .select({ preset: songPresets })
      .from(songPresetSongs)
      .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
      .where(eq(songPresetSongs.songId, songId))
      .orderBy(songPresets.sortOrder);

    return rows.map((row) => row.preset);
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
          members: await this.getPresetMembers(preset.id),
        };
      })
    );

    return presetsWithSheetMusic;
  },

  async getSongPresetWithSheetMusic(presetId: string): Promise<SongPresetWithSheetMusic | null> {
    const presetRows = await db
      .select()
      .from(songPresets)
      .where(eq(songPresets.id, presetId))
      .limit(1);

    if (presetRows.length === 0) {
      return null;
    }

    const sheetMusicFileIds = await this.getPresetSheetMusicFileIds(presetId);

    return {
      ...presetRows[0],
      sheetMusicFileIds,
      members: await this.getPresetMembers(presetId),
    };
  },

  async getPresetMembers(presetId: string) {
    return getPresetMemberRows(presetId);
  },

  async findMashupPresetBySongs([firstSongId, secondSongId]: [string, string]) {
    const pairKey = getOrderedSongPairKey([firstSongId, secondSongId]);
    const directRows = await db
      .select({ id: songPresets.id })
      .from(songPresets)
      .where(and(eq(songPresets.presetType, "mashup"), eq(songPresets.mashupPairKey, pairKey)))
      .orderBy(songPresets.sortOrder)
      .limit(1);
    if (directRows[0]) {
      return this.getSongPresetWithSheetMusic(directRows[0].id);
    }

    const candidateRows = await db
      .select({ presetId: songPresetSongs.presetId })
      .from(songPresetSongs)
      .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
      .where(eq(songPresets.presetType, "mashup"))
      .orderBy(songPresets.sortOrder);

    const candidateIds = Array.from(new Set(candidateRows.map((row) => row.presetId)));
    for (const presetId of candidateIds) {
      const members = await this.getPresetMembers(presetId);
      const ordered = members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
      if (
        ordered.length === 2 &&
        ordered[0].songId === firstSongId &&
        ordered[1].songId === secondSongId
      ) {
        return this.getSongPresetWithSheetMusic(presetId);
      }
    }

    return null;
  },

  async getPresetSheetMusicFileIds(presetId: string) {
    const rows = await db
      .select({ sheetMusicFileId: presetSheetMusic.sheetMusicFileId })
      .from(presetSheetMusic)
      .where(eq(presetSheetMusic.presetId, presetId))
      .orderBy(presetSheetMusic.sortOrder);

    return rows.map((row) => row.sheetMusicFileId);
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
          presetType: songPresets.presetType,
          displayTitle: songPresets.displayTitle,
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

  async getContiSong(contiSongId: string) {
    const result = await db
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    return result[0] ?? null;
  },

  async getContiPdfExport(contiId: string): Promise<ContiPdfExport | null> {
    const result = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  },

  async getContiPdfExportById(exportId: string): Promise<ContiPdfExport | null> {
    const result = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    return result[0] ?? null;
  },

  async getSheetMusicForSong(songId: string) {
    return await db
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, songId))
      .orderBy(sheetMusicFiles.sortOrder);
  },

  async getSheetMusicFile(fileId: string) {
    const result = await db
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    return result[0] ?? null;
  },

  async getPageImagesForSong(songId: string) {
    return await db
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.songId, songId))
      .orderBy(songPageImages.createdAt);
  },

  async getPageImagesForConti(contiId: string) {
    return await db
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId))
      .orderBy(songPageImages.createdAt);
  },

  async createSong(name: string) {
    return await insertSong(db, name);
  },

  async updateSong(id: string, data: { name: string }) {
    await db
      .update(songs)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(songs.id, id));

    const result = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    return result[0] ?? null;
  },

  async deleteSong(id: string) {
    const usedInConti = await db
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.songId, id))
      .limit(1);

    if (usedInConti.length > 0) {
      return { blockedByConti: true };
    }

    await db.delete(songs).where(eq(songs.id, id));
    return { blockedByConti: false };
  },

  async createConti(data: ContiInput) {
    const now = new Date();
    const conti = {
      id: generateId(),
      title: data.title,
      date: data.date,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contis).values(conti);
    return conti;
  },

  async updateConti(id: string, data: ContiInput) {
    await db
      .update(contis)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contis.id, id));

    const result = await db.select().from(contis).where(eq(contis.id, id)).limit(1);
    return result[0] ?? null;
  },

  async deleteConti(id: string) {
    await db.delete(contis).where(eq(contis.id, id));
  },

  async createSheetMusicFile(data: SheetMusicFileInput) {
    const maxSortOrderResult = await db
      .select({ maxOrder: max(sheetMusicFiles.sortOrder) })
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.songId, data.songId));

    const sheetMusicFile = {
      id: generateId(),
      ...data,
      sortOrder: (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      createdAt: new Date(),
    };

    await db.insert(sheetMusicFiles).values(sheetMusicFile);
    return sheetMusicFile;
  },

  async deleteSheetMusicFile(fileId: string) {
    const file = await db
      .select()
      .from(sheetMusicFiles)
      .where(eq(sheetMusicFiles.id, fileId))
      .limit(1);

    if (file.length === 0) {
      return null;
    }

    await db.delete(sheetMusicFiles).where(eq(sheetMusicFiles.id, fileId));
    return file[0];
  },

  async reorderSheetMusic(songId: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(sheetMusicFiles)
        .set({ sortOrder: i })
        .where(and(eq(sheetMusicFiles.songId, songId), eq(sheetMusicFiles.id, orderedIds[i])));
    }
  },

  async addSongToConti(contiId: string, songId: string, initialOverrides?: Partial<ContiSongOverrides>) {
    const maxSortOrderResult = await db
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    return await insertContiSong(
      db,
      contiId,
      songId,
      (maxSortOrderResult[0]?.maxOrder ?? -1) + 1,
      initialOverrides,
    );
  },

  async removeContiSong(contiSongId: string) {
    await db.delete(contiSongs).where(eq(contiSongs.id, contiSongId));
  },

  async updateContiSong(contiSongId: string, data: Partial<ContiSongOverrides>) {
    await db
      .update(contiSongs)
      .set({ ...stringifyContiSongOverrides(data), updatedAt: new Date() })
      .where(eq(contiSongs.id, contiSongId));
  },

  async reorderContiSongs(contiId: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(contiSongs)
        .set({ sortOrder: i })
        .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.id, orderedIds[i])));
    }
  },

  async getContiSongPresetSource(contiSongId: string) {
    const contiSongRow = await db
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.id, contiSongId))
      .limit(1);

    if (contiSongRow.length === 0) {
      return null;
    }

    const cs = contiSongRow[0];
    const overrides = parseContiSongOverrides(cs);
    const orderedSongs = await db
      .select({ id: contiSongs.id })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, cs.contiId))
      .orderBy(asc(contiSongs.sortOrder));
    const songIndex = orderedSongs.findIndex((item) => item.id === contiSongId);
    const contiExport = await db
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
    const conti = await this.getConti(contiId);
    if (!conti) {
      return { updatedPresetCount: 0 };
    }

    let updatedPresetCount = 0;
    const updatedPresetIds = new Set<string>();
    const arrangementItems = buildArrangementItems(conti.songs);

    for (let itemIndex = 0; itemIndex < arrangementItems.length; itemIndex++) {
      const item = arrangementItems[itemIndex];
      const presetId = item.presetId;
      if (!presetId || updatedPresetIds.has(presetId)) continue;

      const metadata = extractPresetPdfMetadataFromLayout(layoutState.pages, itemIndex, item.key);
      await db
        .update(songPresets)
        .set({
          pdfMetadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: new Date(),
        })
        .where(eq(songPresets.id, presetId));
      updatedPresetIds.add(presetId);
      updatedPresetCount += 1;
    }

    return { updatedPresetCount };
  },

  async batchImportSongsToConti(
    contiId: string,
    items: BatchImportSongsToContiItem[],
  ): Promise<BatchImportSongsToContiResult> {
    let created = 0;
    let presetUpdated = 0;
    let mashupsApplied = 0;

    const maxResult = await db
      .select({ maxOrder: max(contiSongs.sortOrder) })
      .from(contiSongs)
      .where(eq(contiSongs.contiId, contiId));

    let nextSortOrder = (maxResult[0]?.maxOrder ?? -1) + 1;
    const newSongMap = new Map<string, string>();
    const importedRows: Array<{ contiSongId: string | null; songId: string; songName: string }> = [];

    for (const item of items) {
      let resolvedSongId: string;
      let resolvedSongName: string;
      let appliedPresetId = item.presetId ?? null;
      let appliedPresetOverrides: ContiSongOverrides | null = null;

      if (item.songId) {
        resolvedSongId = item.songId;
        resolvedSongName = item.songName?.trim() || item.newSongName?.trim() || item.title || item.songId;
      } else {
        const trimmedName = item.newSongName!.trim();
        const normalizedKey = trimmedName.toLowerCase();
        resolvedSongName = trimmedName;

        if (newSongMap.has(normalizedKey)) {
          resolvedSongId = newSongMap.get(normalizedKey)!;
        } else {
          const newSong = await insertSong(db, trimmedName);
          newSongMap.set(normalizedKey, newSong.id);
          resolvedSongId = newSong.id;
          created++;
        }
      }

      if (item.videoId) {
        if (!item.songId && item.createNewPreset !== false) {
          const preset = await insertSongPreset(db, resolvedSongId, {
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
            await updateSongPresetYoutubeRef(db, item.presetId, item.videoId, item.title);
          }
          appliedPresetId = item.presetId;
        } else if (item.songId && item.createNewPreset) {
          const preset = await insertSongPreset(db, resolvedSongId, {
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
          await db
            .update(contiSongs)
            .set({ ...stringifyContiSongOverrides(appliedPresetOverrides), updatedAt: new Date() })
            .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, resolvedSongId)));
        }
        const existingRows = await db
          .select({ id: contiSongs.id })
          .from(contiSongs)
          .where(and(eq(contiSongs.contiId, contiId), eq(contiSongs.songId, resolvedSongId)))
          .limit(1);
        importedRows.push({ contiSongId: existingRows[0]?.id ?? null, songId: resolvedSongId, songName: resolvedSongName });
        presetUpdated++;
      } else {
        const contiSong = await insertContiSong(
          db,
          contiId,
          resolvedSongId,
          nextSortOrder++,
          appliedPresetOverrides ?? undefined,
        );
        importedRows.push({ contiSongId: contiSong.id, songId: resolvedSongId, songName: resolvedSongName });
      }
    }

    for (let index = 0; index < items.length - 1; index++) {
      const mashupLink = items[index].mashupWithNext;
      if (!mashupLink) continue;

      const first = importedRows[index];
      const second = importedRows[index + 1];
      if (!first?.contiSongId || !second?.contiSongId || first.songId === second.songId) continue;

      let presetId = mashupLink.presetId;
      if (!presetId && mashupLink.createNewPreset !== false) {
        const blankPresetData = buildBlankMashupPresetData([first.songName, second.songName]);
        const createdPreset = await this.createMashupPreset(
          {
            songIds: [first.songId, second.songId],
            data: {
              ...blankPresetData,
              name: mashupLink.presetName.trim() || blankPresetData.name,
            },
          },
          null,
        );
        presetId = createdPreset.id;
      }

      if (presetId) {
        await this.applyMashupToContiSongs({
          contiId,
          firstContiSongId: first.contiSongId,
          secondContiSongId: second.contiSongId,
          presetId,
        });
        mashupsApplied++;
      }
    }

    return { added: items.length - presetUpdated, created, presetUpdated, mashupsApplied };
  },

  async createSongPreset(songId: string, data, resolvedYoutube: ResolvedYouTubeMetadata | null) {
    if (data.isDefault) {
      await db.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const nextSortOrder = await getNextPresetSortOrderForSong(songId);
    const now = new Date();
    const presetRecord: SongPreset = {
      id: generateId(),
      songId,
      presetType: "single",
      displayTitle: null,
      mashupPairKey: null,
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
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songPresets).values(presetRecord);
    await db.insert(songPresetSongs).values({
      id: `${presetRecord.id}:song:0`,
      presetId: presetRecord.id,
      songId,
      sortOrder: 0,
      partLabel: null,
    });

    if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
      await db.insert(presetSheetMusic).values(
        data.sheetMusicFileIds.map((fileId, index) => ({
          id: generateId(),
          presetId: presetRecord.id,
          sheetMusicFileId: fileId,
          sortOrder: index,
        })),
      );
    }

    return presetRecord;
  },

  async createMashupPreset({ songIds, data }, resolvedYoutube: ResolvedYouTubeMetadata | null) {
    if (songIds.length !== 2) {
      throw new Error("MASHUP_REQUIRES_TWO_SONGS");
    }
    if (songIds[0] === songIds[1]) {
      throw new Error("MASHUP_REQUIRES_DISTINCT_SONGS");
    }

    const nextSortOrder = await getNextPresetSortOrderForSong(songIds[0]);
    const mashupPairKey = getOrderedSongPairKey(songIds);
    const now = new Date();
    const presetRecord: SongPreset = {
      id: generateId(),
      songId: songIds[0],
      presetType: "mashup",
      displayTitle: data.displayTitle?.trim() || null,
      mashupPairKey,
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
      isDefault: false,
      sortOrder: nextSortOrder,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.insert(songPresets).values(presetRecord);
      await tx.insert(songPresetSongs).values(
        songIds.map((songId, index) => ({
          id: `${presetRecord.id}:song:${index}`,
          presetId: presetRecord.id,
          songId,
          sortOrder: index,
          partLabel: null,
        })),
      );

      if (data.sheetMusicFileIds && data.sheetMusicFileIds.length > 0) {
        await tx.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId: presetRecord.id,
            sheetMusicFileId: fileId,
            sortOrder: index,
          })),
        );
      }
    });

    return presetRecord;
  },

  async applyMashupToContiSongs(input) {
    const contiRows = await db
      .select()
      .from(contiSongs)
      .where(eq(contiSongs.contiId, input.contiId))
      .orderBy(asc(contiSongs.sortOrder), asc(contiSongs.id));
    const pair = getAdjacentOrderedContiSongPair(contiRows, [input.firstContiSongId, input.secondContiSongId]);

    if (!pair) {
      const foundCount = contiRows.filter(
        (row) => row.id === input.firstContiSongId || row.id === input.secondContiSongId,
      ).length;
      if (foundCount !== 2) throw new Error("MASHUP_PAIR_NOT_FOUND");
      throw new Error("MASHUP_REQUIRES_ADJACENT_ROWS");
    }
    if (pair[0].mashupGroupId || pair[1].mashupGroupId) throw new Error("MASHUP_ALREADY_GROUPED");

    const preset = await this.getSongPresetWithSheetMusic(input.presetId);
    if (!preset || preset.presetType !== "mashup") throw new Error("MASHUP_PRESET_NOT_FOUND");
    const members = preset.members.slice().sort((left, right) => left.sortOrder - right.sortOrder);
    if (members.length !== 2 || members[0].songId !== pair[0].songId || members[1].songId !== pair[1].songId) {
      throw new Error("MASHUP_PRESET_SONGS_MISMATCH");
    }

    const overrides = songPresetToContiOverrides(preset, preset.sheetMusicFileIds);
    const serialized = stringifyContiSongOverrides(overrides);
    const mashupGroupId = generateId();

    await db.transaction(async (tx) => {
      await tx.update(contiSongs).set({
        ...serialized,
        mashupGroupId,
        mashupPartOrder: 0,
        preMashupPresetId: pair[0].presetId,
        updatedAt: new Date(),
      }).where(eq(contiSongs.id, pair[0].id));

      await tx.update(contiSongs).set({
        ...serialized,
        mashupGroupId,
        mashupPartOrder: 1,
        preMashupPresetId: pair[1].presetId,
        updatedAt: new Date(),
      }).where(eq(contiSongs.id, pair[1].id));
    });

    return { mashupGroupId };
  },

  async splitMashup(input) {
    const rows = await db
      .select()
      .from(contiSongs)
      .where(and(eq(contiSongs.contiId, input.contiId), eq(contiSongs.mashupGroupId, input.mashupGroupId)))
      .orderBy(asc(contiSongs.mashupPartOrder));

    if (rows.length !== 2) throw new Error("MASHUP_GROUP_NOT_FOUND");

    const updates: Array<{ rowId: string; overrides: ReturnType<typeof stringifyContiSongOverrides> }> = [];
    for (const row of rows) {
      const restoredOverrides =
        input.mode === "restore" && row.preMashupPresetId
          ? await getPresetOverridesForSong(row.preMashupPresetId, row.songId)
          : null;
      const overrides =
        input.mode === "restore" && restoredOverrides
          ? stringifyContiSongOverrides(restoredOverrides)
          : stringifyContiSongOverrides({
              keys: [],
              tempos: [],
              sectionOrder: [],
              lyrics: [],
              sectionLyricsMap: {},
              notes: null,
              sheetMusicFileIds: null,
              presetId: null,
            });

      updates.push({ rowId: row.id, overrides });
    }

    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx.update(contiSongs).set({
          ...update.overrides,
          mashupGroupId: null,
          mashupPartOrder: null,
          preMashupPresetId: null,
          updatedAt: new Date(),
        }).where(eq(contiSongs.id, update.rowId));
      }
    });
  },

  async updateSongPreset(presetId: string, data, resolvedYoutube?: ResolvedYouTubeMetadata | null) {
    const existing = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    const songId = existing[0].songId;
    if (data.isDefault && existing[0].presetType === "mashup") {
      throw new Error("MASHUP_PRESET_CANNOT_BE_DEFAULT");
    }
    if (data.isDefault) {
      await db.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.displayTitle !== undefined) updateData.displayTitle = data.displayTitle?.trim() || null;
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

    await db.update(songPresets).set(updateData).where(eq(songPresets.id, presetId));

    if (data.sheetMusicFileIds !== undefined) {
      await db.delete(presetSheetMusic).where(eq(presetSheetMusic.presetId, presetId));
      if (data.sheetMusicFileIds.length > 0) {
        await db.insert(presetSheetMusic).values(
          data.sheetMusicFileIds.map((fileId, index) => ({
            id: generateId(),
            presetId,
            sheetMusicFileId: fileId,
            sortOrder: index,
          })),
        );
      }
    }

    const result = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    return result[0] ?? null;
  },

  async deleteSongPreset(presetId: string) {
    const existing = await db.select().from(songPresets).where(eq(songPresets.id, presetId)).limit(1);
    if (existing.length === 0) {
      return null;
    }

    await db.delete(songPresets).where(eq(songPresets.id, presetId));
    return existing[0];
  },

  async setDefaultPreset(songId: string, presetId: string) {
    const target = await db
      .select({ id: songPresets.id })
      .from(songPresets)
      .where(and(
        eq(songPresets.id, presetId),
        eq(songPresets.songId, songId),
        eq(songPresets.presetType, "single"),
      ))
      .limit(1);
    if (!target[0]) {
      throw new Error("DEFAULT_PRESET_NOT_FOUND");
    }

    await db.transaction(async (tx) => {
      await tx.update(songPresets).set({ isDefault: false }).where(eq(songPresets.songId, songId));
      await tx.update(songPresets)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(songPresets.id, presetId));
    });
  },

  async upsertContiPdfExport(contiId: string, data: { pdfUrl?: string | null; layoutState?: string | null }) {
    const existing = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.contiId, contiId))
      .limit(1);
    const now = new Date();

    if (existing.length > 0) {
      const updateData: Record<string, unknown> = { updatedAt: now };
      if ('pdfUrl' in data) updateData.pdfUrl = data.pdfUrl ?? null;
      if ('layoutState' in data) updateData.layoutState = data.layoutState ?? null;
      await db.update(contiPdfExports).set(updateData).where(eq(contiPdfExports.id, existing[0].id));
      return {
        ...existing[0],
        ...updateData,
        updatedAt: now,
      };
    }

    const newExport: ContiPdfExport = {
      id: generateId(),
      contiId,
      pdfUrl: data.pdfUrl ?? null,
      layoutState: data.layoutState ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(contiPdfExports).values(newExport);
    return newExport;
  },

  async deleteContiPdfExport(exportId: string) {
    const existing = await db
      .select()
      .from(contiPdfExports)
      .where(eq(contiPdfExports.id, exportId))
      .limit(1);

    if (existing.length === 0) {
      return null;
    }

    await db.delete(contiPdfExports).where(eq(contiPdfExports.id, exportId));
    return existing[0];
  },

  async createSongPageImage(data: SongPageImageInput) {
    const now = new Date();
    const record = {
      id: generateId(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(songPageImages).values(record);
    return record;
  },

  async deletePageImagesForConti(contiId: string) {
    const existing = await db
      .select()
      .from(songPageImages)
      .where(eq(songPageImages.contiId, contiId));

    await db.delete(songPageImages).where(eq(songPageImages.contiId, contiId));
    return existing;
  },
};
