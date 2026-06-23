import type { SongPresetType } from "../song-preset-types.ts"

export interface MashupLyricsCandidate {
  songId: string
  presetType: SongPresetType
  isDefault: boolean
  sortOrder: number
  lyrics: string | null
}

interface ParsedLyricsCandidate extends MashupLyricsCandidate {
  parsedLyrics: string[]
}

function parseLyrics(field: string | null): string[] {
  if (!field) return []

  try {
    const parsed = JSON.parse(field) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

export function buildMashupFallbackLyrics(
  memberSongIds: readonly string[],
  candidates: readonly MashupLyricsCandidate[],
): string[] {
  const candidatesBySongId = new Map<string, ParsedLyricsCandidate[]>()

  for (const candidate of candidates) {
    if (candidate.presetType !== "single") continue

    const parsedLyrics = parseLyrics(candidate.lyrics)
    if (parsedLyrics.length === 0) continue

    const existing = candidatesBySongId.get(candidate.songId) ?? []
    existing.push({ ...candidate, parsedLyrics })
    candidatesBySongId.set(candidate.songId, existing)
  }

  return memberSongIds.flatMap((songId) => {
    const songCandidates = candidatesBySongId.get(songId) ?? []
    const [selected] = songCandidates
      .slice()
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1
        }
        return left.sortOrder - right.sortOrder
      })

    return selected?.parsedLyrics ?? []
  })
}
