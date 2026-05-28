import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getActiveForumThreads, getChannel, sendDropdownMessage } from '@/lib/discord-sync/discord-client';
import { resolveGuildId, selectTargetWorshipThread } from '@/lib/discord-sync/cron-state';
import { readRoleOptionsFromSheet } from '@/lib/discord-sync/google-sheets';

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const configuredGuildId = process.env.DISCORD_GUILD_ID;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ success: false, message: 'DISCORD_CHANNEL_ID must be set' }, { status: 500 });
  }

  const guildId = resolveGuildId({
    configuredGuildId,
    channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
  });
  if (!guildId) {
    return NextResponse.json(
      { success: false, message: 'DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID' },
      { status: 500 }
    );
  }

  const activeThread = selectTargetWorshipThread(await getActiveForumThreads(guildId, channelId));
  if (!activeThread) {
    return NextResponse.json({ success: false, message: 'No active thread' }, { status: 404 });
  }

  const options = (await readRoleOptionsFromSheet()).map((value) => ({ label: value, value }));
  if (options.length === 0) {
    return NextResponse.json({ success: false, message: 'DB_Options is empty' }, { status: 400 });
  }

  await sendDropdownMessage(activeThread.id, '설교자를 선택하세요', 'preacher-select', '설교자 선택', options);
  await sendDropdownMessage(activeThread.id, '인도자를 선택하세요', 'leader-select', '인도자 선택', options);
  await sendDropdownMessage(activeThread.id, '찬양 인도자를 선택하세요', 'worship-leader-select', '찬양 인도자 선택', options);

  return NextResponse.json({ success: true, threadId: activeThread.id });
}
