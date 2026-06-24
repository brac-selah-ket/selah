import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getStoryboardDatabaseProviderName } from './provider.ts';

test('database provider defaults to Turso for missing or blank values', () => {
  assert.equal(getStoryboardDatabaseProviderName({}), 'turso');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: '' }), 'turso');
  assert.equal(getStoryboardDatabaseProviderName({ DATABASE_PROVIDER: '   ' }), 'turso');
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
