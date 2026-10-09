import assert from 'node:assert/strict';
import { beforeEach, test, vi } from 'vitest';

const postContiPraiseTemplate = vi.fn();
const getContiPraiseThreadStatus = vi.fn();

vi.mock('@/lib/discord-sync/praise-template-message', () => ({
  postContiPraiseTemplate,
  getContiPraiseThreadStatus,
}));

const { postContiPraiseThread } = await import('./conti-praise-thread.ts');

beforeEach(() => {
  postContiPraiseTemplate.mockReset();
  getContiPraiseThreadStatus.mockReset();
});

test('returns the send status and thread info on success', async () => {
  postContiPraiseTemplate.mockResolvedValue('sent');
  getContiPraiseThreadStatus.mockResolvedValue({
    threadUrl: 'https://discord.com/channels/guild1/thread1',
    lastSentAt: '2026-01-04T10:00:00.000Z',
  });

  const result = await postContiPraiseThread('conti1');

  assert.deepEqual(result, {
    success: true,
    data: {
      status: 'sent',
      threadUrl: 'https://discord.com/channels/guild1/thread1',
      lastSentAt: '2026-01-04T10:00:00.000Z',
    },
  });
});

test('returns a Korean error message when the upsert throws', async () => {
  postContiPraiseTemplate.mockRejectedValue(new Error('boom'));

  const result = await postContiPraiseThread('conti1');

  assert.equal(result.success, false);
  assert.equal(result.error, '스레드에 올리는 중 오류가 발생했습니다');
});
