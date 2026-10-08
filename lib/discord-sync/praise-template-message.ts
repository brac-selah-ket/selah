import { editThreadMessage, getThreadMessages, sendThreadMessage } from '@/lib/discord-sync/discord-client';
import { findDiscordThreadForSundayDate } from '@/lib/discord-sync/worship-prep-notifications';
import { toYYMMDDFromIsoDate } from '@/lib/discord-sync/worship-prep-readiness';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { buildArrangementItems } from '@/lib/utils/arrangement-items';
import type { ArrangementItem } from '@/lib/types';

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

export async function postContiPraiseTemplate(contiId: string): Promise<'sent' | 'edited' | 'skipped'> {
  const conti = await getStoryboardRepository().getConti(contiId);
  if (!conti) return 'skipped';

  const content = buildPraiseTemplateMessage(
    buildArrangementItems(conti.songs).map((item) => praiseSlotTitle(item)),
  );
  // A conti with no songs yet leaves any previously posted template message
  // alone — there is nothing meaningful to send or edit it to.
  if (!content) return 'skipped';

  const thread = await findDiscordThreadForSundayDate(toYYMMDDFromIsoDate(conti.date));
  if (!thread) return 'skipped';

  const messages = await getThreadMessages(thread.id);
  const existing = messages.find(
    (message) => message.author.bot && isContiPraiseTemplateMessage(message.content),
  );

  if (!existing) {
    await sendThreadMessage(thread.id, content);
    return 'sent';
  }

  if (existing.content.trim() === content) return 'skipped';

  await editThreadMessage(thread.id, existing.id, content);
  return 'edited';
}
