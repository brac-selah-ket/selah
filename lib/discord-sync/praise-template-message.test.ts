import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  buildPraiseTemplateMessage,
  isContiPraiseTemplateMessage,
  praiseSlotTitle,
} from './praise-template-message.ts';
import type { ArrangementItem } from '@/lib/types';

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
