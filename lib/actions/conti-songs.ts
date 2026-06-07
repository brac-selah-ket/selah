'use server';

import { revalidatePath } from 'next/cache';
import type {
  ActionResult,
  ContiSong,
  ContiSongOverrides,
  PdfLayoutState,
} from '@/lib/types';
import { createSongPreset, updateSongPreset } from './song-presets';
import { z } from 'zod';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { invalidateConti, invalidateSong, invalidateSongs } from '@/lib/cache/invalidation';

export async function addSongToConti(
  contiId: string,
  songId: string,
  initialOverrides?: Partial<ContiSongOverrides>
): Promise<ActionResult<ContiSong>> {
  try {
    const contiSong = await getStoryboardRepository().addSongToConti(contiId, songId, initialOverrides);
    invalidateConti(contiId);
    invalidateSong(songId);
    revalidatePath('/contis');

    return {
      success: true,
      data: contiSong,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티에 곡 추가 중 오류가 발생했습니다',
    };
  }
}

export async function removeSongFromConti(contiSongId: string): Promise<ActionResult> {
  try {
    const repository = getStoryboardRepository();
    const source = await repository.getContiSong(contiSongId);
    await repository.removeContiSong(contiSongId);
    if (source) {
      invalidateConti(source.contiId);
    }
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티에서 곡 제거 중 오류가 발생했습니다',
    };
  }
}

export async function updateContiSong(
  contiSongId: string,
  data: Partial<ContiSongOverrides>
): Promise<ActionResult> {
  try {
    const repository = getStoryboardRepository();
    const source = await repository.getContiSong(contiSongId);
    await repository.updateContiSong(contiSongId, data);
    if (source) {
      invalidateConti(source.contiId);
    }
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 곡 정보 수정 중 오류가 발생했습니다',
    };
  }
}

export async function reorderContiSongs(
  contiId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    await getStoryboardRepository().reorderContiSongs(contiId, orderedIds);
    invalidateConti(contiId);
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 곡 순서 변경 중 오류가 발생했습니다',
    };
  }
}

export async function saveContiSongAsPreset(
  contiSongId: string,
  presetName: string,
  existingPresetId?: string,
  options: { youtubeReference?: string | null; youtubeTitle?: string | null } = {},
): Promise<ActionResult> {
  try {
    const source = await getStoryboardRepository().getContiSongPresetSource(contiSongId);

    if (!source) {
      return { success: false, error: '콘티 곡을 찾을 수 없습니다' };
    }

    let result;
    const youtubeReference = options.youtubeReference;
    const youtubePayload =
      youtubeReference !== undefined
        ? { youtubeReference, youtubeTitle: options.youtubeTitle ?? null }
        : {};

    if (existingPresetId) {
      result = await updateSongPreset(existingPresetId, {
        name: presetName,
        keys: source.overrides.keys,
        tempos: source.overrides.tempos,
        sectionOrder: source.overrides.sectionOrder,
        lyrics: source.overrides.lyrics,
        sectionLyricsMap: source.overrides.sectionLyricsMap,
        notes: source.overrides.notes,
        sheetMusicFileIds: source.overrides.sheetMusicFileIds ?? [],
        pdfMetadata: source.pdfMetadata,
        ...youtubePayload,
      });
    } else {
      result = await createSongPreset(source.songId, {
        name: presetName,
        keys: source.overrides.keys,
        tempos: source.overrides.tempos,
        sectionOrder: source.overrides.sectionOrder,
        lyrics: source.overrides.lyrics,
        sectionLyricsMap: source.overrides.sectionLyricsMap,
        notes: source.overrides.notes,
        sheetMusicFileIds: source.overrides.sheetMusicFileIds ?? [],
        pdfMetadata: source.pdfMetadata,
        isDefault: false,
        ...youtubePayload,
      });
    }

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch {
    return { success: false, error: '프리셋 저장 중 오류가 발생했습니다' };
  }
}

export async function syncPresetPdfMetadataFromContiLayout(
  contiId: string,
  layoutStateText: string,
): Promise<ActionResult<{ updatedPresetCount: number }>> {
  try {
    const parsed = JSON.parse(layoutStateText) as PdfLayoutState;
    const result = await getStoryboardRepository().syncPresetPdfMetadataFromContiLayout(contiId, parsed);

    return {
      success: true,
      data: result,
    };
  } catch {
    return {
      success: false,
      error: '프리셋 PDF 메타데이터 동기화 중 오류가 발생했습니다',
    };
  }
}

const batchImportItemSchema = z.object({
  songId: z.string().nullable(),
  newSongName: z.string().nullable(),
  videoId: z.string().nullable().optional().default(null),
  title: z.string().nullable().optional().default(null),
  presetId: z.string().nullable().optional().default(null),
  createNewPreset: z.boolean().optional().default(false),
  presetName: z.string().nullable().optional().default(null),
  alreadyInConti: z.boolean().optional().default(false),
  replaceExistingYoutube: z.boolean().optional().default(true),
})

const batchImportSchema = z.object({
  contiId: z.string().min(1),
  items: z.array(batchImportItemSchema).min(1, '가져올 곡이 없습니다'),
})

export async function batchImportSongsToConti(
  contiId: string,
  items: Array<{
    songId: string | null
    newSongName: string | null
    videoId?: string | null
    title?: string | null
    presetId?: string | null
    createNewPreset?: boolean
    presetName?: string | null
    alreadyInConti?: boolean
    replaceExistingYoutube?: boolean
  }>
): Promise<ActionResult<{ added: number; created: number; presetUpdated: number }>> {
  try {
    const validation = batchImportSchema.safeParse({ contiId, items })
    if (!validation.success) {
      return { success: false, error: '가져올 곡 목록이 올바르지 않습니다' }
    }

    const validatedItems = validation.data.items

    // Manual refine check (Zod 4 .refine() inside .array() is unreliable)
    for (const item of validatedItems) {
      if (item.songId === null && (item.newSongName === null || item.newSongName.trim().length === 0)) {
        return { success: false, error: '곡 ID 또는 새 곡 이름이 필요합니다' }
      }
    }

    const result = await getStoryboardRepository().batchImportSongsToConti(contiId, validatedItems)

    invalidateConti(contiId)
    invalidateSongs()
    const existingSongIds = new Set(
      validatedItems
        .map((item) => item.songId)
        .filter((songId): songId is string => Boolean(songId))
    )
    for (const songId of existingSongIds) {
      invalidateSong(songId)
    }

    revalidatePath('/contis')
    revalidatePath('/songs')

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('[batchImportSongsToConti]', error)
    const message = error instanceof Error ? error.message : ''
    if (message === 'PRESET_NOT_FOUND') {
      return { success: false, error: '선택한 프리셋을 찾을 수 없습니다' }
    }
    if (
      message.includes('conti_song_unique') ||
      message.includes('UNIQUE constraint failed: conti_songs.conti_id, conti_songs.song_id')
    ) {
      return {
        success: false,
        error: '이미 콘티에 포함된 곡이 있습니다. 중복 곡을 제거하고 다시 시도해주세요',
      }
    }
    return {
      success: false,
      error: '곡 일괄 추가 중 오류가 발생했습니다',
    }
  }
}
