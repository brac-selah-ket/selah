"use client"

import { useState, useRef, useEffect } from "react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import {
  addLyricsPageToSection,
  pruneInvalidLyricsPages,
  removeLyricsPageOccurrence,
} from "@/components/contis/section-lyrics-map-utils"

interface SectionLyricsMapperProps {
  sectionOrder: string[]
  lyrics: string[]
  initialMap: Record<number, number[]>
  onChange: (data: { sectionLyricsMap: Record<number, number[]> }) => void
}

export function SectionLyricsMapper({
  sectionOrder,
  lyrics,
  initialMap,
  onChange,
}: SectionLyricsMapperProps) {
  const [sectionLyricsMap, setSectionLyricsMap] =
    useState<Record<number, number[]>>(initialMap)

  // Sync internal state when parent resets the map (e.g. lyrics page reorder)
  useEffect(() => {
    setSectionLyricsMap(initialMap)
  }, [initialMap])

  // Purge ghost page references when lyrics pages are added/removed
  useEffect(() => {
    setSectionLyricsMap(prev => pruneInvalidLyricsPages(prev, lyrics.length))
  }, [lyrics.length])

  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onChangeRef.current({ sectionLyricsMap })
  }, [sectionLyricsMap])

  const addLyricsForSection = (sectionIndex: number, lyricsIndex: number) => {
    setSectionLyricsMap(prev => addLyricsPageToSection(prev, sectionIndex, lyricsIndex))
  }

  const removeLyricsForSection = (sectionIndex: number, occurrenceIndex: number) => {
    setSectionLyricsMap(prev => removeLyricsPageOccurrence(prev, sectionIndex, occurrenceIndex))
  }

  if (sectionOrder.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-medium">섹션-가사 매핑</h3>
        <p className="text-muted-foreground text-base">
          먼저 섹션 순서를 설정하세요
        </p>
      </div>
    )
  }

  if (lyrics.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-medium">섹션-가사 매핑</h3>
        <p className="text-muted-foreground text-base">
          먼저 가사 페이지를 추가하세요
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium">섹션-가사 매핑</h3>
      <Accordion multiple defaultValue={[]} className="gap-3">
        {sectionOrder.map((section, sectionIndex) => (
          <AccordionItem
            key={sectionIndex}
            value={String(sectionIndex)}
            className="ring-foreground/10 rounded-lg bg-muted/50 ring-1"
          >
            <AccordionTrigger className="w-full p-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-medium">
                  [{sectionIndex}]
                </span>
                <span className="text-base font-medium">{section}</span>
                <span className="text-muted-foreground text-sm font-normal">
                  ({(sectionLyricsMap[sectionIndex] || []).length}페이지)
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 px-3 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {lyrics.map((lyric, lyricsIndex) => (
                    <Tooltip key={lyricsIndex}>
                      <TooltipTrigger
                        render={
                          <button
                            type="button"
                            onClick={() => addLyricsForSection(sectionIndex, lyricsIndex)}
                            className="rounded-md border bg-card px-2.5 py-1 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                          >
                            페이지 {lyricsIndex + 1}
                          </button>
                        }
                      />
                      <TooltipContent className="whitespace-pre-wrap">
                        {lyric || "(빈 페이지)"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="space-y-2 rounded-md bg-background/70 p-2">
                  <div className="text-muted-foreground text-xs font-medium">
                    선택된 순서
                  </div>
                  {(sectionLyricsMap[sectionIndex] || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(sectionLyricsMap[sectionIndex] || []).map((lyricsIndex, occurrenceIndex) => (
                        <span
                          key={`${lyricsIndex}-${occurrenceIndex}`}
                          className="inline-flex items-center overflow-hidden rounded-md border bg-muted/70 text-sm"
                        >
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="px-2 py-1 font-medium">
                                  페이지 {lyricsIndex + 1}
                                </span>
                              }
                            />
                            <TooltipContent className="whitespace-pre-wrap">
                              {lyrics[lyricsIndex] || "(빈 페이지)"}
                            </TooltipContent>
                          </Tooltip>
                          <button
                            type="button"
                            aria-label={`페이지 ${lyricsIndex + 1} 매핑 제거`}
                            onClick={() => removeLyricsForSection(sectionIndex, occurrenceIndex)}
                            className="border-l px-1.5 py-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      배치된 가사 페이지가 없습니다
                    </p>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Preview section — always visible, outside accordion */}
      <div>
        <div className="mb-2 text-base font-medium">미리보기</div>
        <div className="ring-foreground/10 space-y-2 rounded-lg bg-muted/30 p-3 ring-1">
          {sectionOrder.map((section, sectionIndex) => {
            const lyricsIndices = sectionLyricsMap[sectionIndex] || []
            if (lyricsIndices.length === 0) {
              return (
                <div key={sectionIndex} className="flex items-start gap-2">
                  <span className="text-muted-foreground text-sm shrink-0 whitespace-nowrap">
                    [{sectionIndex}] {section}:
                  </span>
                  <span className="text-muted-foreground text-sm italic">
                    가사 없음
                  </span>
                </div>
              )
            }
            return (
              <div key={sectionIndex} className="flex items-start gap-2">
                <span className="text-muted-foreground text-sm shrink-0 whitespace-nowrap">
                  [{sectionIndex}] {section}:
                </span>
                <div className="flex flex-wrap gap-1">
                  {lyricsIndices.map((lyricsIndex, occurrenceIndex) => (
                    <Tooltip key={`${lyricsIndex}-${occurrenceIndex}`}>
                      <TooltipTrigger render={<span />}>
                        <Badge variant="secondary" className="text-sm">
                          페이지 {lyricsIndex + 1}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="whitespace-pre-wrap">
                        {lyrics[lyricsIndex] || "(빈 페이지)"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
