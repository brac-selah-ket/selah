import type { ContiSongSummary } from "@/lib/types";
import { getMashupDisplayTitle } from "@/lib/utils/mashup-presets";

export interface ContiSongSummaryItem {
  key: string;
  type: "summary" | "mashup";
  displayTitle: string;
  displaySongNames: string[];
  songs: ContiSongSummary[];
  primarySong: ContiSongSummary;
  presetId: string | null;
  presetName: string | null;
  sectionOrder: string[];
  tempos: number[];
  keys: string[];
}

function buildSingleSummaryItem(song: ContiSongSummary): ContiSongSummaryItem {
  return {
    key: `summary:${song.id}`,
    type: "summary",
    displayTitle: song.songName,
    displaySongNames: [song.songName],
    songs: [song],
    primarySong: song,
    presetId: song.presetId,
    presetName: song.presetName,
    sectionOrder: song.sectionOrder,
    tempos: song.tempos,
    keys: song.keys,
  };
}

function isValidMashupSummaryGroup(
  group: readonly ContiSongSummary[],
  currentSong: ContiSongSummary,
  orderedSongs: readonly ContiSongSummary[],
): group is [ContiSongSummary, ContiSongSummary] {
  if (group.length !== 2) return false;
  if (group[0].mashupPartOrder !== 0 || group[1].mashupPartOrder !== 1) return false;
  if (!currentSong.presetId) return false;
  if (!group.every((entry) => entry.presetId === currentSong.presetId)) return false;
  if (group.some((entry) => entry.presetType !== "mashup")) return false;

  const firstIndex = orderedSongs.findIndex((entry) => entry.id === group[0].id);
  return firstIndex >= 0 && orderedSongs[firstIndex + 1]?.id === group[1].id;
}

export function buildContiSongSummaryItems(
  songs: readonly ContiSongSummary[],
): ContiSongSummaryItem[] {
  const ordered = [...songs].sort((left, right) => left.sortOrder - right.sortOrder);
  const byGroup = new Map<string, ContiSongSummary[]>();
  for (const song of ordered) {
    if (!song.mashupGroupId) continue;
    const group = byGroup.get(song.mashupGroupId) ?? [];
    group.push(song);
    byGroup.set(song.mashupGroupId, group);
  }

  const consumed = new Set<string>();
  const items: ContiSongSummaryItem[] = [];

  for (const song of ordered) {
    if (consumed.has(song.id)) continue;

    if (song.mashupGroupId) {
      const group = (byGroup.get(song.mashupGroupId) ?? [])
        .slice()
        .sort((left, right) => (left.mashupPartOrder ?? 0) - (right.mashupPartOrder ?? 0));

      if (isValidMashupSummaryGroup(group, song, ordered)) {
        for (const member of group) consumed.add(member.id);
        const primary = group[0];
        const displayTitle = getMashupDisplayTitle(
          primary.presetDisplayTitle,
          group.map((entry) => entry.songName),
        );
        items.push({
          key: `mashup:${song.mashupGroupId}`,
          type: "mashup",
          displayTitle,
          displaySongNames: group.map((entry) => entry.songName),
          songs: group,
          primarySong: primary,
          presetId: primary.presetId,
          presetName: primary.presetName,
          sectionOrder: primary.sectionOrder,
          tempos: primary.tempos,
          keys: primary.keys,
        });
        continue;
      }
    }

    consumed.add(song.id);
    items.push(buildSingleSummaryItem(song));
  }

  return items;
}
