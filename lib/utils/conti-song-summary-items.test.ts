import assert from "node:assert/strict";
import { test } from "vitest";
import { buildContiSongSummaryItems } from "./conti-song-summary-items.ts";
import type { ContiSongSummary } from "@/lib/types.ts";

function summary(
  id: string,
  songName: string,
  sortOrder: number,
  mashup?: {
    groupId: string;
    partOrder: number;
    presetType?: "single" | "mashup";
    displayTitle?: string | null;
  },
): ContiSongSummary {
  return {
    id,
    songId: `song-${id}`,
    sortOrder,
    songName,
    keys: id === "a" ? ["G"] : [],
    tempos: id === "a" ? [72] : [],
    sectionOrder: id === "a" ? ["V", "C"] : [],
    presetId: mashup ? "preset-m" : null,
    presetName: mashup ? "매시업 프리셋" : null,
    presetType: mashup?.presetType ?? null,
    presetDisplayTitle: mashup?.displayTitle ?? null,
    youtubeReference: null,
    youtubeTitle: null,
    hasSheetMusicSelection: false,
    mashupGroupId: mashup?.groupId ?? null,
    mashupPartOrder: mashup?.partOrder ?? null,
  };
}

test("summary rows group adjacent mashup members into one item", () => {
  const items = buildContiSongSummaryItems([
    summary("a", "A", 0, {
      groupId: "group-1",
      partOrder: 0,
      presetType: "mashup",
      displayTitle: "A / B",
    }),
    summary("b", "B", 1, {
      groupId: "group-1",
      partOrder: 1,
      presetType: "mashup",
      displayTitle: "A / B",
    }),
    summary("c", "C", 2),
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0].key, "mashup:group-1");
  assert.equal(items[0].type, "mashup");
  assert.equal(items[0].displayTitle, "A / B");
  assert.deepEqual(items[0].displaySongNames, ["A", "B"]);
  assert.equal(items[0].presetName, "매시업 프리셋");
  assert.deepEqual(items[0].keys, ["G"]);
  assert.equal(items[1].key, "summary:c");
});

test("summary rows stay separate when the preset is not a mashup preset", () => {
  const items = buildContiSongSummaryItems([
    summary("a", "A", 0, {
      groupId: "group-1",
      partOrder: 0,
      presetType: "single",
    }),
    summary("b", "B", 1, {
      groupId: "group-1",
      partOrder: 1,
      presetType: "single",
    }),
  ]);

  assert.deepEqual(items.map((item) => item.key), ["summary:a", "summary:b"]);
  assert.deepEqual(items.map((item) => item.type), ["summary", "summary"]);
});
