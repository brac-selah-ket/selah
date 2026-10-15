import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';
import type { ArrangementItem } from '@/lib/types';

const getConti = vi.fn();
const findDiscordThreadForSundayDate = vi.fn();
const getThreadMessages = vi.fn();
const sendThreadMessage = vi.fn();
const editThreadMessage = vi.fn();
const buildArrangementItems = vi.fn();
const findRowByDate = vi.fn();
const updateContiSongsInSheet = vi.fn();

vi.mock('@/lib/repositories/storyboard', () => ({
  getStoryboardRepository: () => ({ getConti }),
}));

vi.mock('@/lib/discord-sync/worship-prep-notifications', () => ({
  findDiscordThreadForSundayDate,
}));

vi.mock('@/lib/discord-sync/discord-client', () => ({
  getThreadMessages,
  sendThreadMessage,
  editThreadMessage,
}));

vi.mock('@/lib/discord-sync/google-sheets', () => ({
  findRowByDate,
  updateContiSongsInSheet,
}));

vi.mock('@/lib/utils/arrangement-items', () => ({
  buildArrangementItems,
}));

const {
  buildPraiseTemplateMessage,
  isContiPraiseTemplateMessage,
  postContiPraiseTemplate,
  praiseSlotTitle,
} = await import('./praise-template-message.ts');

test('builds the discord praise line from arrangement titles', () => {
  assert.equal(buildPraiseTemplateMessage(['  주를 찬양  ', '은혜']), '찬양: 주를 찬양 - 은혜');
  assert.equal(buildPraiseTemplateMessage(['', '  ']), null);
  assert.equal(buildPraiseTemplateMessage([]), null);
});

test('mashup slot keeps both songs when there is no display title', () => {
  const item = {
    type: 'mashup',
    displayTitle: '첫곡',
    displaySongNames: ['첫곡', '둘째'],
    primarySong: { appliedPreset: { displayTitle: null } },
  } as Pick<ArrangementItem, 'type' | 'displayTitle' | 'displaySongNames' | 'primarySong'>;

  assert.equal(praiseSlotTitle(item), '첫곡 × 둘째');
  assert.equal(
    praiseSlotTitle({
      ...item,
      primarySong: { appliedPreset: { displayTitle: '  합친 제목  ' } },
    } as typeof item),
    '합친 제목',
  );
});

test('recognizes only a praise template line', () => {
  assert.equal(isContiPraiseTemplateMessage('찬양: 주를 찬양 - 은혜'), true);
  assert.equal(isContiPraiseTemplateMessage('찬양：주를 찬양'), true);
  assert.equal(isContiPraiseTemplateMessage('찬양 인도자를 선택하세요'), false);
  assert.equal(isContiPraiseTemplateMessage('**2026년**\n찬양: 예시'), false);
});

function stubConti(songTitles: string[]) {
  getConti.mockResolvedValue({ id: 'conti1', date: '2026-01-04', songs: [] });
  buildArrangementItems.mockReturnValue(
    songTitles.map((title) => ({
      type: 'single',
      displayTitle: title,
      displaySongNames: [title],
      primarySong: {},
    })),
  );
  findDiscordThreadForSundayDate.mockResolvedValue({ id: 'thread1' });
}

beforeEach(() => {
  getConti.mockReset();
  findDiscordThreadForSundayDate.mockReset();
  getThreadMessages.mockReset();
  sendThreadMessage.mockReset();
  editThreadMessage.mockReset();
  buildArrangementItems.mockReset();
  findRowByDate.mockReset();
  updateContiSongsInSheet.mockReset();
  findRowByDate.mockResolvedValue(42);
  updateContiSongsInSheet.mockResolvedValue(undefined);
});

test('sends a new message when no bot template message exists yet', async () => {
  stubConti(['주를 찬양']);
  getThreadMessages.mockResolvedValue([]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'sent');
  assert.equal(editThreadMessage.mock.calls.length, 0);
  assert.deepEqual(sendThreadMessage.mock.calls[0], ['thread1', '찬양: 주를 찬양']);
});

test('edits the existing bot template message when the song list changes', async () => {
  stubConti(['주를 찬양', '은혜']);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'bot1', bot: true } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'edited');
  assert.equal(sendThreadMessage.mock.calls.length, 0);
  assert.deepEqual(editThreadMessage.mock.calls[0], ['thread1', 'msg1', '찬양: 주를 찬양 - 은혜']);
});

test('skips when the existing bot template message already matches', async () => {
  stubConti(['주를 찬양']);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'bot1', bot: true } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'skipped');
  assert.equal(sendThreadMessage.mock.calls.length, 0);
  assert.equal(editThreadMessage.mock.calls.length, 0);
});

test('skips without touching the existing message when the conti has no songs', async () => {
  stubConti([]);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'bot1', bot: true } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'skipped');
  assert.equal(getThreadMessages.mock.calls.length, 0);
  assert.equal(sendThreadMessage.mock.calls.length, 0);
  assert.equal(editThreadMessage.mock.calls.length, 0);
});

test('ignores a non-bot message when looking for the existing template', async () => {
  stubConti(['은혜']);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'user1', bot: false } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'sent');
  assert.deepEqual(sendThreadMessage.mock.calls[0], ['thread1', '찬양: 은혜']);
});

test('syncs the sheet song columns, blanking unused ones, after a new message is sent', async () => {
  stubConti(['주를 찬양', '은혜']);
  getThreadMessages.mockResolvedValue([]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'sent');
  assert.deepEqual(findRowByDate.mock.calls[0], ['DB', '2026.01.04']);
  assert.deepEqual(updateContiSongsInSheet.mock.calls[0], ['DB', 42, ['주를 찬양', '은혜']]);
});

test('syncs the sheet song columns after the existing message is edited', async () => {
  stubConti(['은혜']);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'bot1', bot: true } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'edited');
  assert.deepEqual(updateContiSongsInSheet.mock.calls[0], ['DB', 42, ['은혜']]);
});

test('does not touch the sheet when the existing template message already matches', async () => {
  stubConti(['주를 찬양']);
  getThreadMessages.mockResolvedValue([
    { id: 'msg1', content: '찬양: 주를 찬양', author: { id: 'bot1', bot: true } },
  ]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'skipped');
  assert.equal(findRowByDate.mock.calls.length, 0);
  assert.equal(updateContiSongsInSheet.mock.calls.length, 0);
});

test('does not touch the sheet when the conti has no songs', async () => {
  stubConti([]);
  getThreadMessages.mockResolvedValue([]);

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'skipped');
  assert.equal(findRowByDate.mock.calls.length, 0);
  assert.equal(updateContiSongsInSheet.mock.calls.length, 0);
});

test('keeps the Discord upsert successful when the sheet row cannot be found', async () => {
  stubConti(['주를 찬양']);
  getThreadMessages.mockResolvedValue([]);
  findRowByDate.mockResolvedValue(null);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'sent');
  assert.equal(updateContiSongsInSheet.mock.calls.length, 0);
  assert.equal(errorSpy.mock.calls.length, 1);

  errorSpy.mockRestore();
});

test('keeps the Discord upsert successful when the sheet update throws (e.g. GOOGLE_SHEET_ID unset)', async () => {
  stubConti(['주를 찬양']);
  getThreadMessages.mockResolvedValue([]);
  updateContiSongsInSheet.mockRejectedValue(new Error('GOOGLE_SHEET_ID is not set'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const result = await postContiPraiseTemplate('conti1');

  assert.equal(result, 'sent');
  assert.equal(errorSpy.mock.calls.length, 1);

  errorSpy.mockRestore();
});
