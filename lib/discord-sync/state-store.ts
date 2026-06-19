import { and, desc, eq } from 'drizzle-orm';

import { getTursoDb } from '@/lib/db/turso';
import {
  contis,
  discordInteractionReceipts,
  discordProcessedMessages,
  discordThreadStates,
} from '@/lib/db/turso-schema';
import { dateToDbText, dbTextToDate } from '@/lib/db/time';
import { generateId } from '@/lib/id';
import type {
  DiscordInteractionReceipt,
  DiscordProcessedMessage,
  DiscordThreadState,
} from '@/lib/types';

type TursoDiscordThreadState = typeof discordThreadStates.$inferSelect;
type TursoDiscordProcessedMessage = typeof discordProcessedMessages.$inferSelect;
type TursoDiscordInteractionReceipt = typeof discordInteractionReceipts.$inferSelect;

function mapThreadState(row: TursoDiscordThreadState): DiscordThreadState {
  return {
    ...row,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function mapProcessedMessage(row: TursoDiscordProcessedMessage): DiscordProcessedMessage {
  return {
    ...row,
    processedAt: dbTextToDate(row.processedAt),
  };
}

function mapInteractionReceipt(row: TursoDiscordInteractionReceipt): DiscordInteractionReceipt {
  return {
    ...row,
    processedAt: dbTextToDate(row.processedAt),
  };
}

export async function setActiveThread(threadId: string, sundayDate: string) {
  const db = getTursoDb();
  const now = dateToDbText(new Date());

  await db
    .update(discordThreadStates)
    .set({ isActive: false, updatedAt: now })
    .where(eq(discordThreadStates.isActive, true));

  const existing = await db
    .select()
    .from(discordThreadStates)
    .where(eq(discordThreadStates.threadId, threadId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(discordThreadStates)
      .set({ sundayDate, isActive: true, updatedAt: now })
      .where(eq(discordThreadStates.threadId, threadId));
    return;
  }

  await db.insert(discordThreadStates).values({
    id: generateId(),
    threadId,
    sundayDate,
    contiId: null,
    preacher: null,
    leader: null,
    worshipLeader: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getActiveThread(): Promise<DiscordThreadState | null> {
  const rows = await getTursoDb()
    .select()
    .from(discordThreadStates)
    .where(eq(discordThreadStates.isActive, true))
    .orderBy(desc(discordThreadStates.updatedAt))
    .limit(1);

  return rows[0] ? mapThreadState(rows[0]) : null;
}

export async function markMessageProcessed(
  threadId: string,
  messageId: string,
  rawContent: string,
  parseStatus: string,
): Promise<DiscordProcessedMessage | null> {
  const db = getTursoDb();
  const existing = await db
    .select()
    .from(discordProcessedMessages)
    .where(eq(discordProcessedMessages.messageId, messageId))
    .limit(1);

  if (existing.length > 0) {
    return null;
  }

  const row = {
    id: generateId(),
    threadId,
    messageId,
    rawContent,
    parseStatus,
    processedAt: dateToDbText(new Date()),
  };

  await db.insert(discordProcessedMessages).values(row);
  return mapProcessedMessage(row);
}

export async function getProcessedMessageIds(threadId: string): Promise<string[]> {
  const rows = await getTursoDb()
    .select({ messageId: discordProcessedMessages.messageId })
    .from(discordProcessedMessages)
    .where(eq(discordProcessedMessages.threadId, threadId));

  return rows.map((row) => row.messageId);
}

export async function hasInteractionReceipt(interactionId: string): Promise<boolean> {
  const rows = await getTursoDb()
    .select({ id: discordInteractionReceipts.id })
    .from(discordInteractionReceipts)
    .where(eq(discordInteractionReceipts.interactionId, interactionId))
    .limit(1);

  return rows.length > 0;
}

export async function saveInteractionReceipt(
  interactionId: string,
  interactionType: number,
): Promise<DiscordInteractionReceipt | null> {
  const exists = await hasInteractionReceipt(interactionId);
  if (exists) {
    return null;
  }

  const row = {
    id: generateId(),
    interactionId,
    interactionType,
    processedAt: dateToDbText(new Date()),
  };

  await getTursoDb().insert(discordInteractionReceipts).values(row);
  return mapInteractionReceipt(row);
}

export async function saveRoleSelection(customId: string, selectedValue: string) {
  const active = await getActiveThread();
  if (!active) {
    return;
  }

  const now = dateToDbText(new Date());
  const db = getTursoDb();

  if (customId === 'preacher-select') {
    await db
      .update(discordThreadStates)
      .set({ preacher: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
    return;
  }

  if (customId === 'leader-select') {
    await db
      .update(discordThreadStates)
      .set({ leader: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
    return;
  }

  if (customId === 'worship-leader-select') {
    await db
      .update(discordThreadStates)
      .set({ worshipLeader: selectedValue, updatedAt: now })
      .where(eq(discordThreadStates.id, active.id));
  }
}

export async function upsertContiByDate(
  date: string,
  title: string | null,
  description: string | null,
): Promise<string> {
  const db = getTursoDb();
  const existing = await db.select().from(contis).where(eq(contis.date, date)).limit(1);
  const now = dateToDbText(new Date());

  if (existing.length > 0) {
    const conti = existing[0];
    await db
      .update(contis)
      .set({ title: title ?? conti.title, description: description ?? conti.description, updatedAt: now })
      .where(eq(contis.id, conti.id));
    return conti.id;
  }

  const id = generateId();
  await db.insert(contis).values({
    id,
    title,
    date,
    description,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function attachContiToActiveThread(contiId: string) {
  const active = await getActiveThread();
  if (!active) {
    return;
  }

  await getTursoDb()
    .update(discordThreadStates)
    .set({ contiId, updatedAt: dateToDbText(new Date()) })
    .where(and(eq(discordThreadStates.id, active.id), eq(discordThreadStates.isActive, true)));
}
