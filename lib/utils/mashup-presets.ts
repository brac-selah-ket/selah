import type { SongPresetData } from "@/lib/types";

export function assertOrderedMashupPair(songIds: readonly string[]) {
  if (songIds.length !== 2) {
    throw new Error("매시업 프리셋은 정확히 두 곡이 필요합니다");
  }
}

export function getOrderedSongPairKey(songIds: readonly [string, string] | readonly string[]): string {
  assertOrderedMashupPair(songIds);
  return `${songIds[0]}→${songIds[1]}`;
}

export function getMashupDisplayTitle(
  displayTitle: string | null | undefined,
  songNames: readonly string[],
): string {
  const trimmed = displayTitle?.trim();
  return trimmed || songNames[0] || "매시업";
}

export function buildBlankMashupPresetData(songNames: readonly [string, string] | readonly string[]): SongPresetData {
  assertOrderedMashupPair(songNames);

  return {
    name: `${songNames[0]} + ${songNames[1]}`,
    displayTitle: null,
    keys: [],
    tempos: [],
    sectionOrder: [],
    lyrics: [],
    sectionLyricsMap: {},
    notes: null,
    isDefault: false,
    youtubeReference: null,
    youtubeTitle: null,
    sheetMusicFileIds: [],
    pdfMetadata: null,
  };
}
