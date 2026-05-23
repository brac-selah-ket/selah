import { NextRequest, NextResponse } from 'next/server';
import { addMessageReaction, getActiveForumThreads, getThreadMessages } from '@/lib/discord-sync/discord-client';
import { parseDiscordMessages } from '@/lib/discord-parser';
import { correctSpelling } from '@/lib/discord-sync/spell-checker';
import { findRowByDate, updateWorshipData } from '@/lib/discord-sync/google-sheets';
import {
  IGNORED_REACTION,
  PARSED_REACTION,
  hasProcessedReaction,
  selectTargetWorshipThread,
  toSheetDateFromYYMMDD,
} from '@/lib/discord-sync/cron-state';

export const maxDuration = 60;
const SHEET_NAME = 'DB';

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.DISCORD_CRON_SECRET;
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

function hasParsedData(data?: { preacher?: string; leader?: string; worshipLeader?: string; title?: string; scripture?: string; songs?: string[] }): boolean {
  if (!data) return false;
  if (data.preacher || data.leader || data.worshipLeader || data.title || data.scripture) return true;
  return Boolean(data.songs && data.songs.length > 0);
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!guildId || !channelId) {
      throw new Error('DISCORD_GUILD_ID and DISCORD_CHANNEL_ID must be set');
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
    }

    for (const message of newMessages) {
      const reaction = parsedMessageIds.has(message.id) ? PARSED_REACTION : IGNORED_REACTION;
      try {
        await addMessageReaction(message.channel_id, message.id, reaction);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: Object.keys(mergedData).length > 0 ? `Processed ${newMessages.length} new messages` : 'No parsable data',
      data: {
        threadId: activeThread.id,
        processedCount: newMessages.length,
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
