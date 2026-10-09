import { editThreadMessage, getThreadMessages, sendThreadMessage } from '@/lib/discord-sync/discord-client';
import { toSheetDateFromYYMMDD } from '@/lib/discord-sync/cron-state';
import { findRowByDate, updateContiSongsInSheet } from '@/lib/discord-sync/google-sheets';
import { findDiscordThreadForSundayDate, resolveDiscordGuildId } from '@/lib/discord-sync/worship-prep-notifications';
import { toYYMMDDFromIsoDate } from '@/lib/discord-sync/worship-prep-readiness';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { buildArrangementItems } from '@/lib/utils/arrangement-items';
import type { ArrangementItem } from '@/lib/types';

const SHEET_NAME = 'DB';

export function praiseSlotTitle(item: Pick<ArrangementItem, 'type' | 'displayTitle' | 'displaySongNames' | 'primarySong'>): string {
  if (item.type !== 'mashup') return item.displayTitle.trim();

  const custom = item.primarySong.appliedPreset?.displayTitle?.trim();
  if (custom) return custom;

  const names = item.displaySongNames.map((name) => name.trim()).filter(Boolean);
  if (names.length >= 2) return `${names[0]} × ${names[1]}`;
  return names[0] || item.displayTitle.trim();
}

export function buildPraiseTemplateMessage(titles: readonly string[]): string | null {
  const names = titles.map((title) => title.trim()).filter(Boolean);
  if (names.length === 0) return null;
  return `찬양: ${names.join(' - ')}`;
}

export function isContiPraiseTemplateMessage(content: string): boolean {
  return /^찬양\s*[:：]\s*\S/.test(content.trim());
}

async function syncContiSongsToSheet(isoDate: string, songTitles: readonly string[]): Promise<void> {
  const formattedDate = toSheetDateFromYYMMDD(toYYMMDDFromIsoDate(isoDate));
  const row = await findRowByDate(SHEET_NAME, formattedDate);
  if (!row) {
    throw new Error(`No matching DB sheet row for ${formattedDate}`);
  }

  await updateContiSongsInSheet(SHEET_NAME, row, songTitles);
}

export async function postContiPraiseTemplate(contiId: string): Promise<'sent' | 'edited' | 'skipped'> {
  const conti = await getStoryboardRepository().getConti(contiId);
  if (!conti) return 'skipped';

  const titles = buildArrangementItems(conti.songs).map((item) => praiseSlotTitle(item));
  const content = buildPraiseTemplateMessage(titles);
  // A conti with no songs yet leaves any previously posted template message
  // (and the sheet's song columns) alone — there is nothing meaningful to
  // send, edit, or sync yet.
  if (!content) return 'skipped';

  const thread = await findDiscordThreadForSundayDate(toYYMMDDFromIsoDate(conti.date));
  if (!thread) return 'skipped';

  const messages = await getThreadMessages(thread.id);
  const existing = messages.find(
    (message) => message.author.bot && isContiPraiseTemplateMessage(message.content),
  );

  let result: 'sent' | 'edited';
  if (!existing) {
    await sendThreadMessage(thread.id, content);
    result = 'sent';
  } else if (existing.content.trim() === content) {
    return 'skipped';
  } else {
    await editThreadMessage(thread.id, existing.id, content);
    result = 'edited';
  }

  try {
    await syncContiSongsToSheet(conti.date, titles.map((title) => title.trim()).filter(Boolean));
  } catch (error) {
    console.error('[postContiPraiseTemplate] sheet sync failed', error);
  }

  return result;
}

export interface ContiPraiseThreadStatus {
  threadUrl: string | null;
  lastSentAt: string | null;
}

// Read-only counterpart of postContiPraiseTemplate — resolves the conti's
// worship thread and existing bot message without sending or editing
// anything, for the "스레드에 올리기" button's disabled/label state.
export async function getContiPraiseThreadStatus(contiId: string): Promise<ContiPraiseThreadStatus> {
  try {
    const conti = await getStoryboardRepository().getConti(contiId);
    if (!conti) return { threadUrl: null, lastSentAt: null };

    const channelId = process.env.DISCORD_CHANNEL_ID?.trim();
    if (!channelId) return { threadUrl: null, lastSentAt: null };

    const [thread, guildId] = await Promise.all([
      findDiscordThreadForSundayDate(toYYMMDDFromIsoDate(conti.date)),
      resolveDiscordGuildId(channelId),
    ]);

    if (!thread || !guildId) return { threadUrl: null, lastSentAt: null };

    const messages = await getThreadMessages(thread.id);
    const existing = messages.find(
      (message) => message.author.bot && isContiPraiseTemplateMessage(message.content),
    );

    return {
      threadUrl: `https://discord.com/channels/${guildId}/${thread.id}`,
      lastSentAt: existing?.edited_timestamp ?? existing?.timestamp ?? null,
    };
  } catch (error) {
    console.error('[getContiPraiseThreadStatus]', error);
    return { threadUrl: null, lastSentAt: null };
  }
}
