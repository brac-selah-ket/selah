import assert from "node:assert/strict";
import { test } from "vitest";
import { buildArrangementItems } from "./arrangement-items.ts";
import type { ContiSongWithSong, SongPresetType } from "@/lib/types.ts";

function contiSong(
  id: string,
  songId: string,
  name: string,
  sortOrder: number,
  overrides: Partial<ContiSongWithSong["overrides"]> = {},
  mashup?: {
    groupId: string;
    partOrder: number;
    presetName?: string;
    displayTitle?: string | null;
    presetType?: SongPresetType;
  },
): ContiSongWithSong {
  const now = new Date("2026-06-19T00:00:00Z");
  return {
    id,
    contiId: "conti-1",
    songId,
    sortOrder,
    keys: null,
    tempos: null,
    sectionOrder: null,
    lyrics: null,
    sectionLyricsMap: null,
    notes: null,
    sheetMusicFileIds: null,
    presetId: overrides.presetId ?? null,
    mashupGroupId: mashup?.groupId ?? null,
    mashupPartOrder: mashup?.partOrder ?? null,
    preMashupPresetId: null,
    createdAt: now,
    updatedAt: now,
    song: { id: songId, name, createdAt: now, updatedAt: now },
    overrides: {
      keys: overrides.keys ?? [],
      tempos: overrides.tempos ?? [],
      sectionOrder: overrides.sectionOrder ?? [],
      lyrics: overrides.lyrics ?? [],
      sectionLyricsMap: overrides.sectionLyricsMap ?? {},
      notes: overrides.notes ?? null,
      sheetMusicFileIds: overrides.sheetMusicFileIds ?? null,
      presetId: overrides.presetId ?? null,
    },
    appliedPreset: mashup
      ? {
          id: overrides.presetId ?? "preset-mashup",
          name: mashup.presetName ?? "Mashup",
          displayTitle: mashup.displayTitle ?? null,
          presetType: mashup.presetType ?? "mashup",
          youtubeReference: null,
          youtubeTitle: null,
        }
      : null,
  };
}

test("groups two adjacent mashup rows into one arrangement item", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0, displayTitle: "A / B" }),
    contiSong("cs-2", "song-b", "B", 1, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 1, displayTitle: "A / B" }),
    contiSong("cs-3", "song-c", "C", 2),
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0].key, "mashup:group-1");
  assert.equal(items[0].type, "mashup");
  assert.equal(items[0].displayTitle, "A / B");
  assert.deepEqual(items[0].displaySongNames, ["A", "B"]);
  assert.equal(items[0].primarySong.id, "cs-1");
  assert.equal(items[1].key, "conti-song:cs-3");
});

test("falls back to raw rows when a mashup group is incomplete", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0 }),
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].key, "conti-song:cs-1");
  assert.equal(items[0].type, "single");
});

test("falls back to raw rows when mashup members are not adjacent in sort order", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0 }),
    contiSong("cs-2", "song-c", "C", 1),
    contiSong("cs-3", "song-b", "B", 2, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 1 }),
  ]);

  assert.deepEqual(
    items.map((item) => item.key),
    ["conti-song:cs-1", "conti-song:cs-2", "conti-song:cs-3"],
  );
  assert.deepEqual(items.map((item) => item.type), ["single", "single", "single"]);
});

test("falls back to raw rows when mashup group does not have a real mashup preset", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, {}, { groupId: "group-1", partOrder: 0 }),
    contiSong("cs-2", "song-b", "B", 1, {}, { groupId: "group-1", partOrder: 1 }),
  ]);

  assert.deepEqual(
    items.map((item) => item.key),
    ["conti-song:cs-1", "conti-song:cs-2"],
  );
  assert.deepEqual(items.map((item) => item.type), ["single", "single"]);
});

test("falls back to raw rows when mashup part orders are not exactly zero and one", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0 }),
    contiSong("cs-2", "song-b", "B", 1, { presetId: "preset-m" }, { groupId: "group-1", partOrder: 0 }),
  ]);

  assert.deepEqual(
    items.map((item) => item.key),
    ["conti-song:cs-1", "conti-song:cs-2"],
  );
  assert.deepEqual(items.map((item) => item.type), ["single", "single"]);
});

test("falls back to raw rows when applied preset is not a mashup preset", () => {
  const items = buildArrangementItems([
    contiSong("cs-1", "song-a", "A", 0, { presetId: "preset-single" }, { groupId: "group-1", partOrder: 0, presetType: "single" }),
    contiSong("cs-2", "song-b", "B", 1, { presetId: "preset-single" }, { groupId: "group-1", partOrder: 1, presetType: "single" }),
  ]);

  assert.deepEqual(
    items.map((item) => item.key),
    ["conti-song:cs-1", "conti-song:cs-2"],
  );
  assert.deepEqual(items.map((item) => item.type), ["single", "single"]);
});
