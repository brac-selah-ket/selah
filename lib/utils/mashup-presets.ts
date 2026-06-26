import type { SongPresetData } from "@/lib/types";

type PresetIdResult = { id: string };

export interface ResolveMashupPresetForImportInput {
  providedPresetId: string | null | undefined;
  createNewPreset: boolean;
  songIds: readonly [string, string];
  songNames: readonly [string, string];
  presetName: string;
  findPreset: (songIds: [string, string]) => Promise<PresetIdResult | null>;
  createPreset: (input: { songIds: [string, string]; data: SongPresetData }) => Promise<PresetIdResult>;
}

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

export async function resolveMashupPresetForImport({
  providedPresetId,
  createNewPreset,
  songIds,
  songNames,
  presetName,
  findPreset,
  createPreset,
}: ResolveMashupPresetForImportInput): Promise<string | null> {
  if (providedPresetId) return providedPresetId;

  const orderedSongIds: [string, string] = [songIds[0], songIds[1]];
  const existingPreset = await findPreset(orderedSongIds);
  if (existingPreset) return existingPreset.id;

  if (createNewPreset === false) return null;

  const blankPresetData = buildBlankMashupPresetData(songNames);
  try {
    const createdPreset = await createPreset({
      songIds: orderedSongIds,
      data: {
        ...blankPresetData,
        name: presetName.trim() || blankPresetData.name,
      },
    });
    return createdPreset.id;
  } catch (error) {
    const racedPreset = await findPreset(orderedSongIds);
    if (racedPreset) return racedPreset.id;
    throw error;
  }
}
