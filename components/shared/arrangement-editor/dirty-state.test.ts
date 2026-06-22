import assert from "node:assert/strict"
import { test } from "vitest"
import type { ArrangementDraft } from "./types.ts"
import {
  areArrangementDraftsEqual,
  normalizeArrangementDraftForDirtyCheck,
} from "./dirty-state.ts"

const baseDraft: ArrangementDraft = {
  name: "영접송",
  displayTitle: "영접송 + 초대",
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
    displayTitle: " 영접송 + 초대 ",
    notes: "   ",
    youtubeReference: "W1uussHIX9o",
    youtubeTitle: " Invitation ",
  }

  assert.equal(areArrangementDraftsEqual(baseDraft, nextDraft), true)
})

test("display title changes are detected", () => {
  const nextDraft: ArrangementDraft = {
    ...baseDraft,
    displayTitle: "초대 + 영접송",
  }

  assert.equal(areArrangementDraftsEqual(baseDraft, nextDraft), false)
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
      files: [
        {
          sheetMusicFileId: "sheet-1",
          pages: [
            {
              pdfPageIndex: 0,
              cropX: 12,
              imageScale: 1.1,
              overlays: [
                {
                  id: "overlay-1",
                  type: "custom",
                  text: "Verse 1",
                  x: 100,
                  y: 120,
                  fontSize: 18,
                  color: "#ffffff",
                },
              ],
            },
          ],
        },
      ],
    },
  }

  const rightDraft: ArrangementDraft = {
    ...baseDraft,
    pdfMetadata: {
      files: [
        {
          pages: [
            {
              overlays: [
                {
                  color: "#ffffff",
                  fontSize: 18,
                  y: 120,
                  x: 100,
                  text: "Verse 1",
                  type: "custom",
                  id: "overlay-1",
                },
              ],
              imageScale: 1.1,
              cropX: 12,
              pdfPageIndex: 0,
            },
          ],
          sheetMusicFileId: "sheet-1",
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
