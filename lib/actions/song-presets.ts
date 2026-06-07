'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, SongPreset, SongPresetData, SongPresetWithSheetMusic } from '@/lib/types';
import { invalidateSongPresets } from '@/lib/cache/invalidation';
import { getSongPresets, getSongPresetsWithSheetMusic } from '@/lib/queries/songs';
import { resolveYouTubeReferenceMetadata } from '@/lib/actions/youtube-metadata';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

const presetSchema = z.object({
  name: z.string().min(1, '프리셋 이름을 입력해주세요'),
  keys: z.array(z.string()).optional().default([]),
  tempos: z.array(z.number()).optional().default([]),
  sectionOrder: z.array(z.string()).optional().default([]),
  lyrics: z.array(z.string()).optional().default([]),
  sectionLyricsMap: z.record(z.string(), z.array(z.number())).optional().default({}),
  notes: z.string().nullable().optional().default(null),
  isDefault: z.boolean().optional().default(false),
  youtubeReference: z.string().nullable().optional().default(null),
  youtubeTitle: z.string().nullable().optional().default(null),
  sheetMusicFileIds: z.array(z.string()).optional().default([]),
  pdfMetadata: z.unknown().nullable().optional().default(null),
});

export async function createSongPreset(songId: string, data: SongPresetData): Promise<ActionResult<SongPreset>> {
  try {
    const validation = presetSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0].message };
    }

    const d = validation.data as SongPresetData;
    const resolvedYoutube = await resolveYouTubeReferenceMetadata(d.youtubeReference, d.youtubeTitle);

    const preset = await getStoryboardRepository().createSongPreset(songId, d, resolvedYoutube);

    invalidateSongPresets(songId);
    revalidatePath(`/songs/${songId}`);
    return { success: true, data: preset };
  } catch {
    return { success: false, error: '프리셋 생성 중 오류가 발생했습니다' };
  }
}

export async function updateSongPreset(presetId: string, data: Partial<SongPresetData>): Promise<ActionResult<SongPreset>> {
  try {
    const resolvedYoutube =
      data.youtubeReference !== undefined
        ? await resolveYouTubeReferenceMetadata(data.youtubeReference, data.youtubeTitle)
        : undefined;

    const updatedPreset = await getStoryboardRepository().updateSongPreset(presetId, data, resolvedYoutube);
    if (!updatedPreset) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    invalidateSongPresets(updatedPreset.songId);
    revalidatePath(`/songs/${updatedPreset.songId}`);
    return { success: true, data: updatedPreset };
  } catch {
    return { success: false, error: '프리셋 수정 중 오류가 발생했습니다' };
  }
}

export async function deleteSongPreset(presetId: string): Promise<ActionResult> {
  try {
    const existing = await getStoryboardRepository().deleteSongPreset(presetId);
    if (!existing) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    invalidateSongPresets(existing.songId);
    revalidatePath(`/songs/${existing.songId}`);
    return { success: true };
  } catch {
    return { success: false, error: '프리셋 삭제 중 오류가 발생했습니다' };
  }
}

export async function setDefaultPreset(songId: string, presetId: string): Promise<ActionResult> {
  try {
    await getStoryboardRepository().setDefaultPreset(songId, presetId);
    invalidateSongPresets(songId);
    revalidatePath(`/songs/${songId}`);
    return { success: true };
  } catch {
    return { success: false, error: '기본 프리셋 설정 중 오류가 발생했습니다' };
  }
}

// Server action wrapper for lazy loading presets in client components
export async function getPresetsForSong(songId: string): Promise<ActionResult<SongPreset[]>> {
  try {
    const presets = await getSongPresets(songId);
    return { success: true, data: presets };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}

export async function getPresetSheetMusicFileIds(presetId: string): Promise<string[]> {
  return await getStoryboardRepository().getPresetSheetMusicFileIds(presetId);
}

export async function getPresetsForSongWithSheetMusic(songId: string): Promise<ActionResult<SongPresetWithSheetMusic[]>> {
  try {
    const presets = await getSongPresetsWithSheetMusic(songId);
    return { success: true, data: presets };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}

export async function getSongPresetWithSheetMusic(presetId: string): Promise<ActionResult<SongPresetWithSheetMusic>> {
  try {
    const preset = await getStoryboardRepository().getSongPresetWithSheetMusic(presetId);
    if (!preset) {
      return { success: false, error: '프리셋을 찾을 수 없습니다' };
    }

    return {
      success: true,
      data: preset,
    };
  } catch {
    return { success: false, error: '프리셋을 불러올 수 없습니다' };
  }
}
