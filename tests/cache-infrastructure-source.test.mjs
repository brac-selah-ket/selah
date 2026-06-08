import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import assert from 'node:assert/strict';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('next config enables cache components', async () => {
  const source = await read('next.config.ts');
  assert.match(source, /cacheComponents:\s*true/);
});

test('authenticated layout does not force every page dynamic', async () => {
  const source = await read('app/(authenticated)/layout.tsx');
  assert.doesNotMatch(source, /dynamic\s*=\s*["']force-dynamic["']/);
});

test('cache components routes do not export incompatible segment config', async () => {
  for (const path of [
    'app/(authenticated)/worship-prep/page.tsx',
    'app/(authenticated)/worship-prep/[date]/page.tsx',
    'app/api/assets/sheet-music/[id]/route.ts',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /dynamic\s*=\s*["']force-dynamic["']/);
  }

  const assetRouteSource = await read('app/api/assets/sheet-music/[id]/route.ts');
  assert.doesNotMatch(assetRouteSource, /export\s+const\s+runtime\s*=\s*["']nodejs["']/);
});

test('cache tag helpers define stable storyboard tags', async () => {
  const source = await read('lib/cache/tags.ts');
  for (const expected of [
    'songs',
    'song:',
    'song-presets:',
    'contis',
    'conti:',
    'conti-by-date:',
    'worship-prep:',
    'worship-prep-list',
  ]) {
    assert.match(source, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('invalidation helpers use immediate action and route invalidation APIs', async () => {
  const source = await read('lib/cache/invalidation.ts');
  assert.match(source, /from ['"]next\/cache['"]/);
  assert.match(source, /\bupdateTag\b/);
  assert.match(source, /\brevalidateTag\b/);
  assert.match(source, /expire:\s*0/);
  assert.match(source, /invalidateSong/);
  assert.match(source, /invalidateConti/);
  assert.match(source, /invalidateWorshipPrepDate/);
});
