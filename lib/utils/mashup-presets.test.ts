import assert from "node:assert/strict";
import { test } from "vitest";
import {
  assertOrderedMashupPair,
  buildBlankMashupPresetData,
  getMashupDisplayTitle,
  getOrderedSongPairKey,
} from "./mashup-presets.ts";

test("ordered song pair keys preserve front and back song order", () => {
  assert.equal(getOrderedSongPairKey(["song-a", "song-b"]), "song-a→song-b");
  assert.equal(getOrderedSongPairKey(["song-b", "song-a"]), "song-b→song-a");
});

test("assertOrderedMashupPair rejects non-two-song membership", () => {
  assert.throws(() => assertOrderedMashupPair(["song-a"]), /정확히 두 곡/);
  assert.throws(() => assertOrderedMashupPair(["song-a", "song-b", "song-c"]), /정확히 두 곡/);
  assert.doesNotThrow(() => assertOrderedMashupPair(["song-a", "song-b"]));
});

test("mashup display title prefers custom title and falls back to the first song", () => {
  assert.equal(getMashupDisplayTitle("  A+B  ", ["A", "B"]), "A+B");
  assert.equal(getMashupDisplayTitle(null, ["A", "B"]), "A");
  assert.equal(getMashupDisplayTitle(" ", ["A", "B"]), "A");
});

test("blank mashup preset data uses ordered song names and shared empty arrangement", () => {
  const data = buildBlankMashupPresetData(["초대", "부르심"]);

  assert.equal(data.name, "초대 + 부르심");
  assert.equal(data.displayTitle, null);
  assert.equal(data.isDefault, false);
  assert.deepEqual(data.keys, []);
  assert.deepEqual(data.tempos, []);
  assert.deepEqual(data.sectionOrder, []);
  assert.deepEqual(data.lyrics, []);
  assert.deepEqual(data.sectionLyricsMap, {});
  assert.deepEqual(data.sheetMusicFileIds, []);
  assert.equal(data.pdfMetadata, null);
});
