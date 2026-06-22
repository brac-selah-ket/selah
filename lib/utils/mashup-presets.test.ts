import assert from "node:assert/strict";
import { test } from "vitest";
import {
  assertOrderedMashupPair,
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
