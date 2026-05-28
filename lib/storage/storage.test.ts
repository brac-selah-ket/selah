import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createPublicUrl,
  getObjectKeyFromPublicUrl,
  getStorageProviderName,
  requireR2Config,
} from './config.ts';

test('storage provider defaults to Vercel Blob', () => {
  assert.equal(getStorageProviderName({}), 'vercel-blob');
  assert.equal(getStorageProviderName({ STORAGE_PROVIDER: '' }), 'vercel-blob');
  assert.equal(getStorageProviderName({ STORAGE_PROVIDER: '   ' }), 'vercel-blob');
});

test('storage provider accepts Cloudflare R2 aliases', () => {
  assert.equal(getStorageProviderName({ STORAGE_PROVIDER: 'cloudflare-r2' }), 'cloudflare-r2');
  assert.equal(getStorageProviderName({ STORAGE_PROVIDER: 'r2' }), 'cloudflare-r2');
});

test('storage provider rejects unknown values', () => {
  assert.throws(
    () => getStorageProviderName({ STORAGE_PROVIDER: 's3' }),
    /Unsupported STORAGE_PROVIDER/,
  );
});

test('R2 config validation is lazy and explicit', () => {
  assert.throws(
    () => requireR2Config({ STORAGE_PROVIDER: 'cloudflare-r2' }),
    /CLOUDFLARE_ACCOUNT_ID/,
  );
});

test('R2 public URLs round-trip object keys', () => {
  const baseUrl = 'https://assets.example.com/nested/';
  const key = 'sheet-music/song 1/주님.pdf';

  const url = createPublicUrl(baseUrl, key);

  assert.equal(url, 'https://assets.example.com/nested/sheet-music/song%201/%EC%A3%BC%EB%8B%98.pdf');
  assert.equal(getObjectKeyFromPublicUrl(baseUrl, url), key);
});

test('Cloudflare R2 put protects existing objects unless overwrite is explicit', async () => {
  const source = await readFile(new URL('./cloudflare-r2.ts', import.meta.url), 'utf8');

  assert.match(source, /IfNoneMatch: options\?\.allowOverwrite \? undefined : '\*'/);
});
