# Discord Cron DB-Free Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frequently scheduled Discord parse cron avoid all app DB reads and writes.

**Architecture:** Move thread discovery and message dedupe for the cron path to Discord-native state. A small pure helper module handles worship thread selection and reaction detection, while the cron route imports Discord client functions directly instead of the DB-backed barrel.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Discord REST API v10, Google Sheets API, Node test runner for focused helper checks, ESLint/Next build for validation.

---

## File Structure

- Create: `lib/discord-sync/cron-state.ts`
  - Pure helpers for parsing worship thread names, choosing an active target thread, deriving sheet dates, and detecting processed reactions.
- Create: `lib/discord-sync/cron-state.test.mjs`
  - Node test runner coverage for the pure helper behavior.
- Modify: `lib/discord-sync/discord-client.ts`
  - Add active thread metadata and message reaction/bot fields needed by the DB-free cron path.
- Modify: `app/api/cron/discord/parse-comments/route.ts`
  - Remove DB-backed imports and use Discord-only runtime state.
- Modify: `app/api/cron/discord/create-thread/route.ts`
  - Stop writing thread/message state to DB during weekly thread creation.
- Modify: `app/api/discord/interactions/route.ts`
  - Avoid DB active-thread lookup by deriving the Sunday date from the interaction thread name.

## Tasks

### Task 1: Add Cron State Helpers

- [ ] Write `lib/discord-sync/cron-state.test.mjs` with failing assertions for thread selection, sheet-date conversion, and `✅` reaction detection.
- [ ] Run `node --test lib/discord-sync/cron-state.test.mjs` and confirm it fails because `cron-state.ts` does not exist.
- [ ] Create `lib/discord-sync/cron-state.ts` with exported helpers: `parseWorshipThreadName`, `toSheetDateFromYYMMDD`, `selectTargetWorshipThread`, and `hasProcessedReaction`.
- [ ] Run `node --test lib/discord-sync/cron-state.test.mjs` and confirm it passes.

### Task 2: Extend Discord Client Types

- [ ] Update `DiscordMessage` to include optional `reactions` and `author.bot`.
- [ ] Update active thread metadata to include `name` and `parent_id`.
- [ ] Replace `getActiveThreadIds` with `getActiveForumThreads` returning active thread objects for the target parent channel.
- [ ] Run `pnpm lint` and confirm TypeScript/ESLint accepts the new types.

### Task 3: Make Parse Cron DB-Free

- [ ] Replace the DB-backed barrel import in `app/api/cron/discord/parse-comments/route.ts` with direct imports from `discord-client`, `thread-template`, `cron-state`, parser, spell-checker, and Google Sheets.
- [ ] Read `DISCORD_GUILD_ID` and `DISCORD_CHANNEL_ID`; return a controlled 500 if either is absent.
- [ ] Select the active worship thread from Discord active threads.
- [ ] Skip bot messages and messages already carrying a `✅` reaction.
- [ ] Parse and update the sheet only when there are new unprocessed messages.
- [ ] Add `✅` to every newly inspected message only after any required sheet write succeeds.
- [ ] Run `pnpm lint`.

### Task 4: Remove DB Writes From Create Thread Cron

- [ ] Remove `setActiveThread` and `markMessageProcessed` imports from `app/api/cron/discord/create-thread/route.ts`.
- [ ] Keep thread creation and dropdown message creation behavior unchanged.
- [ ] Run `pnpm lint`.

### Task 5: Remove DB Lookup From Discord Interactions

- [ ] Derive `sundayDate` from the current interaction thread name.
- [ ] Remove `getActiveThread` and `saveRoleSelection` imports.
- [ ] Continue updating the Google Sheet and adding best-effort `✅` reactions.
- [ ] Return an ephemeral error if the thread name does not match `YYMMDD 예배 준비`.
- [ ] Run `pnpm lint`.

### Task 6: Final Verification

- [ ] Run `node --test lib/discord-sync/cron-state.test.mjs`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build` if environment variables are not required at build time; otherwise report the blocker.
- [ ] Confirm `app/api/cron/discord/parse-comments/route.ts`, `app/api/cron/discord/create-thread/route.ts`, and `app/api/discord/interactions/route.ts` no longer import DB-backed state helpers.

