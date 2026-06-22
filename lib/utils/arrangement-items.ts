import type { ArrangementItem, ContiSongWithSong } from "@/lib/types";
import { getMashupDisplayTitle } from "@/lib/utils/mashup-presets";

function buildSingleItem(song: ContiSongWithSong): ArrangementItem {
  return {
    key: `conti-song:${song.id}`,
    type: "single",
    displayTitle: song.song.name,
    displaySongNames: [song.song.name],
    songs: [song],
    primarySong: song,
    presetId: song.overrides.presetId,
    sectionOrder: song.overrides.sectionOrder,
    lyrics: song.overrides.lyrics,
    sectionLyricsMap: song.overrides.sectionLyricsMap,
    tempos: song.overrides.tempos,
    keys: song.overrides.keys,
  };
}

function isValidMashupGroup(
  group: readonly ContiSongWithSong[],
  currentSong: ContiSongWithSong,
  orderedSongs: readonly ContiSongWithSong[],
): group is [ContiSongWithSong, ContiSongWithSong] {
  if (group.length !== 2) return false;
  if (group[0].mashupPartOrder !== 0 || group[1].mashupPartOrder !== 1) return false;
  if (!currentSong.overrides.presetId) return false;
  if (!group.every((entry) => entry.overrides.presetId === currentSong.overrides.presetId)) {
    return false;
  }
  if (group.some((entry) => entry.appliedPreset && entry.appliedPreset.presetType !== "mashup")) {
    return false;
  }

  const firstIndex = orderedSongs.findIndex((entry) => entry.id === group[0].id);
  return firstIndex >= 0 && orderedSongs[firstIndex + 1]?.id === group[1].id;
}

export function buildArrangementItems(songs: readonly ContiSongWithSong[]): ArrangementItem[] {
  const ordered = [...songs].sort((left, right) => left.sortOrder - right.sortOrder);
  const byGroup = new Map<string, ContiSongWithSong[]>();
  for (const song of ordered) {
    if (!song.mashupGroupId) continue;
    const group = byGroup.get(song.mashupGroupId) ?? [];
    group.push(song);
    byGroup.set(song.mashupGroupId, group);
  }

  const consumed = new Set<string>();
  const items: ArrangementItem[] = [];

  for (const song of ordered) {
    if (consumed.has(song.id)) continue;

    if (song.mashupGroupId) {
      const group = (byGroup.get(song.mashupGroupId) ?? [])
        .slice()
        .sort((left, right) => (left.mashupPartOrder ?? 0) - (right.mashupPartOrder ?? 0));

      if (isValidMashupGroup(group, song, ordered)) {
        for (const member of group) consumed.add(member.id);
        const primary = group[0];
        const displayTitle = getMashupDisplayTitle(
          primary.appliedPreset?.displayTitle,
          group.map((entry) => entry.song.name),
        );
        items.push({
          key: `mashup:${song.mashupGroupId}`,
          type: "mashup",
          displayTitle,
          displaySongNames: group.map((entry) => entry.song.name),
          songs: group,
          primarySong: primary,
          presetId: primary.overrides.presetId,
          sectionOrder: primary.overrides.sectionOrder,
          lyrics: primary.overrides.lyrics,
          sectionLyricsMap: primary.overrides.sectionLyricsMap,
          tempos: primary.overrides.tempos,
          keys: primary.overrides.keys,
        });
        continue;
      }
    }

    consumed.add(song.id);
    items.push(buildSingleItem(song));
  }

  return items;
}
