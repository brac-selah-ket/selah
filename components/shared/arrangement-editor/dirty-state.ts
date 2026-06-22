import { normalizeYouTubeReference } from "../../../lib/utils/youtube.ts"
import type { ArrangementDraft } from "./types.ts"

export interface NormalizedArrangementDraftForDirtyCheck {
  name: string
  displayTitle: string | null
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  sheetMusicFileIds: string[] | null
  pdfMetadata: ArrangementDraft["pdfMetadata"]
  youtubeReference: string | null
  youtubeTitle: string | null
  isDefault: boolean
  appliedPresetId: string | null
}

export function cloneDraft(draft: ArrangementDraft): ArrangementDraft {
  return {
    ...draft,
    keys: [...draft.keys],
    tempos: [...draft.tempos],
    sectionOrder: [...draft.sectionOrder],
    lyrics: [...draft.lyrics],
    sectionLyricsMap: Object.fromEntries(
      Object.entries(draft.sectionLyricsMap).map(([key, value]) => [Number(key), [...value]]),
    ) as Record<number, number[]>,
    sheetMusicFileIds: draft.sheetMusicFileIds ? [...draft.sheetMusicFileIds] : null,
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeStringList(values: string[], options?: { filterEmpty?: boolean }) {
  const normalized = values.map((value) => value.trim())
  return options?.filterEmpty ? normalized.filter(Boolean) : normalized
}

function normalizeNumberList(values: number[]) {
  return values.filter(Number.isFinite)
}

function normalizeSectionLyricsMap(sectionLyricsMap: ArrangementDraft["sectionLyricsMap"]) {
  return Object.fromEntries(
    Object.entries(sectionLyricsMap)
      .map(([key, value]) => [Number(key), value.filter(Number.isFinite)] as const)
      .filter(([key]) => Number.isFinite(key))
      .sort(([a], [b]) => a - b),
  ) as Record<number, number[]>
}

function normalizeSheetMusicFileIds(
  sheetMusicFileIds: ArrangementDraft["sheetMusicFileIds"],
  allSheetMusicIds: string[],
) {
  if (sheetMusicFileIds === null) {
    return null
  }

  const availableIds = new Set(allSheetMusicIds)
  const normalizedIds = [...new Set(sheetMusicFileIds.map((id) => id.trim()).filter((id) => id && availableIds.has(id)))]
    .sort()

  if (normalizedIds.length === 0) {
    return allSheetMusicIds.length === 0 ? [] : []
  }

  const normalizedAvailableIds = [...new Set(allSheetMusicIds.map((id) => id.trim()).filter(Boolean))].sort()
  if (
    normalizedAvailableIds.length > 0 &&
    normalizedIds.length === normalizedAvailableIds.length &&
    normalizedIds.every((id, index) => id === normalizedAvailableIds[index])
  ) {
    return null
  }

  return normalizedIds
}

function normalizePdfMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizePdfMetadataValue)
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nestedValue]) => [key, normalizePdfMetadataValue(nestedValue)]),
    )
  }

  return value
}

export function normalizeArrangementDraftForDirtyCheck(
  draft: ArrangementDraft,
  allSheetMusicIds: string[] = [],
): NormalizedArrangementDraftForDirtyCheck {
  return {
    name: draft.name.trim(),
    displayTitle: normalizeOptionalString(draft.displayTitle),
    keys: normalizeStringList(draft.keys, { filterEmpty: true }),
    tempos: normalizeNumberList(draft.tempos),
    sectionOrder: normalizeStringList(draft.sectionOrder, { filterEmpty: true }),
    lyrics: normalizeStringList(draft.lyrics),
    sectionLyricsMap: normalizeSectionLyricsMap(draft.sectionLyricsMap),
    notes: normalizeOptionalString(draft.notes),
    sheetMusicFileIds: normalizeSheetMusicFileIds(draft.sheetMusicFileIds, allSheetMusicIds),
    pdfMetadata: normalizePdfMetadataValue(draft.pdfMetadata) as ArrangementDraft["pdfMetadata"],
    youtubeReference: normalizeYouTubeReference(draft.youtubeReference)?.videoId ?? normalizeOptionalString(draft.youtubeReference),
    youtubeTitle: normalizeOptionalString(draft.youtubeTitle),
    isDefault: draft.isDefault,
    appliedPresetId: normalizeOptionalString(draft.appliedPresetId),
  }
}

export function areArrangementDraftsEqual(
  a: ArrangementDraft,
  b: ArrangementDraft,
  allSheetMusicIds: string[] = [],
) {
  return JSON.stringify(normalizeArrangementDraftForDirtyCheck(a, allSheetMusicIds))
    === JSON.stringify(normalizeArrangementDraftForDirtyCheck(b, allSheetMusicIds))
}
