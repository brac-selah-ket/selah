import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { test } from 'vitest';
const require = createRequire(import.meta.url);
const ts = require('typescript');

async function writeModule(dir, fileName, source) {
  await writeFile(join(dir, fileName), source);
}

async function loadParseCommentsRoute() {
  const dir = join(tmpdir(), `discord-parse-comments-route-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(dir, { recursive: true });

  await writeModule(
    dir,
    'next-server.mjs',
    `
      export const NextResponse = {
        json(body, init = {}) {
          return {
            status: init.status ?? 200,
            body,
            async json() {
              return body;
            },
          };
        },
      };
    `,
  );
  await writeModule(
    dir,
    'cron-auth.mjs',
    `
      export function isCronAuthorized() {
        return true;
      }
    `,
  );
  await writeModule(
    dir,
    'discord-client.mjs',
    `
      export const reactions = [];
      export async function getChannel() {
        return { guild_id: 'guild-1' };
      }
      export async function getActiveForumThreads() {
        return [{ id: 'thread-1', name: '260531 예배 준비' }];
      }
      export async function getThreadMessages() {
        return [
          {
            id: 'parsed-1',
            channel_id: 'thread-1',
            content: '본문: 요 3:16',
            timestamp: '2026-05-28T00:00:00.000Z',
            author: { bot: false, id: 'user-1', username: 'user1', global_name: 'User 1' },
            reactions: [],
          },
          {
            id: 'chat-1',
            channel_id: 'thread-1',
            content: '확인했습니다',
            timestamp: '2026-05-28T00:01:00.000Z',
            author: { bot: false, id: 'user-2', username: 'user2', global_name: 'User 2' },
            reactions: [],
          },
        ];
      }
      export async function addMessageReaction(channelId, messageId, emoji) {
        reactions.push({ channelId, messageId, emoji });
      }
    `,
  );
  await writeModule(
    dir,
    'discord-parser.mjs',
    `
      export function parseDiscordMessages(messages) {
        return messages.map((message) => ({
          messageId: message.id,
          parsedData: message.id === 'parsed-1' ? { scripture: '요 3:16' } : undefined,
        }));
      }
    `,
  );
  await writeModule(
    dir,
    'spell-checker.mjs',
    `
      export async function correctSpelling(value) {
        return value;
      }
    `,
  );
  await writeModule(
    dir,
    'google-sheets.mjs',
    `
      export const updates = [];
      export async function findRowByDate() {
        return 2;
      }
      export async function updateWorshipData(sheetName, row, data) {
        updates.push({ sheetName, row, data });
      }
    `,
  );
  await writeModule(
    dir,
    'worship-prep-notifications.mjs',
    `
      import { updates } from './google-sheets.mjs';

      export const notificationCalls = [];
      export async function checkAndSendWorshipPrepReadyNotification(input) {
        notificationCalls.push({ ...input, updateCount: updates.length });
        return { success: true, status: 'not-ready' };
      }
    `,
  );
  await writeModule(
    dir,
    'cron-state.mjs',
    `
      export const IGNORED_REACTION = '☑️';
      export const PARSED_REACTION = '✅';
      export function hasProcessedReaction() {
        return false;
      }
      export function resolveGuildId({ configuredGuildId, channel }) {
        return configuredGuildId || channel?.guild_id || null;
      }
      export function selectTargetWorshipThread(threads) {
        return { ...threads[0], sundayDate: '260531' };
      }
      export function toSheetDateFromYYMMDD() {
        return '2026.05.31';
      }
    `,
  );

  const source = await readFile(new URL('../app/api/cron/discord/parse-comments/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const output = compiled.outputText
    .replace("from 'next/server';", "from './next-server.mjs';")
    .replace("from '@/lib/cron-auth';", "from './cron-auth.mjs';")
    .replace("from '@/lib/discord-sync/discord-client';", "from './discord-client.mjs';")
    .replace("from '@/lib/discord-parser';", "from './discord-parser.mjs';")
    .replace("from '@/lib/discord-sync/spell-checker';", "from './spell-checker.mjs';")
    .replace("from '@/lib/discord-sync/google-sheets';", "from './google-sheets.mjs';")
    .replace("from '@/lib/discord-sync/worship-prep-notifications';", "from './worship-prep-notifications.mjs';")
    .replace("from '@/lib/discord-sync/cron-state';", "from './cron-state.mjs';");

  await writeModule(dir, 'route.mjs', output);

  // Vitest's module runner gives each top-level dynamic import() its own module
  // instance, so importing the stub modules separately would not share the
  // mutable state (e.g. `updates`) that route.mjs mutates. Loading everything
  // through a single entry module keeps them in one graph, where Vitest
  // deduplicates shared modules — matching Node's native ESM singleton behavior.
  await writeModule(
    dir,
    'harness.mjs',
    `
      export * as route from './route.mjs';
      export * as discordClient from './discord-client.mjs';
      export * as googleSheets from './google-sheets.mjs';
      export * as notifications from './worship-prep-notifications.mjs';
    `,
  );

  const { route, discordClient, googleSheets, notifications } = await import(
    `${pathToFileURL(join(dir, 'harness.mjs')).href}?v=${Date.now()}`
  );

  return { route, discordClient, googleSheets, notifications };
}

test('parse-comments reacts only to messages that produced parsed worship data', async () => {
  const { route, discordClient, googleSheets, notifications } = await loadParseCommentsRoute();
  const previousChannelId = process.env.DISCORD_CHANNEL_ID;
  process.env.DISCORD_CHANNEL_ID = 'channel-1';

  try {
    const response = await route.GET({ url: 'https://storyboard.test/api/cron/discord/parse-comments' });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(googleSheets.updates, [
      {
        sheetName: 'DB',
        row: 2,
        data: { scripture: '요 3:16' },
      },
    ]);
    assert.deepEqual(notifications.notificationCalls, [
      {
        sundayDate: '260531',
        origin: 'https://storyboard.test',
        updateCount: 1,
      },
    ]);
    assert.deepEqual(discordClient.reactions, [
      { channelId: 'thread-1', messageId: 'parsed-1', emoji: '✅' },
    ]);
  } finally {
    if (previousChannelId === undefined) {
      delete process.env.DISCORD_CHANNEL_ID;
    } else {
      process.env.DISCORD_CHANNEL_ID = previousChannelId;
    }
  }
});
