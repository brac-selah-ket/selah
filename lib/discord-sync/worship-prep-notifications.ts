import { getContiByDate } from '@/lib/queries/contis';
import { readWorshipDataByDate } from '@/lib/discord-sync/google-sheets';
import {
  getActiveForumThreads,
  getChannel,
  getThreadMessages,
  sendThreadMessage,
  type DiscordMessage,
} from '@/lib/discord-sync/discord-client';
import {
  resolveGuildId,
  selectWorshipThreadBySundayDate,
} from '@/lib/discord-sync/cron-state';
import {
  buildWorshipPrepReadyMessage,
  buildWorshipPrepUrl,
  isWorshipPrepReady,
  toIsoDateFromYYMMDD,
} from '@/lib/discord-sync/worship-prep-readiness';
import {
  WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  claimWorshipPrepNotification,
  getNotificationClaimSkipReason,
  getWorshipPrepNotification,
  markWorshipPrepNotificationFailed,
  markWorshipPrepNotificationSent,
  type WorshipPrepNotificationClaimReference,
  type WorshipPrepNotificationRecord,
} from '@/lib/discord-sync/worship-prep-notification-state';

export interface WorshipPrepReadyNotificationResult {
  success: boolean;
  status:
    | 'already-sent'
    | 'not-ready'
    | 'no-thread'
    | 'claimed-by-other'
    | 'sent'
    | 'error';
  error?: string;
  threadId?: string;
  messageId?: string;
}

export function resolveAppBaseUrl(origin?: string): string | null {
  const configured = process.env.APP_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured;
  }

  return origin?.trim() || null;
}

function hasActiveClaimReference(
  record: WorshipPrepNotificationRecord,
): record is WorshipPrepNotificationRecord & WorshipPrepNotificationClaimReference {
  return record.lastAttemptAt instanceof Date;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function findExistingWorshipPrepReadyMessage(
  threadId: string,
  content: string,
): Promise<DiscordMessage | null> {
  const messages = await getThreadMessages(threadId);
  return messages.find((message) => message.content === content && message.author.bot !== false) ?? null;
}

export async function findDiscordThreadForSundayDate(sundayDate: string) {
  const channelId = process.env.DISCORD_CHANNEL_ID?.trim();
  if (!channelId) {
    throw new Error('DISCORD_CHANNEL_ID must be set');
  }

  const configuredGuildId = process.env.DISCORD_GUILD_ID?.trim();
  const channel = configuredGuildId ? null : await getChannel(channelId);
  const guildId = resolveGuildId({
    configuredGuildId,
    channel,
  });

  if (!guildId) {
    throw new Error('DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID');
  }

  const threads = await getActiveForumThreads(guildId, channelId);
  return selectWorshipThreadBySundayDate(threads, sundayDate);
}

export async function checkAndSendWorshipPrepReadyNotification({
  sundayDate,
  origin,
}: {
  sundayDate: string;
  origin?: string;
}): Promise<WorshipPrepReadyNotificationResult> {
  try {
    const now = new Date();
    const existing = await getWorshipPrepNotification(sundayDate, WORSHIP_PREP_READY_NOTIFICATION_TYPE);
    const skipReason = getNotificationClaimSkipReason(existing, now);

    if (skipReason === 'already-sent') {
      return {
        success: true,
        status: 'already-sent',
        threadId: existing?.threadId ?? undefined,
        messageId: existing?.messageId ?? undefined,
      };
    }

    if (skipReason === 'recent-pending') {
      return {
        success: true,
        status: 'claimed-by-other',
        threadId: existing?.threadId ?? undefined,
      };
    }

    const isoDate = toIsoDateFromYYMMDD(sundayDate);
    const [row, conti] = await Promise.all([
      readWorshipDataByDate(isoDate),
      getContiByDate(isoDate),
    ]);

    if (!isWorshipPrepReady({ row, hasLinkedConti: Boolean(conti) })) {
      return { success: true, status: 'not-ready' };
    }

    const thread = await findDiscordThreadForSundayDate(sundayDate);
    if (!thread) {
      return { success: true, status: 'no-thread' };
    }

    const baseUrl = resolveAppBaseUrl(origin);
    if (!baseUrl) {
      return {
        success: false,
        status: 'error',
        error: 'APP_BASE_URL or NEXT_PUBLIC_APP_URL must be set',
      };
    }

    const claim = await claimWorshipPrepNotification(
      sundayDate,
      thread.id,
      WORSHIP_PREP_READY_NOTIFICATION_TYPE,
    );

    if (!claim.claimed || !claim.record) {
      return {
        success: true,
        status: claim.reason === 'already-sent' ? 'already-sent' : 'claimed-by-other',
        threadId: claim.record?.threadId ?? thread.id,
        messageId: claim.record?.messageId ?? undefined,
      };
    }

    if (!hasActiveClaimReference(claim.record)) {
      return {
        success: false,
        status: 'error',
        error: 'Claimed worship prep notification is missing lastAttemptAt',
        threadId: thread.id,
      };
    }

    const url = buildWorshipPrepUrl(baseUrl, isoDate);
    const message = buildWorshipPrepReadyMessage(url);
    const existingReadyMessage = await findExistingWorshipPrepReadyMessage(thread.id, message);

    if (existingReadyMessage) {
      try {
        await markWorshipPrepNotificationSent(claim.record, existingReadyMessage.id);
      } catch (error) {
        return {
          success: false,
          status: 'error',
          error: errorMessage(error, 'Existing Discord notification found but state update failed'),
          threadId: thread.id,
          messageId: existingReadyMessage.id,
        };
      }

      return {
        success: true,
        status: 'sent',
        threadId: thread.id,
        messageId: existingReadyMessage.id,
      };
    }

    let sent: { id: string };

    try {
      sent = await sendThreadMessage(thread.id, message);
    } catch (error) {
      await markWorshipPrepNotificationFailed(claim.record);
      return {
        success: false,
        status: 'error',
        error: errorMessage(error, 'Discord notification failed'),
        threadId: thread.id,
      };
    }

    try {
      await markWorshipPrepNotificationSent(claim.record, sent.id);
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: errorMessage(error, 'Discord notification sent but state update failed'),
        threadId: thread.id,
        messageId: sent.id,
      };
    }

    return {
      success: true,
      status: 'sent',
      threadId: thread.id,
      messageId: sent.id,
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      error: errorMessage(error, 'Worship prep readiness check failed'),
    };
  }
}
