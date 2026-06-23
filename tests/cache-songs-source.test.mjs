import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function getFunctionBody(source, name) {
  const match = source.match(
    new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{([\\s\\S]*?)\\n\\}`)
  );
  assert.ok(match, `${name} should be exported`);
  return match[1];
}

test('song collection queries use next cache tags and hourly cache life', async () => {
  const source = await read('lib/queries/songs.ts');

  assert.match(source, /from ['"]next\/cache['"]/);

  for (const [name, tagPattern] of [
    ['getSongs', /cacheTag\(cacheTags\.songs\(\)\)/],
    ['searchSongs', /cacheTag\(cacheTags\.songs\(\)\)/],
    ['getSongPresets', /cacheTag\(cacheTags\.songPresets\(songId\)\)/],
  ]) {
    const body = getFunctionBody(source, name);
    assert.match(body, /'use cache'/, `${name} should opt into cache components`);
    assert.match(body, /cacheLife\(['"]hours['"]\)/, `${name} should cache for hours`);
    assert.match(body, tagPattern, `${name} should use the expected cache tag`);
  }
});

test('song detail queries stay uncached because mashup presets depend on linked songs', async () => {
  const source = await read('lib/queries/songs.ts');

  for (const name of ['getSong', 'getSongPresetsWithSheetMusic']) {
    const body = getFunctionBody(source, name);
    assert.doesNotMatch(body, /'use cache'/, `${name} should not cache cross-song preset editor data`);
    assert.doesNotMatch(body, /cacheLife\(/, `${name} should not set cache life`);
    assert.doesNotMatch(body, /cacheTag\(/, `${name} should not tag cached detail data`);
  }
});

test('song mutations invalidate the song list and changed song entries', async () => {
  const source = await read('lib/actions/songs.ts');

  assert.match(source, /import \{ invalidateSong, invalidateSongs \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    source,
    /createSong[\s\S]*createSong\([\s\S]*\)[\s\S]*invalidateSongs\(\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  assert.match(
    source,
    /updateSong[\s\S]*updateSong\(id,[\s\S]*\)[\s\S]*invalidateSong\(id\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  const updateBody = getFunctionBody(source, 'updateSong');
  assert.match(updateBody, /revalidatePath\(`\/songs\/\$\{id\}`\)/);
  assert.match(updateBody, /revalidatePath\(`\/songs\/\$\{id\}\/edit`\)/);

  assert.match(
    source,
    /deleteSong[\s\S]*deleteSong\(id\)[\s\S]*invalidateSong\(id\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  const deleteBody = getFunctionBody(source, 'deleteSong');
  assert.match(deleteBody, /revalidatePath\(`\/songs\/\$\{id\}`\)/);
  assert.match(deleteBody, /revalidatePath\(`\/songs\/\$\{id\}\/edit`\)/);
});

test('song invalidation includes preset cache entries', async () => {
  const source = await read('lib/cache/invalidation.ts');
  const body = getFunctionBody(source, 'invalidateSong');

  assert.match(body, /cacheTags\.songPresets\(songId\)/);
});

test('sheet music mutations invalidate song detail cache entries', async () => {
  const source = await read('lib/actions/sheet-music.ts');

  assert.match(source, /import \{ invalidateSongDetail \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    source,
    /uploadSheetMusic[\s\S]*createSheetMusicFile[\s\S]*invalidateSongDetail\(songId\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  const uploadBody = getFunctionBody(source, 'uploadSheetMusic');
  assert.match(uploadBody, /revalidatePath\(`\/songs\/\$\{songId\}`\)/);
  assert.match(uploadBody, /revalidatePath\(`\/songs\/\$\{songId\}\/edit`\)/);

  assert.match(
    source,
    /deleteSheetMusic[\s\S]*deleteSheetMusicFile\(fileId\)[\s\S]*invalidateSongDetail\(file\.songId\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  const deleteBody = getFunctionBody(source, 'deleteSheetMusic');
  assert.match(deleteBody, /revalidatePath\(`\/songs\/\$\{file\.songId\}`\)/);
  assert.match(deleteBody, /revalidatePath\(`\/songs\/\$\{file\.songId\}\/edit`\)/);

  assert.match(
    source,
    /reorderSheetMusic[\s\S]*reorderSheetMusic\(songId, orderedIds\)[\s\S]*invalidateSongDetail\(songId\)[\s\S]*revalidatePath\(['"]\/songs['"]\)/
  );
  const reorderBody = getFunctionBody(source, 'reorderSheetMusic');
  assert.match(reorderBody, /revalidatePath\(`\/songs\/\$\{songId\}`\)/);
  assert.match(reorderBody, /revalidatePath\(`\/songs\/\$\{songId\}\/edit`\)/);
});

test('song preset mutations invalidate preset cache entries', async () => {
  const source = await read('lib/actions/song-presets.ts');

  assert.match(source, /import \{ invalidateSongPresets \} from ['"]@\/lib\/cache\/invalidation['"]/);
  assert.match(
    source,
    /createSongPreset[\s\S]*createSongPreset\(songId,[\s\S]*\)[\s\S]*invalidateSongPresets\(songId\)[\s\S]*revalidatePath\(`\/songs\/\$\{songId\}`\)/
  );
  assert.match(
    source,
    /function invalidatePresetSongIds\(songIds:[\s\S]*for \(const songId of new Set\(songIds\)\)[\s\S]*invalidateSongPresets\(songId\)[\s\S]*revalidatePath\(`\/songs\/\$\{songId\}`\)/
  );
  assert.match(
    source,
    /updateSongPreset[\s\S]*updateSongPreset\([\s\S]*presetId,[\s\S]*data,[\s\S]*resolvedYoutube,[\s\S]*optionValidation\.data,[\s\S]*\)[\s\S]*invalidatePresetSongIds\(\[\.\.\.beforeSongIds, \.\.\.afterSongIds\]\)/
  );
  assert.match(
    source,
    /deleteSongPreset[\s\S]*deleteSongPreset\(presetId\)[\s\S]*invalidatePresetSongIds\(songIds\.length > 0 \? songIds : \[existing\.songId\]\)/
  );
  assert.match(
    source,
    /setDefaultPreset[\s\S]*setDefaultPreset\(songId, presetId\)[\s\S]*invalidateSongPresets\(songId\)[\s\S]*revalidatePath\(`\/songs\/\$\{songId\}`\)/
  );
});
