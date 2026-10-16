'use server';

import type { ActionResult } from '@/lib/types';
import {
  getContiPraiseThreadStatus,
  postContiPraiseTemplate,
} from '@/lib/discord-sync/praise-template-message';

export interface ContiPraiseThreadResult {
  status: 'sent' | 'edited' | 'skipped';
  threadUrl: string | null;
  lastSentAt: string | null;
}

export async function postContiPraiseThread(contiId: string): Promise<ActionResult<ContiPraiseThreadResult>> {
  try {
    const status = await postContiPraiseTemplate(contiId);
    const threadStatus = await getContiPraiseThreadStatus(contiId);

    return {
      success: true,
      data: {
        status,
        threadUrl: threadStatus.threadUrl,
        lastSentAt: threadStatus.lastSentAt,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: '스레드에 올리는 중 오류가 발생했습니다',
    };
  }
}
