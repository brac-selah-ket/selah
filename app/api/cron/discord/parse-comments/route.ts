import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { addMessageReaction, getActiveForumThreads, getChannel, getThreadMessages } from '@/lib/discord-sync/discord-client';
import { parseDiscordMessages } from '@/lib/discord-parser';
import { correctSpelling } from '@/lib/discord-sync/spell-checker';
import { findRowByDate, updateWorshipData } from '@/lib/discord-sync/google-sheets';
import { checkAndSendWorshipPrepReadyNotification } from '@/lib/discord-sync/worship-prep-notifications';
import {
  PARSED_REACTION,
  hasProcessedReaction,
  resolveGuildId,
  selectTargetWorshipThread,
  toSheetDateFromYYMMDD,
} from '@/lib/discord-sync/cron-state';

export const maxDuration = 60;
const SHEET_NAME = 'DB';

function hasParsedData(data?: { preacher?: string; leader?: string; worshipLeader?: string; title?: string; scripture?: string; songs?: string[] }): boolean {
  if (!data) return false;
  if (data.preacher || data.leader || data.worshipLeader || data.title || data.scripture) return true;
  return Boolean(data.songs && data.songs.length > 0);
}

async function safelyCheckWorshipPrepReadyNotification(input: { sundayDate: string; origin?: string }) {
  try {
    const result = await checkAndSendWorshipPrepReadyNotification(input);
    if (!result.success) console.error('[checkAndSendWorshipPrepReadyNotification]', result.error ?? result.status);
  } catch (error) {
    console.error('[checkAndSendWorshipPrepReadyNotification]', error);
  }
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      throw new Error('DISCORD_CHANNEL_ID must be set');
    }

    const guildId = resolveGuildId({
      configuredGuildId,
      channel: configuredGuildId?.trim() ? null : await getChannel(channelId),
    });
    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID is not set and guild_id could not be resolved from DISCORD_CHANNEL_ID');
    }

    const activeThread = selectTargetWorshipThread(await getActiveForumThreads(guildId, channelId));
    if (!activeThread) {
      return NextResponse.json({ success: true, message: 'No active thread found' });
    }

    const messages = await getThreadMessages(activeThread.id);
    const newMessages = messages.filter((message) => !message.author.bot && !hasProcessedReaction(message));

    if (newMessages.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new messages',
      });
    }

    const parsedMessages = parseDiscordMessages(
      newMessages.map((message) => ({
        id: message.id,
        content: message.content,
        timestamp: message.timestamp,
        author: {
          id: message.author.id,
          username: message.author.username,
          globalName: message.author.global_name,
        },
      }))
    );

    const mergedData: {
      preacher?: string;
      leader?: string;
      worshipLeader?: string;
      title?: string;
      scripture?: string;
      songs?: string[];
    } = {};
    const parsedMessageIds = new Set<string>();

    for (let index = 0; index < parsedMessages.length; index += 1) {
      const parsed = parsedMessages[index]?.parsedData;
      const parsedSuccess = hasParsedData(parsed);

      if (!parsedSuccess || !parsed) {
        continue;
      }

      const message = newMessages[index];
      if (message) {
        parsedMessageIds.add(message.id);
      }

      if (parsed.title) mergedData.title = parsed.title;
      if (parsed.scripture) mergedData.scripture = parsed.scripture;
      if (parsed.songs && parsed.songs.length > 0) mergedData.songs = parsed.songs;
    }

    if (Object.keys(mergedData).length > 0) {
      const formattedDate = toSheetDateFromYYMMDD(activeThread.sundayDate);
      const targetRow = await findRowByDate(SHEET_NAME, formattedDate);
      if (!targetRow) {
        return NextResponse.json(
          {
            success: false,
            message: `No matching date row for ${formattedDate}`,
          },
          { status: 404 }
        );
      }

      if (mergedData.title) {
        mergedData.title = await correctSpelling(mergedData.title);
      }
      await updateWorshipData(SHEET_NAME, targetRow, mergedData);
      await safelyCheckWorshipPrepReadyNotification({ sundayDate: activeThread.sundayDate, origin: new URL(request.url).origin });
    }

    for (const message of newMessages.filter((message) => parsedMessageIds.has(message.id))) {
      try {
        await addMessageReaction(message.channel_id, message.id, PARSED_REACTION);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: Object.keys(mergedData).length > 0 ? `Processed ${parsedMessageIds.size} parsed messages` : 'No parsable data',
      data: {
        threadId: activeThread.id,
        processedCount: parsedMessageIds.size,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
