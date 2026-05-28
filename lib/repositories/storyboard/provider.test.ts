import assert from 'node:assert/strict';
import test from 'node:test';

import { getStoryboardDatabaseProviderName } from './provider.ts';

test('database provider defaults to Neon for missing or blank values', () => {
  assert.equal(getStoryboardDatabaseProviderName({}), 'neon');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: '' }), 'neon');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: '   ' }), 'neon');
});

test('database provider accepts supported values', () => {
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: 'neon' }), 'neon');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: 'turso' }), 'turso');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: ' TURSO ' }), 'turso');
});

test('database provider rejects unknown values', () => {
  assert.throws(
    () => getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: 'sqlite' }),
    /Unsupported DATABASE_PROVIDER/,
  );
});
