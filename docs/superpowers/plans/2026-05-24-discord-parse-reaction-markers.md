# Discord Parse Reaction Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Discord cron reactions distinguish parsed-and-written messages from ignored non-parsing messages while keeping the cron DB-free.

**Architecture:** Keep Discord reactions as the idempotency state, but split marker semantics: `✅` means the message contributed parsed data that was written to Google Sheets, and `☑️` means the message was inspected and ignored because it did not contain worship fields. The cron skip check should treat both bot-added markers as processed so ignored chat is not re-read every run.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Discord REST API reactions, Google Sheets API, Node test runner for pure helper tests, ESLint/Next build for validation.

---

## File Structure

- Modify: `lib/discord-sync/cron-state.ts`
  - Add named reaction marker constants and make processed detection accept both parsed and ignored markers.
- Modify: `lib/discord-sync/cron-state.test.mjs`
  - Add tests proving `✅` and `☑️` both skip future cron runs, while user-added reactions do not.
- Modify: `app/api/cron/discord/parse-comments/route.ts`
  - Track per-message parse success and add `✅` only to messages that produced parsed fields; add `☑️` to inspected messages that produced no parsed fields.

## Task 1: Add Dual Reaction Marker Helper Coverage

**Files:**
- Modify: `lib/discord-sync/cron-state.test.mjs`
- Modify: `lib/discord-sync/cron-state.ts`

- [ ] **Step 1: Write the failing helper test**

Append this test to `lib/discord-sync/cron-state.test.mjs`:

```js
test('treats parsed and ignored bot markers as processed reactions', async () => {
  const { hasProcessedReaction } = await loadCronState();

  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '✅' }, count: 1, me: true }],
    }),
    true,
  );
  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '☑️' }, count: 1, me: true }],
    }),
    true,
  );
  assert.equal(
    hasProcessedReaction({
      reactions: [{ emoji: { name: '☑️' }, count: 1, me: false }],
    }),
    false,
  );
});
```

- [ ] **Step 2: Run the helper test and verify red**

Run:

```bash
node --test lib/discord-sync/cron-state.test.mjs
```

Expected: FAIL in `treats parsed and ignored bot markers as processed reactions` because `☑️` is not currently treated as processed.

- [ ] **Step 3: Add marker constants and update processed detection**

Modify `lib/discord-sync/cron-state.ts`:

```ts
export const PARSED_REACTION = '✅';
export const IGNORED_REACTION = '☑️';
export const PROCESSED_REACTIONS = [PARSED_REACTION, IGNORED_REACTION] as const;
```

Replace `hasProcessedReaction` with:

```ts
export function hasProcessedReaction(message: DiscordMessageReactionState): boolean {
  return Boolean(
    message.reactions?.some(
      (reaction) =>
        reaction.me === true &&
        PROCESSED_REACTIONS.includes(reaction.emoji?.name as (typeof PROCESSED_REACTIONS)[number]) &&
        (reaction.count ?? 0) > 0,
    ),
  );
}
```

- [ ] **Step 4: Run the helper test and verify green**

Run:

```bash
node --test lib/discord-sync/cron-state.test.mjs
```

Expected: PASS with all helper tests passing.

## Task 2: Mark Parsed Messages Separately From Ignored Messages

**Files:**
- Modify: `app/api/cron/discord/parse-comments/route.ts`
- Modify: `lib/discord-sync/cron-state.ts`
- Test: `lib/discord-sync/cron-state.test.mjs`

- [ ] **Step 1: Import the marker constants**

Change the cron-state import in `app/api/cron/discord/parse-comments/route.ts` from:

```ts
import { hasProcessedReaction, selectTargetWorshipThread, toSheetDateFromYYMMDD } from '@/lib/discord-sync/cron-state';
```

to:

```ts
import {
  IGNORED_REACTION,
  PARSED_REACTION,
  hasProcessedReaction,
  selectTargetWorshipThread,
  toSheetDateFromYYMMDD,
} from '@/lib/discord-sync/cron-state';
```

- [ ] **Step 2: Track parsed message ids while merging data**

Insert this declaration immediately after `mergedData` in `app/api/cron/discord/parse-comments/route.ts`:

```ts
const parsedMessageIds = new Set<string>();
```

Inside the `for (let index = 0; index < parsedMessages.length; index += 1)` loop, after the `if (!parsedSuccess || !parsed) { continue; }` block and before assigning `mergedData`, insert:

```ts
const message = newMessages[index];
if (message) {
  parsedMessageIds.add(message.id);
}
```

- [ ] **Step 3: Use semantic reactions after sheet write succeeds**

Replace the final reaction loop in `app/api/cron/discord/parse-comments/route.ts`:

```ts
for (const message of newMessages) {
  try {
    await addMessageReaction(message.channel_id, message.id, '✅');
  } catch {}
}
```

with:

```ts
for (const message of newMessages) {
  const reaction = parsedMessageIds.has(message.id) ? PARSED_REACTION : IGNORED_REACTION;
  try {
    await addMessageReaction(message.channel_id, message.id, reaction);
  } catch {}
}
```

- [ ] **Step 4: Run focused validation**

Run:

```bash
node --test lib/discord-sync/cron-state.test.mjs
```

Expected: PASS with all helper tests passing.

- [ ] **Step 5: Run lint**

Run:

```bash
pnpm lint
```

Expected: exit code 0. Existing warnings about unused variables and `<img>` usage may remain.

## Task 3: Full Verification And Commit

**Files:**
- Modify: `app/api/cron/discord/parse-comments/route.ts`
- Modify: `lib/discord-sync/cron-state.ts`
- Modify: `lib/discord-sync/cron-state.test.mjs`
- Add: `docs/superpowers/plans/2026-05-24-discord-parse-reaction-markers.md`

- [ ] **Step 1: Run build**

Run:

```bash
pnpm build
```

Expected: exit code 0. If the sandbox blocks Google Fonts fetch, rerun with network permission and expect a successful Next.js production build.

- [ ] **Step 2: Inspect the diff**

Run:

```bash
git diff -- app/api/cron/discord/parse-comments/route.ts lib/discord-sync/cron-state.ts lib/discord-sync/cron-state.test.mjs docs/superpowers/plans/2026-05-24-discord-parse-reaction-markers.md
```

Expected: diff only changes reaction marker semantics and the implementation plan.

- [ ] **Step 3: Stage only this task's files**

Run:

```bash
git add app/api/cron/discord/parse-comments/route.ts lib/discord-sync/cron-state.ts lib/discord-sync/cron-state.test.mjs docs/superpowers/plans/2026-05-24-discord-parse-reaction-markers.md
```

Expected: these four files are staged; existing untracked bug-analysis documents stay unstaged.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "fix: distinguish parsed discord reactions"
```

Expected: commit succeeds on the current branch.
