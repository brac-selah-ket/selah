"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/ui/drawer"
import { cn } from "@/lib/utils"
import type { PptxTextSection, PptxTextStructure } from "@/lib/types"
import {
  DEFAULT_PPT_TEXT_SECTION_NAME,
  getDefaultPptxTextSectionName,
  makePptxTextOverrideKey,
} from "@/lib/utils/pptx-text-overrides"

import { VisibleWhitespaceTextarea } from "./visible-whitespace-textarea"

interface PptxTextEditorDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  structure: PptxTextStructure | null
  loading: boolean
  error: string | null
  drafts: Record<string, string>
  onDraftsChange: (drafts: Record<string, string>) => void
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
  const [selectedSectionName, setSelectedSectionName] = React.useState("")

  React.useEffect(() => {
    if (!open) return

    setSelectedSectionName(getDefaultPptxTextSectionName(structure))
  }, [open, structure])

  const sections = structure?.sections ?? []
  const selectedSection =
    sections.find((section) => section.name === selectedSectionName) ??
    sections.find((section) => section.name === DEFAULT_PPT_TEXT_SECTION_NAME) ??
    sections[0]

  const handleShapeTextChange = React.useCallback(
    (key: string, value: string) => {
      onDraftsChange({
        ...drafts,
        [key]: value,
      })
    },
    [drafts, onDraftsChange],
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
              selectedSectionName={selectedSection?.name ?? ""}
              onSelect={setSelectedSectionName}
            />

            <div className="space-y-4">
              {selectedSection?.slides.length ? (
                selectedSection.slides.map((slide) => (
                  <article
                    key={slide.slide_id}
                    className="space-y-3 rounded-md border bg-card p-4"
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
                      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {slide.shapes.length}개 텍스트
                      </span>
                    </div>

                    <div className="space-y-4">
                      {slide.shapes.map((shape) => {
                        const key = makePptxTextOverrideKey(slide.slide_id, shape.shape_id)
                        const value = drafts[key] ?? shape.text

                        return (
                          <div key={key} className="space-y-2">
                            <label
                              htmlFor={`pptx-text-${slide.slide_id}-${shape.shape_id}`}
                              className="block text-sm font-medium"
                            >
                              {shape.shape_name || `텍스트 ${shape.shape_id}`}
                            </label>
                            <VisibleWhitespaceTextarea
                              id={`pptx-text-${slide.slide_id}-${shape.shape_id}`}
                              value={value}
                              onChange={(nextValue) => handleShapeTextChange(key, nextValue)}
                              aria-label={`${slide.title || "슬라이드"} ${shape.shape_name}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  이 섹션에는 수정할 텍스트가 없습니다.
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
  selectedSectionName: string
  onSelect: (sectionName: string) => void
}

function SectionButtons({ sections, selectedSectionName, onSelect }: SectionButtonsProps) {
  if (sections.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2" aria-label="PPT 텍스트 섹션">
      {sections.map((section) => (
        <Button
          key={section.name}
          type="button"
          size="sm"
          variant={section.name === selectedSectionName ? "default" : "outline"}
          className={cn("max-w-full", section.name === DEFAULT_PPT_TEXT_SECTION_NAME && "font-bold")}
          onClick={() => onSelect(section.name)}
          aria-pressed={section.name === selectedSectionName}
        >
          <span className="truncate">{section.name}</span>
        </Button>
      ))}
    </div>
  )
}
