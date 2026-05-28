'use server';

import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';
import type { ActionResult, SheetMusicFile } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadSheetMusic(
  songId: string,
  formData: FormData
): Promise<ActionResult<SheetMusicFile>> {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: '파일을 선택해주세요',
      };
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: '지원하지 않는 파일 형식입니다 (PNG, JPEG, WebP, PDF만 가능)',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: '파일 크기는 10MB 이하여야 합니다',
      };
    }

    // Upload to Vercel Blob
    const blob = await put(file.name, file, {
      access: 'public',
    });

    const sheetMusicFile = await getStoryboardRepository().createSheetMusicFile({
      songId,
      fileUrl: blob.url,
      fileName: file.name,
      fileType: file.type,
    });
    revalidatePath('/songs');

    return {
      success: true,
      data: sheetMusicFile,
    };
  } catch (error) {
    return {
      success: false,
      error: '악보 업로드 중 오류가 발생했습니다',
    };
  }
}

export async function deleteSheetMusic(fileId: string): Promise<ActionResult> {
  try {
    const repository = getStoryboardRepository();
    const file = await repository.getSheetMusicFile(fileId);

    if (!file) {
      return {
        success: false,
        error: '파일을 찾을 수 없습니다',
      };
    }

    // Delete from Vercel Blob
    await del(file.fileUrl);

    // Delete DB record
    await repository.deleteSheetMusicFile(fileId);
    revalidatePath('/songs');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '악보 삭제 중 오류가 발생했습니다',
    };
  }
}

export async function reorderSheetMusic(
  songId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    await getStoryboardRepository().reorderSheetMusic(songId, orderedIds);
    revalidatePath('/songs');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '악보 순서 변경 중 오류가 발생했습니다',
    };
  }
}

export async function getSheetMusicForSong(songId: string): Promise<ActionResult<SheetMusicFile[]>> {
  try {
    const files = await getStoryboardRepository().getSheetMusicForSong(songId);
    return { success: true, data: files };
  } catch {
    return { success: false, error: '악보 목록을 불러올 수 없습니다' };
  }
}
