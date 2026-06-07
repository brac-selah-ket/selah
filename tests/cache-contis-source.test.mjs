import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function getFunctionBody(source, name) {
  const match = source.match(
    new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `${name} should be exported`);
  return match[1];
}

test('conti queries use next cache tags and hourly cache life', async () => {
  const source = await read('lib/queries/contis.ts');

  assert.match(source, /from ['"]next\/cache['"]/);

  for (const [name, tagPattern] of [
    ['getContis', /cacheTag\(cacheTags\.contis\(\)\)/],
    ['getContisWithSongSummaries', /cacheTag\(cacheTags\.contis\(\)\)/],
    ['getContiByDate', /cacheTag\(\s*cacheTags\.contis\(\),\s*cacheTags\.contiByDate\(date\)\s*\)/],
    ['getConti', /cacheTag\(cacheTags\.conti\(id\)\)/],
    ['getContiForExport', /cacheTag\(cacheTags\.conti\(id\)\)/],
    ['getContiPdfExport', /cacheTag\(cacheTags\.conti\(contiId\)\)/],
  ]) {
    const body = getFunctionBody(source, name);
    assert.match(body, /'use cache'/, `${name} should opt into cache components`);
    assert.match(body, /cacheLife\(['"]hours['"]\)/, `${name} should cache for hours`);
    assert.match(body, tagPattern, `${name} should use the expected cache tag`);
  }
});
