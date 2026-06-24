import { and, eq, isNull, lte, or } from 'drizzle-orm';

import { getTursoDb } from '@/lib/db/turso';
import { dateToDbText, dbTextToDate } from '@/lib/db/time';
import { worshipPrepNotifications } from '@/lib/db/turso-schema';
import { generateId } from '@/lib/id';

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

export interface WorshipPrepNotificationClaimReference {
  id: string;
  attempts: number;
  lastAttemptAt: Date;
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
  markSent(claim: WorshipPrepNotificationClaimReference, messageId: string, now: Date): Promise<void>;
  markFailed(claim: WorshipPrepNotificationClaimReference, now: Date): Promise<void>;
}

type TursoNotification = typeof worshipPrepNotifications.$inferSelect;

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

function mapTursoRecord(row: TursoNotification): WorshipPrepNotificationRecord {
  return {
    ...row,
    status: row.status as WorshipPrepNotificationStatus,
    lastAttemptAt: row.lastAttemptAt ? dbTextToDate(row.lastAttemptAt) : null,
    sentAt: row.sentAt ? dbTextToDate(row.sentAt) : null,
    createdAt: dbTextToDate(row.createdAt),
    updatedAt: dbTextToDate(row.updatedAt),
  };
}

function serializeNotificationRecord(record: WorshipPrepNotificationRecord): TursoNotification {
  return {
    ...record,
    lastAttemptAt: record.lastAttemptAt ? dateToDbText(record.lastAttemptAt) : null,
    sentAt: record.sentAt ? dateToDbText(record.sentAt) : null,
    createdAt: dateToDbText(record.createdAt),
    updatedAt: dateToDbText(record.updatedAt),
  };
}

const tursoNotificationStore: WorshipPrepNotificationStateStore = {
  async get(sundayDate, type) {
    const rows = await getTursoDb()
      .select()
      .from(worshipPrepNotifications)
      .where(and(eq(worshipPrepNotifications.sundayDate, sundayDate), eq(worshipPrepNotifications.type, type)))
      .limit(1);

    return rows[0] ? mapTursoRecord(rows[0]) : null;
  },

  async insertPending(record) {
    const inserted = await getTursoDb()
      .insert(worshipPrepNotifications)
      .values(serializeNotificationRecord(record))
      .onConflictDoNothing({
        target: [worshipPrepNotifications.sundayDate, worshipPrepNotifications.type],
      })
      .returning();

    return inserted[0] ? mapTursoRecord(inserted[0]) : null;
  },

  async claimExisting(existing, input) {
    const updated = await getTursoDb()
      .update(worshipPrepNotifications)
      .set({
        status: 'pending',
        threadId: input.threadId,
        attempts: input.attempts,
        lastAttemptAt: dateToDbText(input.now),
        updatedAt: dateToDbText(input.now),
      })
      .where(and(
        eq(worshipPrepNotifications.id, existing.id),
        or(
          eq(worshipPrepNotifications.status, 'failed'),
          and(
            eq(worshipPrepNotifications.status, 'pending'),
            or(
              isNull(worshipPrepNotifications.lastAttemptAt),
              lte(worshipPrepNotifications.lastAttemptAt, dateToDbText(input.staleCutoff)),
            ),
          ),
        ),
      ))
      .returning();

    return updated[0] ? mapTursoRecord(updated[0]) : null;
  },

  async markSent(claim, messageId, now) {
    await getTursoDb()
      .update(worshipPrepNotifications)
      .set({
        status: 'sent',
        messageId,
        sentAt: dateToDbText(now),
        updatedAt: dateToDbText(now),
      })
      .where(and(
        eq(worshipPrepNotifications.id, claim.id),
        eq(worshipPrepNotifications.status, 'pending'),
        eq(worshipPrepNotifications.attempts, claim.attempts),
        eq(worshipPrepNotifications.lastAttemptAt, dateToDbText(claim.lastAttemptAt)),
      ));
  },

  async markFailed(claim, now) {
    await getTursoDb()
      .update(worshipPrepNotifications)
      .set({ status: 'failed', updatedAt: dateToDbText(now) })
      .where(and(
        eq(worshipPrepNotifications.id, claim.id),
        eq(worshipPrepNotifications.status, 'pending'),
        eq(worshipPrepNotifications.attempts, claim.attempts),
        eq(worshipPrepNotifications.lastAttemptAt, dateToDbText(claim.lastAttemptAt)),
      ));
  },
};

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
  claim: WorshipPrepNotificationClaimReference,
  messageId: string,
  now = new Date(),
): Promise<void> {
  await store.markSent(claim, messageId, now);
}

export async function markWorshipPrepNotificationFailedWithStore(
  store: WorshipPrepNotificationStateStore,
  claim: WorshipPrepNotificationClaimReference,
  now = new Date(),
): Promise<void> {
  await store.markFailed(claim, now);
}

export async function getWorshipPrepNotification(
  sundayDate: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
): Promise<WorshipPrepNotificationRecord | null> {
  return tursoNotificationStore.get(sundayDate, type);
}

export async function claimWorshipPrepNotification(
  sundayDate: string,
  threadId: string,
  type = WORSHIP_PREP_READY_NOTIFICATION_TYPE,
  now = new Date(),
): Promise<NotificationClaimResult> {
  return claimWorshipPrepNotificationWithStore(tursoNotificationStore, sundayDate, threadId, type, now);
}

export async function markWorshipPrepNotificationSent(
  claim: WorshipPrepNotificationClaimReference,
  messageId: string,
  now = new Date(),
): Promise<void> {
  await markWorshipPrepNotificationSentWithStore(tursoNotificationStore, claim, messageId, now);
}

export async function markWorshipPrepNotificationFailed(
  claim: WorshipPrepNotificationClaimReference,
  now = new Date(),
): Promise<void> {
  await markWorshipPrepNotificationFailedWithStore(tursoNotificationStore, claim, now);
}
