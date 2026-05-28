import assert from 'node:assert/strict';
import test from 'node:test';

import { getSheetMusicAssetUrl, getSheetMusicDownloadUrl } from './sheet-music-assets.ts';

test('sheet music asset URLs are same-origin API URLs', () => {
  assert.equal(getSheetMusicAssetUrl({ id: 'file 1' }), '/api/assets/sheet-music/file%201');
  assert.equal(getSheetMusicDownloadUrl({ id: 'file 1' }), '/api/assets/sheet-music/file%201?download=1');
});
