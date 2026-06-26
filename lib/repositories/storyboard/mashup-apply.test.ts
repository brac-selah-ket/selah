import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { getAdjacentOrderedTursoContiSongPair } from './turso-repository.ts';

const rows = [
  { id: 'row-a', sortOrder: 10 },
  { id: 'row-b', sortOrder: 30 },
  { id: 'row-c', sortOrder: 40 },
];

describe('mashup conti row adjacency', () => {
  it('treats consecutive ordered rows as adjacent even when sortOrder has gaps', () => {
    assert.deepEqual(getAdjacentOrderedTursoContiSongPair(rows, ['row-b', 'row-a']), [rows[0], rows[1]]);
  });

  it('rejects rows that are not consecutive in the ordered conti', () => {
    assert.equal(getAdjacentOrderedTursoContiSongPair(rows, ['row-a', 'row-c']), null);
  });
});
