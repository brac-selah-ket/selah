import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCronSecret,
  isBearerSecretAuthorized,
} from './cron-auth.ts';

test('authorizes only an exact bearer secret match', () => {
  assert.equal(isBearerSecretAuthorized('Bearer secret-1', 'secret-1'), true);
  assert.equal(isBearerSecretAuthorized('Bearer secret-1', 'secret-2'), false);
  assert.equal(isBearerSecretAuthorized('secret-1', 'secret-1'), false);
  assert.equal(isBearerSecretAuthorized(null, 'secret-1'), false);
});

test('rejects blank or missing cron secrets', () => {
  assert.equal(isBearerSecretAuthorized('Bearer secret-1', undefined), false);
  assert.equal(isBearerSecretAuthorized('Bearer secret-1', ''), false);
  assert.equal(isBearerSecretAuthorized('Bearer secret-1', '   '), false);
});

test('prefers CRON_SECRET and falls back to DISCORD_CRON_SECRET', () => {
  assert.equal(getCronSecret({ CRON_SECRET: ' primary ', DISCORD_CRON_SECRET: 'fallback' }), 'primary');
  assert.equal(getCronSecret({ CRON_SECRET: ' ', DISCORD_CRON_SECRET: ' fallback ' }), 'fallback');
  assert.equal(getCronSecret({}), undefined);
});
