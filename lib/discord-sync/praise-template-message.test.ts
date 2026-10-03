import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildPraiseTemplateMessage,
  isContiPraiseTemplateMessage,
} from './praise-template-message.ts';

test('builds the discord praise line from arrangement titles', () => {
  assert.equal(buildPraiseTemplateMessage(['  주를 찬양  ', '은혜']), '찬양: 주를 찬양 - 은혜');
  assert.equal(buildPraiseTemplateMessage(['', '  ']), null);
  assert.equal(buildPraiseTemplateMessage([]), null);
});

test('recognizes only a praise template line', () => {
  assert.equal(isContiPraiseTemplateMessage('찬양: 주를 찬양 - 은혜'), true);
  assert.equal(isContiPraiseTemplateMessage('찬양：주를 찬양'), true);
  assert.equal(isContiPraiseTemplateMessage('찬양 인도자를 선택하세요'), false);
  assert.equal(isContiPraiseTemplateMessage('**2026년**\n찬양: 예시'), false);
});
