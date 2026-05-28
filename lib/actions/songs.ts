'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, Song } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

const songSchema = z.object({
  name: z.string().min(1, '곡 이름을 입력해주세요'),
});

export async function createSong(formData: FormData): Promise<ActionResult<Song>> {
  try {
    const name = formData.get('name');
    const validation = songSchema.safeParse({ name });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const song = await getStoryboardRepository().createSong(validation.data.name);
    revalidatePath('/songs');

    return {
      success: true,
      data: song,
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 생성 중 오류가 발생했습니다',
    };
  }
}

export async function updateSong(id: string, formData: FormData): Promise<ActionResult<Song>> {
  try {
    const name = formData.get('name');
    const validation = songSchema.safeParse({ name });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const result = await getStoryboardRepository().updateSong(id, { name: validation.data.name });
    revalidatePath('/songs');

    return {
      success: true,
      data: result ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 수정 중 오류가 발생했습니다',
    };
  }
}

export async function deleteSong(id: string): Promise<ActionResult> {
  try {
    const result = await getStoryboardRepository().deleteSong(id);

    if (result.blockedByConti) {
      return {
        success: false,
        error: '이 곡은 콘티에서 사용 중이므로 삭제할 수 없습니다',
      };
    }

    revalidatePath('/songs');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '곡 삭제 중 오류가 발생했습니다',
    };
  }
}
