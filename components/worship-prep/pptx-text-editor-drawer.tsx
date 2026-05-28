"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import type { PptxTextSection, PptxTextStructure } from "@/lib/types"
import {
  buildPptxTextChangeSummary,
  DEFAULT_PPT_TEXT_SECTION_NAME,
  getDefaultPptxTextSectionId,
  getPptxTextSectionId,
  makePptxTextOverrideKey,
} from "@/lib/utils/pptx-text-overrides"

import { VisibleWhitespaceTextarea } from "./visible-whitespace-textarea"

function getPptxTextShapePreview(value: string): string {
  const preview = value.replace(/\s+/g, " ").trim()
  return preview || "빈 텍스트"
}

interface PptxTextEditorDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  structure: PptxTextStructure | null
  loading: boolean
  error: string | null
  drafts: Record<string, string>
  onDraftsChange: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onReset: () => void
}

export function PptxTextEditorDrawer({
  open,
  onOpenChange,
  fileName,
  structure,
  loading,
  error,
  drafts,
  onDraftsChange,
  onReset,
}: PptxTextEditorDrawerProps) {
  const [selectedSectionId, setSelectedSectionId] = React.useState("")
  const [showChangedOnly, setShowChangedOnly] = React.useState(false)

  React.useEffect(() => {
    if (!open) return

    setSelectedSectionId(getDefaultPptxTextSectionId(structure))
    setShowChangedOnly(false)
  }, [open, structure])

  const sections = structure?.sections ?? []
  const changeSummary = React.useMemo(
    () => buildPptxTextChangeSummary(structure, drafts),
    [drafts, structure],
  )
  const selectedSection =
    sections.find((section, index) => getPptxTextSectionId(section, index) === selectedSectionId) ??
    sections.find((section) => section.name === DEFAULT_PPT_TEXT_SECTION_NAME) ??
    sections[0]
  const selectedSlides = selectedSection?.slides ?? []
  const changedShapeKeys = changeSummary.byShapeKey
  const changedSlides = selectedSlides.filter(
    (slide) => (changeSummary.bySlideId[slide.slide_id] ?? 0) > 0,
  )
  const visibleSlides = showChangedOnly ? changedSlides : selectedSlides

  const handleShapeTextChange = React.useCallback(
    (key: string, value: string) => {
      onDraftsChange((current) => ({
        ...current,
        [key]: value,
      }))
    },
    [onDraftsChange],
  )

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="PPT 텍스트 수정"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onReset}
            disabled={loading || !structure}
          >
            초기화
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            완료
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">파일</p>
          <p className="break-words text-base font-semibold">{fileName || "-"}</p>
        </div>

        {loading && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            PPT 텍스트를 불러오는 중입니다.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && !structure && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            수정할 PPT 텍스트 정보가 없습니다.
          </div>
        )}

        {structure && (
          <>
            <SectionButtons
              sections={sections}
              selectedSectionId={selectedSectionId}
              onSelect={setSelectedSectionId}
              changeCountsBySectionId={changeSummary.bySectionId}
            />

            <label
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2",
                changeSummary.total === 0 && "cursor-not-allowed opacity-70",
              )}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">수정된 텍스트만 보기</p>
                <p className="text-xs text-muted-foreground">
                  {changeSummary.total > 0
                    ? `${changeSummary.total}곳 수정됨`
                    : "변경 없음"}
                </p>
              </div>
              <input
                type="checkbox"
                checked={showChangedOnly}
                onChange={(event) => setShowChangedOnly(event.target.checked)}
                disabled={changeSummary.total === 0}
                aria-label="수정된 텍스트만 보기"
                className="size-4 accent-primary disabled:opacity-40"
              />
            </label>

            <div className="space-y-4">
              {visibleSlides.length ? (
                visibleSlides.map((slide) => {
                  const slideChangeCount = changeSummary.bySlideId[slide.slide_id] ?? 0
                  const visibleShapes = showChangedOnly
                    ? slide.shapes.filter((shape) => {
                        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id)
                        return changedShapeKeys[key]
                      })
                    : slide.shapes

                  return (
                    <article
                      key={slide.slide_id}
                      className={cn(
                        "space-y-3 rounded-md border bg-card p-4",
                        slideChangeCount > 0 && "border-primary/50 bg-primary/5",
                      )}
                    >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">
                          {slide.title || `${slide.slide_index + 1}번 슬라이드`}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          슬라이드 {slide.slide_index + 1}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground",
                          slideChangeCount > 0 && "bg-primary/10 text-primary",
                        )}
                      >
                        {slideChangeCount > 0
                          ? `${slideChangeCount}곳 수정`
                          : `${slide.shapes.length}개 텍스트`}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {visibleShapes.map((shape, shapeIndex) => {
                        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id)
                        const value = drafts[key] ?? shape.text
                        const isChanged = Boolean(changedShapeKeys[key])
                        const shapePreview = getPptxTextShapePreview(value)

                        return (
                          <div key={key} className="space-y-2">
                            <label
                              htmlFor={`pptx-text-${slide.slide_id}-${shape.shape_id}`}
                              className="flex items-center gap-2 text-sm font-medium"
                            >
                              <span>{`텍스트 ${shapeIndex + 1}`}</span>
                              <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
                                {shapePreview}
                              </span>
                              {isChanged && (
                                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                  수정됨
                                </span>
                              )}
                            </label>
                            <VisibleWhitespaceTextarea
                              id={`pptx-text-${slide.slide_id}-${shape.shape_id}`}
                              value={value}
                              className={cn(isChanged && "border-primary/60 focus-visible:border-primary")}
                              onChange={(nextValue) => handleShapeTextChange(key, nextValue)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </article>
                  )
                })
              ) : (
                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  {showChangedOnly
                    ? "변경 없음: 이 섹션에는 수정된 텍스트가 없습니다."
                    : "이 섹션에는 수정할 텍스트가 없습니다."}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}

interface SectionButtonsProps {
  sections: PptxTextSection[]
  selectedSectionId: string
  onSelect: (sectionId: string) => void
  changeCountsBySectionId: Record<string, number>
}

function SectionButtons({
  sections,
  selectedSectionId,
  onSelect,
  changeCountsBySectionId,
}: SectionButtonsProps) {
  if (sections.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" aria-label="PPT 텍스트 섹션">
      {sections.map((section, index) => {
        const sectionId = getPptxTextSectionId(section, index)
        const changeCount = changeCountsBySectionId[sectionId] ?? 0

        return (
          <Button
            key={sectionId}
            type="button"
            size="sm"
            variant={sectionId === selectedSectionId ? "default" : "outline"}
            className={cn("max-w-full", section.name === DEFAULT_PPT_TEXT_SECTION_NAME && "font-bold")}
            onClick={() => onSelect(sectionId)}
            aria-pressed={sectionId === selectedSectionId}
          >
            <span className="truncate">{section.name}</span>
            {changeCount > 0 && (
              <span className="shrink-0 text-xs opacity-80">· {changeCount}</span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
