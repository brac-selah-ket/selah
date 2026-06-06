# Discord Worship Prep Notifications Design

## Goal

Upgrade the Discord worship-prep automation with two behaviors:

1. Every Monday at 09:00 KST, create the new worship-prep forum thread and archive the previous worship-prep thread.
2. When every worship-prep checklist item is complete, send a Discord thread message telling the PPT worker that everything except announcements is ready.

The readiness checklist includes all six Google Sheets fields shown in the worship-prep tab plus the linked conti card:

- 설교자
- 인도자
- 찬양 인도자
- 설교 제목
- 말씀 본문
- 찬양 목록
- 콘티 연결

## Current Context

The current Vercel schedule for `/api/cron/discord/create-thread` is `0 0 * * 1`, which runs at 09:00 Monday in Korea because Vercel cron uses UTC.

The current worship-prep readiness data is split:

- Google Sheets `DB` row stores the six worship fields.
- Turso stores contis. `getContiByDate()` checks whether the selected worship date has a conti.
- Discord active thread discovery uses the `YYMMDD 예배 준비` naming convention.

Turso usage is metered by row reads and row writes. Official pricing currently includes 500M monthly row reads on the Free plan and 2.5B monthly row reads on Developer. Turso docs clarify that row reads count scanned rows, not only returned rows. The design therefore keeps polling modest and avoids unnecessary full-table scans.

References:

- https://turso.tech/pricing
- https://docs.turso.tech/help/usage-and-billing

## Chosen Approach

Use event-driven checks as the primary path and a 10-minute cron as the recovery path.

Event-driven checks run immediately after state-changing operations that can complete the checklist:

- Discord role dropdown interaction updates a Google Sheets role field.
- Discord parse cron updates title, scripture, or songs in Google Sheets.
- App-side conti creation or conti date updates can create the linked conti condition.

The 10-minute cron exists to recover from missed event hooks, transient failures, or manual data changes.

## Thread Lifecycle

Add Discord client support for archiving a thread:

- `archiveThread(threadId)` calls `PATCH /channels/{threadId}` with `{ archived: true }`.
- It does not set `locked: true`.

Extend thread selection helpers:

- Keep the existing `selectTargetWorshipThread()` behavior for parse flows.
- Add a pure helper that selects the nearest past worship-prep thread relative to the new thread date.
- Ignore non-matching thread names.
- Do not archive the newly created target week.

The weekly create-thread flow becomes:

1. Resolve configured Discord guild and forum channel.
2. Fetch active forum threads.
3. Select the nearest past worship-prep thread.
4. Archive it if present.
5. Create the new worship-prep thread.
6. Send the initial message and role dropdowns.
7. Preserve existing active-thread state behavior for manual app actions that still use it.

If archiving fails, the create-thread route fails rather than silently leaving two active worship-prep threads. A `dryRun=true` request reports the thread that would be archived and the thread that would be created without Discord side effects.

## Readiness Notification

Add a focused module at `lib/discord-sync/worship-prep-notifications.ts` that exposes:

- `checkAndSendWorshipPrepReadyNotification({ sundayDate, origin? })`
- pure helpers for readiness calculation and notification message building

The module owns this flow:

1. Check notification state first. If `ppt_ready` was already sent for the week, return immediately.
2. Read the Google Sheets row for the week.
3. Confirm all six sheet fields are complete.
4. Check Turso for a conti with the same ISO date.
5. Locate the worship-prep Discord thread for the week.
6. Build the worship-prep URL.
7. Claim the notification send with an atomic insert/update on `(sundayDate, type)`.
8. Send the Discord message.
9. Mark the notification as `sent` only after Discord send succeeds.

Use this message:

`광고 외에 PPT 작성 준비가 완료되었습니다. {예배준비 URL} 에서 작업해주세요.`

## Notification State

Add a small durable state table to prevent duplicate notifications.

Logical shape:

- `id`
- `sundayDate`: `YYMMDD`
- `type`: initially `ppt_ready`
- `status`: `pending`, `sent`, or `failed`
- `threadId`
- `messageId`
- `attempts`
- `lastAttemptAt`
- `sentAt`
- `createdAt`
- `updatedAt`

Add a unique index on `(sundayDate, type)`.

Both Neon and Turso schema/migrations will be updated because the repository still contains both providers. Turso is the current production target, but keeping both schemas aligned reduces future drift.

Also add an index on `contis.date`. Without this, `getContiByDate()` can scan the whole contis table. The expected row-read volume is still well under Turso free limits for the current app size, but the index makes the polling cost bounded and predictable.

## URL Construction

Use an explicit app base URL:

- Prefer `APP_BASE_URL`.
- Fall back to `NEXT_PUBLIC_APP_URL` if present.
- In route handlers, allow the request origin as a final fallback.

Server actions do not have a reliable request origin. If no app base URL is configured there, return a controlled error from the readiness check rather than sending a message with a missing or guessed URL.

The target URL format is:

`/worship-prep?date=YYYY-MM-DD`

## Entry Points

Hook the readiness check into these places:

- `app/api/discord/interactions/route.ts`
  - After `updateRoleSelectionInSheet()` succeeds.
  - Use the interaction thread name to derive `sundayDate`.
- `app/api/cron/discord/parse-comments/route.ts`
  - After `updateWorshipData()` succeeds.
  - Use the selected active thread's `sundayDate`.
- `lib/actions/worship-prep.ts`
  - Manual parse path calls the same readiness check after a successful sheet update.
- Conti mutations
  - After creating or updating a conti date, check the corresponding worship-prep week.
  - This covers the moment the final missing item is the linked conti.
- New route: `/api/cron/discord/check-worship-prep-ready`
  - Requires cron authorization before any side effects.
  - Runs every 10 minutes.
  - Selects the nearest current worship-prep thread and checks that week.

The existing 2-minute parse-comments cron should not become the only readiness recovery mechanism. The 10-minute readiness cron keeps the feature explicit and makes its Turso usage easier to reason about.

## Error Handling

Controlled no-op cases:

- No matching Discord thread.
- No Google Sheets row for the week.
- Sheet fields are incomplete.
- No linked conti exists.
- Notification was already sent.

Retryable failures:

- Discord message send fails.
- Google Sheets read fails.
- Turso read/write fails.

For retryable failures, do not insert notification state. The next event hook or 10-minute cron can retry.

Notification sending uses a claim-before-send state transition:

1. If a `sent` row exists, return.
2. If no row exists, insert `pending` with `attempts = 1`.
3. If a `pending` row exists with a recent `lastAttemptAt`, return to avoid concurrent sends.
4. If a `failed` row exists, or a `pending` row is stale, update it to a new `pending` attempt.
5. After Discord send succeeds, update the row to `sent` with the Discord `messageId`.
6. If Discord send fails, update the row to `failed`.

This makes duplicate Discord messages unlikely even when event hooks and the 10-minute cron race. A stale `pending` threshold of 10 minutes matches the fallback cron cadence and prevents a crashed attempt from blocking future retries indefinitely.

## Cost And Polling

The fallback cron runs 144 times per day, about 4,320 times per 30-day month.

With a `contis.date` index and a small notification-state table, each poll should consume only a few Turso row reads when a notification is not already sent, and one indexed lookup when it is already sent. Google Sheets and Discord calls are also skipped after the notification state exists.

This is far below Turso's current Free plan allowance of 500M monthly row reads. The main cost risk is not the 10-minute cron itself, but accidentally introducing unindexed scans into frequently scheduled paths. The design avoids that by adding `contis.date` indexing and checking notification state first.

## Testing Strategy

Add focused tests instead of broad integration tests:

- Pure helper tests for previous-thread selection.
- Pure helper tests for readiness calculation.
- Source or lightweight route tests ensuring cron authorization happens before Discord, Google Sheets, or Turso side effects.
- Tests or source guards ensuring duplicate notification state is checked before expensive reads.
- Tests covering the new 10-minute cron route.

Run relevant node tests and `pnpm lint` before implementation completion.

## Rollout

1. Add schema and migrations for notification state and `contis.date` index.
2. Deploy with `APP_BASE_URL` configured.
3. Verify `dryRun=true` for create-thread reports the expected archive/create actions.
4. Manually test readiness check on a completed week without duplicate sends.
5. Enable the 10-minute cron in `vercel.json`.

## Out Of Scope

- Locking old threads.
- Tracking announcement readiness.
- Creating a full task-management model for worship preparation.
- Changing the current Discord parsing rules.
- Replacing Google Sheets as the source for the six worship fields.
