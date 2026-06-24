import { mergeParsedWorshipData, parseDiscordMessages } from '@/lib/discord-parser';
import type { DiscordMessage } from '@/lib/discord-sync/discord-client';
import {
  attachContiToActiveThread,
  getProcessedMessageIds,
  markMessageProcessed,
} from '@/lib/discord-sync/state-store';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

function toISODateFromYYMMDD(value: string): string {
  const year = `20${value.slice(0, 2)}`;
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  return `${year}-${month}-${day}`;
}

function buildContiDescription(sourceThreadId: string): string {
  return `discord-thread:${sourceThreadId}`;
}

async function findOrCreateSongId(songName: string): Promise<string> {
  const repository = getStoryboardRepository();
  const normalizedName = songName.trim();
  if (!normalizedName) {
    throw new Error('Song name is empty');
  }

  const existing = (await repository.searchSongs(normalizedName)).find(
    (song) => song.name.toLowerCase() === normalizedName.toLowerCase(),
  );

  if (existing) {
    return existing.id;
  }

  const created = await repository.createSong(normalizedName);
  return created.id;
}

async function upsertContiByDate(
  date: string,
  title: string | null,
  description: string | null,
): Promise<string> {
  const repository = getStoryboardRepository();
  const existing = await repository.getContiByDate(date);

  if (existing) {
    await repository.updateConti(existing.id, {
      title: title ?? existing.title,
      date,
      description: description ?? existing.description,
    });
    return existing.id;
  }

  const created = await repository.createConti({ title, date, description });
  return created.id;
}

async function addSongsToConti(contiId: string, songNames: string[]) {
  if (songNames.length === 0) {
    return;
  }

  const repository = getStoryboardRepository();
  const conti = await repository.getConti(contiId);
  const existingSongIds = new Set(conti?.songs.map((contiSong) => contiSong.songId) ?? []);

  for (const songName of songNames) {
    const songId = await findOrCreateSongId(songName);
    if (existingSongIds.has(songId)) {
      continue;
    }

    await repository.addSongToConti(contiId, songId);
    existingSongIds.add(songId);
  }
}

export async function processDiscordMessages(
  threadId: string,
  sundayDate: string,
  messages: DiscordMessage[],
) {
  const processedIds = new Set(await getProcessedMessageIds(threadId));
  const unprocessed = messages.filter((message) => !processedIds.has(message.id));

  if (unprocessed.length === 0) {
    return { processedCount: 0, contiId: null as string | null };
  }

  const parsed = parseDiscordMessages(
    unprocessed.map((message) => ({
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

  const merged = mergeParsedWorshipData(parsed);
  const contiDate = toISODateFromYYMMDD(sundayDate);
  const contiId = await upsertContiByDate(contiDate, null, buildContiDescription(threadId));
  await attachContiToActiveThread(contiId);

  if (merged.songs && merged.songs.length > 0) {
    await addSongsToConti(contiId, merged.songs);
  }

  const parseStatus = Object.keys(merged).length > 0 ? 'parsed' : 'ignored';
  for (const message of unprocessed) {
    await markMessageProcessed(threadId, message.id, message.content, parseStatus);
  }

  return { processedCount: unprocessed.length, contiId };
}
