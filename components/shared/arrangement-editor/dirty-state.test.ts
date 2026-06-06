import assert from "node:assert/strict"
import test from "node:test"
import type { ArrangementDraft } from "./types.ts"
import {
  areArrangementDraftsEqual,
  normalizeArrangementDraftForDirtyCheck,
} from "./dirty-state.ts"

const baseDraft: ArrangementDraft = {
  name: "영접송",
  keys: ["G"],
  tempos: [59],
  sectionOrder: ["Intro", "V"],
  lyrics: ["line"],
  sectionLyricsMap: { 0: [0] },
  notes: null,
  sheetMusicFileIds: null,
  pdfMetadata: null,
  youtubeReference: "https://www.youtube.com/watch?v=W1uussHIX9o",
  youtubeTitle: "Invitation",
  isDefault: false,
  appliedPresetId: "preset-1",
}

test("normalizeArrangementDraftForDirtyCheck normalizes YouTube watch URLs to video ids", () => {
  const normalized = normalizeArrangementDraftForDirtyCheck(baseDraft)

  assert.equal(normalized.youtubeReference, "W1uussHIX9o")
})

test("optional values and raw YouTube video ids are treated as unchanged", () => {
  const nextDraft: ArrangementDraft = {
    ...baseDraft,
    notes: "   ",
    youtubeReference: "W1uussHIX9o",
    youtubeTitle: " Invitation ",
  }

  assert.equal(areArrangementDraftsEqual(baseDraft, nextDraft), true)
})

test("sheetMusicFileIds null and selecting all available ids are treated as unchanged", () => {
  const allSheetMusicIds = ["sheet-1", "sheet-2"]
  const nextDraft: ArrangementDraft = {
    ...baseDraft,
    sheetMusicFileIds: ["sheet-2", "sheet-1"],
  }

  assert.equal(areArrangementDraftsEqual(baseDraft, nextDraft, allSheetMusicIds), true)
})

test("equivalent pdfMetadata objects with different key insertion order are treated as unchanged", () => {
  const leftDraft: ArrangementDraft = {
    ...baseDraft,
    pdfMetadata: {
      pageAssignments: [
        {
          sectionName: "Verse",
          pageIndex: 0,
        },
      ],
      layout: {
        showSongTitle: true,
        marginTop: 12,
      },
    },
  }

  const rightDraft: ArrangementDraft = {
    ...baseDraft,
    pdfMetadata: {
      layout: {
        marginTop: 12,
        showSongTitle: true,
      },
      pageAssignments: [
        {
          pageIndex: 0,
          sectionName: "Verse",
        },
      ],
    },
  }

  assert.equal(areArrangementDraftsEqual(leftDraft, rightDraft), true)
})

test("real key changes are detected", () => {
  const nextDraft: ArrangementDraft = {
    ...baseDraft,
    keys: ["A"],
  }

  assert.equal(areArrangementDraftsEqual(baseDraft, nextDraft), false)
})
