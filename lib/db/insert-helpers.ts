import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { NeonHttpQueryResultHKT } from 'drizzle-orm/neon-http'
import type * as schema from '@/lib/db/schema'
import { songs, contiSongs, songPresets, songPresetSongs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '@/lib/id'
import { stringifyContiSongOverrides } from '@/lib/db/helpers'
import type { ContiSongOverrides } from '@/lib/types'

// Shared type that accepts both `db` and transaction `tx` handles.
// NeonHttpDatabase extends PgDatabase, and PgTransaction also extends PgDatabase,
// so this is the correct shared base class.
export type TxOrDb = PgDatabase<NeonHttpQueryResultHKT, typeof schema>

async function getNextPresetSortOrderForSong(tx: TxOrDb, songId: string): Promise<number> {
  const existing = await tx
    .select({ sortOrder: songPresets.sortOrder })
    .from(songPresetSongs)
    .innerJoin(songPresets, eq(songPresetSongs.presetId, songPresets.id))
    .where(eq(songPresetSongs.songId, songId))

  return existing.length > 0 ? Math.max(...existing.map((row) => row.sortOrder)) + 1 : 0
}

/** Insert a song within a transaction (or standalone). No revalidation. */
export async function insertSong(tx: TxOrDb, name: string) {
  const now = new Date()
  const song = {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
  }
  await tx.insert(songs).values(song)
  return song
}

/** Insert a conti_song junction row within a transaction. No revalidation. */
export async function insertContiSong(
  tx: TxOrDb,
  contiId: string,
  songId: string,
  sortOrder: number,
  overrides?: Partial<ContiSongOverrides>
) {
  const now = new Date()
  const serialized = overrides
    ? stringifyContiSongOverrides(overrides)
    : { keys: '[]', tempos: '[]', sectionOrder: '[]', lyrics: '[]', sectionLyricsMap: '{}' }

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
    mashupGroupId: null,
    mashupPartOrder: null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
  }
  await tx.insert(contiSongs).values(contiSong)
  return contiSong
}

/** Insert a song_preset row. No revalidation. */
export async function insertSongPreset(
  tx: TxOrDb,
  songId: string,
  data: { name: string; youtubeReference?: string | null; youtubeTitle?: string | null }
) {
  const now = new Date()
  const nextSortOrder = await getNextPresetSortOrderForSong(tx, songId)

  const preset = {
    id: generateId(),
    songId,
    presetType: 'single' as const,
    displayTitle: null,
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
    sortOrder: nextSortOrder,
    createdAt: now,
    updatedAt: now,
  }
  await tx.insert(songPresets).values(preset)
  await tx.insert(songPresetSongs).values({
    id: `${preset.id}:song:0`,
    presetId: preset.id,
    songId,
    sortOrder: 0,
    partLabel: null,
  })
  return preset
}

/** Update a song_preset's youtubeReference. No revalidation. */
export async function updateSongPresetYoutubeRef(
  tx: TxOrDb,
  presetId: string,
  youtubeReference: string | null,
  youtubeTitle?: string | null,
) {
  await tx
    .update(songPresets)
    .set({ youtubeReference, youtubeTitle: youtubeReference ? youtubeTitle ?? null : null, updatedAt: new Date() })
    .where(eq(songPresets.id, presetId))
}
