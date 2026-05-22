# Discord Cron DB-Free Design

## Goal

Reduce Vercel Postgres/Neon active time by removing app DB reads and writes from the frequently scheduled Discord parse cron.

## Current Problem

`/api/cron/discord/parse-comments` runs every 2 minutes. It currently reads the active Discord thread and processed message ids from Postgres, which prevents the Neon database from reaching its idle autosuspend window.

## Chosen Approach

Use Discord as the runtime state source for the polling cron:

- Find the target worship-prep thread through Discord active threads instead of `discord_thread_states`.
- Treat a bot `✅` reaction on a message as the processed marker instead of `discord_processed_messages`.
- Mark every inspected non-system message with `✅` after it is handled, whether it yielded parsable worship data or was ignored.
- Keep Google Sheets as the output sink for worship data.
- Keep Postgres-backed app data for normal app pages and manual app workflows, but do not import DB-backed state helpers from the frequent cron route.

## Vercel Workflow / Queues Evaluation

Vercel Workflow and Queues are useful for durable asynchronous work once an event exists. They do not remove the need to poll Discord for new ordinary thread messages, because Discord does not push those messages to this app through the existing interaction endpoint.

Using Workflow or Queues now would replace one cost source with a new beta product, new package, new billing dimension, and additional operational state. The lower-risk change is to keep Vercel Cron but make the cron DB-free.

## Data Flow

1. Vercel Cron calls `/api/cron/discord/parse-comments`.
2. The route authenticates with `CRON_SECRET` or `DISCORD_CRON_SECRET`.
3. The route asks Discord for active threads in the configured guild/channel.
4. The route selects a thread whose name matches the worship-prep convention, preferring the nearest current worship week.
5. The route fetches recent thread messages.
6. Messages with bot `✅` reactions are skipped.
7. Remaining messages are parsed and merged.
8. If parsed worship fields exist, the route updates the matching Google Sheet row.
9. The route adds `✅` to processed/ignored messages to prevent future reprocessing.

## Error Handling

- If required Discord env vars are missing, return a controlled error response.
- If there is no active matching thread, return success with no work.
- If the Google Sheet row is missing, do not add processed reactions. This allows retry after the sheet is fixed.
- Reaction failures are non-fatal per message, matching the existing best-effort behavior.

## Test Strategy

- Add focused unit coverage for thread-name/date selection and processed-reaction detection.
- Run lint/build/type validation after implementation.

