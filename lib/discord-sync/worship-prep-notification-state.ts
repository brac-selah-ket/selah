import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { db as neonDb } from '@/lib/db';
import { getTursoDb } from '@/lib/db/turso';
import { dateToDbText, dbTextToDate } from '@/lib/db/time';
import { generateId } from '@/lib/id';
import { getStoryboardDatabaseProviderName } from '@/lib/repositories/storyboard/provider';
import { worshipPrepNotifications as neonNotifications } from '@/lib/db/schema';
import { worshipPrepNotifications as tursoNotifications } from '@/lib/db/turso-schema';

export const WORSHIP_PREP_READY_NOTIFICATION_TYPE = 'ppt_ready';
export const NOTIFICATION_PENDING_STALE_MS = 10 * 60 * 1000;

export type WorshipPrepNotificationStatus = 'pending' | 'sent' | 'failed';
export type NotificationClaimSkipReason = 'already-sent' | 'recent-pending';

export interface WorshipPrepNotificationRecord {
  id: string;
  sundayDate: string;
  type: string;
  status: WorshipPrepNotificationStatus;
  threadId: string | null;
  messageId: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationClaimResult {
  claimed: boolean;
  record: WorshipPrepNotificationRecord | null;
  reason: 'claimed' | NotificationClaimSkipReason | 'lost-race';
}

export interface ClaimExistingNotificationInput {
  threadId: string;
  attempts: number;
  now: Date;
  staleCutoff: Date;
}

export interface WorshipPrepNotificationStateStore {
  get(sundayDate: string, type: string): Promise<WorshipPrepNotificationRecord | null>;
  insertPending(record: WorshipPrepNotificationRecord): Promise<WorshipPrepNotificationRecord | null>;
  claimExisting(
    existing: WorshipPrepNotificationRecord,
    input: ClaimExistingNotificationInput,
  ): Promise<WorshipPrepNotificationRecord | null>;
  markSent(id: string, messageId: string, now: Date): Promise<void>;
  markFailed(id: string, now: Date): Promise<void>;
}

export function getNotificationClaimSkipReason(
  record: WorshipPrepNotificationRecord | null,
  now: Date,
): NotificationClaimSkipReason | null {
  if (!record) {
    return null;
  }

  if (record.status === 'sent') {
    return 'already-sent';
  }

  if (
    record.status === 'pending' &&
    record.lastAttemptAt &&
    now.getTime() - record.lastAttemptAt.getTime() < NOTIFICATION_PENDING_STALE_MS
  ) {
    return 'recent-pending';
  }

  return null;
}

function getStaleCutoff(now: Date): Date {
  return new Date(now.getTime() - NOTIFICATION_PENDING_STALE_MS);
}

function mapNeonRecord(row: typeof neonNotifications.$inferSelect): WorshipPrepNotificationRecord {
  return {
    ...row,
    status: row.status as WorshipPrepNotificationStatus,
  };
}

function mapTursoRecord(row: typeof tursoNotifications.$inferSelect): WorshipPrepNotificationRecord {
  return {
    ...row,
    status: row.status as WorshipPrepNotificationStatus,
    lastAttemptAt: row.lastAttemptAt ? dbTextToDate(row.lastAttemptAt) : null,
    sentAt: row.sentAt ? dbTextToDate(row.sentAt) : null,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

export async function claimWorshipPrepNotificationWithStore(
  store: WorshipPrepNotificationStateStore,
  sundayDate: string,
  threadId: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  now = new Date(),
): Promise<NotificationClaimResult> {
  const existing = await store.get(sundayDate, type);
  const skipReason = getNotificationClaimSkipReason(existing, now);

  if (skipReason) {
    return { claimed: false, record: existing, reason: skipReason };
  }

  if (!existing) {
    const record: WorshipPrepNotificationRecord = {
      id: generateId(),
      sundayDate,
      type,
      status: 'pending',
      threadId,
      messageId: null,
      attempts: 1,
      lastAttemptAt: now,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await store.insertPending(record);

    if (inserted) {
      return { claimed: true, record: inserted, reason: 'claimed' };
    }

    const raced = await store.get(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const claimed = await store.claimExisting(existing, {
    threadId,
    attempts: existing.attempts + 1,
    now,
    staleCutoff: getStaleCutoff(now),
  });

  if (claimed) {
    return { claimed: true, record: claimed, reason: 'claimed' };
  }

  const raced = await store.get(sundayDate, type);
  return {
    claimed: false,
    record: raced,
    reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
  };
}

export async function markWorshipPrepNotificationSentWithStore(
  store: WorshipPrepNotificationStateStore,
  id: string,
  messageId: string,
  now = new Date(),
): Promise<void> {
  await store.markSent(id, messageId, now);
}

export async function markWorshipPrepNotificationFailedWithStore(
  store: WorshipPrepNotificationStateStore,
  id: string,
  now = new Date(),
): Promise<void> {
  await store.markFailed(id, now);
}

export async function getWorshipPrepNotification(
  sundayDate: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
): Promise<WorshipPrepNotificationRecord | null> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    const rows = await getTursoDb()
      .select()
      .from(tursoNotifications)
      .where(and(eq(tursoNotifications.sundayDate, sundayDate), eq(tursoNotifications.type, type)))
      .limit(1);

    return rows[0] ? mapTursoRecord(rows[0]) : null;
  }

  const rows = await neonDb
    .select()
    .from(neonNotifications)
    .where(and(eq(neonNotifications.sundayDate, sundayDate), eq(neonNotifications.type, type)))
    .limit(1);

  return rows[0] ? mapNeonRecord(rows[0]) : null;
}

export async function claimWorshipPrepNotification(
  sundayDate: string,
  threadId: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  now = new Date(),
): Promise<NotificationClaimResult> {
  const existing = await getWorshipPrepNotification(sundayDate, type);
  const skipReason = getNotificationClaimSkipReason(existing, now);

  if (skipReason) {
    return { claimed: false, record: existing, reason: skipReason };
  }

  const provider = getStoryboardDatabaseProviderName();

  if (!existing) {
    const id = generateId();

    if (provider === 'turso') {
      const row = {
        id,
        sundayDate,
        type,
        status: 'pending',
        threadId,
        messageId: null,
        attempts: 1,
        lastAttemptAt: dateToDbText(now),
        sentAt: null,
        createdAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      };
      const inserted = await getTursoDb()
        .insert(tursoNotifications)
        .values(row)
        .onConflictDoNothing({ target: [tursoNotifications.sundayDate, tursoNotifications.type] })
        .returning();

      if (inserted.length > 0) {
        return { claimed: true, record: mapTursoRecord(inserted[0]), reason: 'claimed' };
      }

      const raced = await getWorshipPrepNotification(sundayDate, type);
      return {
        claimed: false,
        record: raced,
        reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
      };
    }

    const row = {
      id,
      sundayDate,
      type,
      status: 'pending',
      threadId,
      messageId: null,
      attempts: 1,
      lastAttemptAt: now,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const inserted = await neonDb
      .insert(neonNotifications)
      .values(row)
      .onConflictDoNothing({ target: [neonNotifications.sundayDate, neonNotifications.type] })
      .returning();

    if (inserted.length > 0) {
      return { claimed: true, record: mapNeonRecord(inserted[0]), reason: 'claimed' };
    }

    const raced = await getWorshipPrepNotification(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const nextAttempts = existing.attempts + 1;
  const cutoff = getStaleCutoff(now);

  if (provider === 'turso') {
    const updated = await getTursoDb()
      .update(tursoNotifications)
      .set({
        status: 'pending',
        threadId,
        attempts: nextAttempts,
        lastAttemptAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      })
      .where(and(
        eq(tursoNotifications.id, existing.id),
        or(
          eq(tursoNotifications.status, 'failed'),
          and(
            eq(tursoNotifications.status, 'pending'),
            or(isNull(tursoNotifications.lastAttemptAt), lte(tursoNotifications.lastAttemptAt, dateToDbText(cutoff))),
          ),
        ),
      ))
      .returning();

    if (updated.length > 0) {
      return { claimed: true, record: mapTursoRecord(updated[0]), reason: 'claimed' };
    }

    const raced = await getWorshipPrepNotification(sundayDate, type);
    return {
      claimed: false,
      record: raced,
      reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
    };
  }

  const updated = await neonDb
    .update(neonNotifications)
    .set({
      status: 'pending',
      threadId,
      attempts: nextAttempts,
      lastAttemptAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(neonNotifications.id, existing.id),
      or(
        eq(neonNotifications.status, 'failed'),
        and(
          eq(neonNotifications.status, 'pending'),
          or(isNull(neonNotifications.lastAttemptAt), lte(neonNotifications.lastAttemptAt, cutoff)),
        ),
      ),
    ))
    .returning();

  if (updated.length > 0) {
    return { claimed: true, record: mapNeonRecord(updated[0]), reason: 'claimed' };
  }

  const raced = await getWorshipPrepNotification(sundayDate, type);
  return {
    claimed: false,
    record: raced,
    reason: getNotificationClaimSkipReason(raced, now) ?? 'lost-race',
  };
}

export async function markWorshipPrepNotificationSent(
  id: string,
  messageId: string,
  now = new Date(),
): Promise<void> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    await getTursoDb()
      .update(tursoNotifications)
      .set({
        status: 'sent',
        messageId,
        sentAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      })
      .where(eq(tursoNotifications.id, id));
    return;
  }

  await neonDb
    .update(neonNotifications)
    .set({
      status: 'sent',
      messageId,
      sentAt: now,
      updatedAt: now,
    })
    .where(eq(neonNotifications.id, id));
}

export async function markWorshipPrepNotificationFailed(id: string, now = new Date()): Promise<void> {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'turso') {
    await getTursoDb()
      .update(tursoNotifications)
      .set({ status: 'failed', updatedAt: dateToDbText(now) })
      .where(eq(tursoNotifications.id, id));
    return;
  }

  await neonDb
    .update(neonNotifications)
    .set({ status: 'failed', updatedAt: now })
    .where(eq(neonNotifications.id, id));
}
