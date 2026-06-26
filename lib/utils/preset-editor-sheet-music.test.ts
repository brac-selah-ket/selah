import assert from "node:assert/strict";
import { test } from "vitest";
import { buildPresetEditorSheetMusic } from "./preset-editor-sheet-music.ts";
import type { SheetMusicFile, SongPresetWithSheetMusic } from "@/lib/types.ts";

function sheetMusic(id: string, songId: string, sortOrder = 0): SheetMusicFile {
  return {
    id,
    songId,
    fileUrl: `https://example.com/${id}.pdf`,
    fileName: `${id}.pdf`,
    fileType: "application/pdf",
    sortOrder,
    createdAt: new Date("2026-06-19T00:00:00Z"),
  };
}

function preset(data: Partial<SongPresetWithSheetMusic>): SongPresetWithSheetMusic {
  const now = new Date("2026-06-19T00:00:00Z");
  return {
    id: "preset-1",
    songId: "song-b",
    presetType: "mashup",
    displayTitle: null,
    mashupPairKey: "song-a::song-b",
    name: "A + B",
    keys: "[]",
    tempos: "[]",
    sectionOrder: "[]",
    lyrics: "[]",
    sectionLyricsMap: "{}",
    notes: null,
    youtubeReference: null,
    youtubeTitle: null,
    pdfMetadata: null,
    isDefault: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    sheetMusicFileIds: [],
    members: [],
    ...data,
  };
}

test("mashup preset editor orders sheet music by mashup member order on either song page", () => {
  const currentSongSheetMusic = [
    sheetMusic("b-1", "song-b", 0),
    sheetMusic("b-2", "song-b", 1),
  ];
  const mashupPreset = preset({
    sheetMusicFileIds: ["a-1"],
    availableSheetMusic: [
      sheetMusic("a-1", "song-a", 0),
      sheetMusic("b-1", "song-b", 0),
    ],
  });

  const files = buildPresetEditorSheetMusic(mashupPreset, currentSongSheetMusic);

  assert.deepEqual(files.map((file) => file.id), ["a-1", "b-1", "b-2"]);
});

test("single preset editor only uses current song sheet music", () => {
  const currentSongSheetMusic = [sheetMusic("b-1", "song-b", 0)];
  const singlePreset = preset({
    presetType: "single",
    sheetMusicFileIds: ["a-1"],
    availableSheetMusic: [sheetMusic("a-1", "song-a", 0)],
  });

  const files = buildPresetEditorSheetMusic(singlePreset, currentSongSheetMusic);

  assert.deepEqual(files.map((file) => file.id), ["b-1"]);
});
