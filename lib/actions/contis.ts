'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionResult, Conti } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
import { toYYMMDDFromIsoDate } from '@/lib/discord-sync/worship-prep-readiness';

const contiSchema = z.object({
  title: z.string().transform(v => v.trim() || null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)'),
  description: z.string().optional(),
});

async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}

async function safelyCheckWorshipPrepReadyNotificationForIsoDate(isoDate: string) {
  try {
    const sundayDate = toYYMMDDFromIsoDate(isoDate);
    await safelyCheckWorshipPrepReadyNotification({ sundayDate });
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}

export async function createConti(formData: FormData): Promise<ActionResult<Conti>> {
  try {
    const title = formData.get('title');
    const date = formData.get('date');
    const description = formData.get('description');

    const validation = contiSchema.safeParse({ title, date, description });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const conti = await getStoryboardRepository().createConti({
      title: validation.data.title,
      date: validation.data.date,
      description: validation.data.description || null,
    });
    revalidatePath('/contis');
    await safelyCheckWorshipPrepReadyNotificationForIsoDate(conti.date);

    return {
      success: true,
      data: conti,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 생성 중 오류가 발생했습니다',
    };
  }
}

export async function updateConti(id: string, formData: FormData): Promise<ActionResult<Conti>> {
  try {
    const title = formData.get('title');
    const date = formData.get('date');
    const description = formData.get('description');

    const validation = contiSchema.safeParse({ title, date, description });

    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const result = await getStoryboardRepository().updateConti(id, {
      title: validation.data.title,
      date: validation.data.date,
      description: validation.data.description || null,
    });
    revalidatePath('/contis');
    if (result) {
      await safelyCheckWorshipPrepReadyNotificationForIsoDate(result.date);
    }

    return {
      success: true,
      data: result ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 수정 중 오류가 발생했습니다',
    };
  }
}

export async function deleteConti(id: string): Promise<ActionResult> {
  try {
    await getStoryboardRepository().deleteConti(id);
    revalidatePath('/contis');

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: '콘티 삭제 중 오류가 발생했습니다',
    };
  }
}
