'use server';

import type { ActionResult, SongPageImage } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { deleteObject, putObject } from '@/lib/storage';

export async function saveSongPageImageFromForm(formData: FormData): Promise<ActionResult<SongPageImage>> {
  try {
    const file = formData.get('file') as File;
    const songId = formData.get('songId') as string;
    const contiId = formData.get('contiId') as string;
    const pageIndex = parseInt(formData.get('pageIndex') as string, 10);
    const sheetMusicFileId = (formData.get('sheetMusicFileId') as string) || null;
    const pdfPageIndex = formData.get('pdfPageIndex') as string;
    const presetSnapshot = formData.get('presetSnapshot') as string;

    if (!file || !songId || !contiId) {
      return { success: false, error: '필수 데이터가 누락되었습니다' };
    }

    const object = await putObject(
      `song-pages/${songId}/${contiId}-p${pageIndex}.jpg`,
      file,
      { allowOverwrite: true, contentType: file.type || 'image/jpeg' }
    );

    const record = await getStoryboardRepository().createSongPageImage({
      songId,
      contiId,
      imageUrl: object.url,
      pageIndex,
      sheetMusicFileId,
      pdfPageIndex: pdfPageIndex ? parseInt(pdfPageIndex, 10) : null,
      presetSnapshot,
    });
    return { success: true, data: record };
  } catch {
    return { success: false, error: '페이지 이미지 저장 중 오류가 발생했습니다' };
  }
}

export async function deletePageImagesForConti(contiId: string): Promise<ActionResult> {
  try {
    const repository = getStoryboardRepository();
    const existing = await repository.getPageImagesForConti(contiId);

    await Promise.allSettled(
      existing.map(img => deleteObject(img.imageUrl).catch(() => {}))
    );

    await repository.deletePageImagesForConti(contiId);
    return { success: true };
  } catch {
    return { success: false, error: '페이지 이미지 삭제 중 오류가 발생했습니다' };
  }
}

export async function getPageImagesForSong(songId: string): Promise<ActionResult<SongPageImage[]>> {
  try {
    const images = await getStoryboardRepository().getPageImagesForSong(songId);
    return { success: true, data: images };
  } catch {
    return { success: false, error: '페이지 이미지를 불러올 수 없습니다' };
  }
}
