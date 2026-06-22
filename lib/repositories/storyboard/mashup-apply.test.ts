import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { getAdjacentOrderedContiSongPair } from './neon-repository.ts';
import { getAdjacentOrderedTursoContiSongPair } from './turso-repository.ts';

const rows = [
  { id: 'row-a', sortOrder: 10 },
  { id: 'row-b', sortOrder: 30 },
  { id: 'row-c', sortOrder: 40 },
];

describe('mashup conti row adjacency', () => {
  it('treats consecutive ordered rows as adjacent even when sortOrder has gaps', () => {
    assert.deepEqual(getAdjacentOrderedContiSongPair(rows, ['row-b', 'row-a']), [rows[0], rows[1]]);
    assert.deepEqual(getAdjacentOrderedTursoContiSongPair(rows, ['row-b', 'row-a']), [rows[0], rows[1]]);
  });

  it('rejects rows that are not consecutive in the ordered conti', () => {
    assert.equal(getAdjacentOrderedContiSongPair(rows, ['row-a', 'row-c']), null);
    assert.equal(getAdjacentOrderedTursoContiSongPair(rows, ['row-a', 'row-c']), null);
  });
});
