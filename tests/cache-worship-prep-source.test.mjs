import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function getFunctionBody(source, name) {
  const match = source.match(
    new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `${name} should be exported`);
  return match[1];
}

test('worship prep queries opt into cache components with sheet-safe tags', async () => {
  const source = await read('lib/queries/worship-prep.ts');

  assert.match(source, /import \{ cacheLife, cacheTag \} from ['"]next\/cache['"]/);
  assert.match(source, /import \{ cacheTags \} from ['"]@\/lib\/cache\/tags['"]/);
  assert.match(
    source,
    /cacheLife\(\s*\{\s*stale:\s*60,\s*revalidate:\s*60,\s*expire:\s*300,\s*\}\s*\)/
  );

  const listBody = getFunctionBody(source, 'getWorshipPrepList');
  assert.match(listBody, /'use cache'/);
  assert.match(listBody, /cacheWorshipPrepForExternalSheetChanges\(\)/);
  assert.match(listBody, /cacheTag\(cacheTags\.worshipPrepList\(\)\)/);

  const detailBody = getFunctionBody(source, 'getWorshipPrepDetail');
  assert.match(detailBody, /'use cache'/);
  assert.match(detailBody, /cacheWorshipPrepForExternalSheetChanges\(\)/);
  assert.match(detailBody, /cacheTag\(cacheTags\.worshipPrep\(isoDate\)\)/);
});

test('worship prep server actions invalidate cached sheet data after mutations', async () => {
  const source = await read('lib/actions/worship-prep.ts');

  assert.match(source, /import \{ invalidateWorshipPrepSundayDate \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    source,
    /setActiveThread\(thread\.id,\s*yymmdd\)[\s\S]*invalidateWorshipPrepSundayDate\(yymmdd\)/
  );
  assert.match(
    source,
    /updateWorshipData\(SHEET_NAME,\s*targetRow,\s*mergedData\)[\s\S]*invalidateWorshipPrepSundayDate\(activeThread\.sundayDate\)/
  );
});

test('worship prep route handlers expire cached sheet data after external mutations', async () => {
  const cronSource = await read('app/api/cron/discord/parse-comments/route.ts');
  const interactionSource = await read('app/api/discord/interactions/route.ts');

  assert.match(cronSource, /import \{ expireWorshipPrepSundayDate \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    cronSource,
    /updateWorshipData\(SHEET_NAME,\s*targetRow,\s*mergedData\)[\s\S]*expireWorshipPrepSundayDate\(activeThread\.sundayDate\)/
  );

  assert.match(interactionSource, /import \{ expireWorshipPrepSundayDate \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    interactionSource,
    /updateRoleSelectionInSheet\(customId,\s*selectedValue,\s*sundayDate\)[\s\S]*expireWorshipPrepSundayDate\(sundayDate\)/
  );
});

test('worship prep pages stay compatible with cache components', async () => {
  for (const path of [
    'app/(authenticated)/worship-prep/page.tsx',
    'app/(authenticated)/worship-prep/[date]/page.tsx',
  ]) {
    const source = await read(path);
    assert.doesNotMatch(source, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/);
  }
});
