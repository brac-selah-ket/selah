import assert from 'node:assert/strict';
import { test } from 'vitest';
import { deriveContiPraiseThreadButtonState } from './conti-praise-thread.ts';

test('disables with a reason when the conti has no songs yet', () => {
  const state = deriveContiPraiseThreadButtonState({
    hasSongs: false,
    hasThread: true,
    lastSentAt: null,
    isPending: false,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.disabledReason, '곡을 먼저 추가하세요');
  assert.equal(state.label, '스레드에 올리기');
});

test('disables with a reason when there is no Discord thread for the week', () => {
  const state = deriveContiPraiseThreadButtonState({
    hasSongs: true,
    hasThread: false,
    lastSentAt: null,
    isPending: false,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.disabledReason, '이 주일 예배 스레드가 아직 없어요');
});

test('enables once there are songs and a thread, with no reason', () => {
  const state = deriveContiPraiseThreadButtonState({
    hasSongs: true,
    hasThread: true,
    lastSentAt: null,
    isPending: false,
  });

  assert.equal(state.disabled, false);
  assert.equal(state.disabledReason, null);
});

test('disables while pending even though the conditions are otherwise met', () => {
  const state = deriveContiPraiseThreadButtonState({
    hasSongs: true,
    hasThread: true,
    lastSentAt: null,
    isPending: true,
  });

  assert.equal(state.disabled, true);
  assert.equal(state.disabledReason, null);
});

test('switches the label to update once a template message has already been sent', () => {
  const state = deriveContiPraiseThreadButtonState({
    hasSongs: true,
    hasThread: true,
    lastSentAt: '2026-01-04T10:00:00.000Z',
    isPending: false,
  });

  assert.equal(state.label, '스레드 업데이트');
});
