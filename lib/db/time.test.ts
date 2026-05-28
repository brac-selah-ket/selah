import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateToDbText, dbTextToDate } from './time.ts';

describe('database timestamp helpers', () => {
  it('serializes Date values as ISO strings', () => {
    const date = new Date('2026-05-28T03:04:05.678Z');

    assert.equal(dateToDbText(date), '2026-05-28T03:04:05.678Z');
  });

  it('parses ISO strings into Date values', () => {
    const date = dbTextToDate('2026-05-28T03:04:05.678Z');

    assert.equal(date.toISOString(), '2026-05-28T03:04:05.678Z');
  });
});
