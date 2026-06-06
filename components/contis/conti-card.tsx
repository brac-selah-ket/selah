"use client"

import Link from "next/link"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { ContiSongSummaryTable } from "@/components/contis/conti-song-summary-table"
import { sanitizeContiDescription } from "@/lib/conti-description"
import { cn } from "@/lib/utils"
import type { ContiWithSongSummaries } from "@/lib/types"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}.${month}.${day}`
}

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

export function ContiCard({ conti }: { conti: ContiWithSongSummaries }) {
  const [expanded, setExpanded] = useState(false)
  const keySummary = Array.from(
    new Set(conti.songSummaries.flatMap((song) => song.keys)),
  ).join("/")
  const summaryText = [
    `${conti.songCount}곡`,
    keySummary || null,
  ].filter(Boolean).join(" · ")
  const description = sanitizeContiDescription(conti.description)
  const title = conti.title || formatLongDate(conti.date)

  return (
    <div className="border-b last:border-b-0">
      <div className="grid gap-3 px-4 py-3 transition-colors hover:bg-muted/55 sm:grid-cols-[1fr_auto] sm:items-center">
        <Link
          href={`/contis/${conti.id}`}
          className="group grid min-w-0 gap-3 sm:grid-cols-[7.5rem_1fr] sm:items-center"
        >
          <div className="text-sm font-semibold text-primary/75">
            {formatDate(conti.date)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
            <p
              className={cn(
                "text-xs font-medium text-muted-foreground/80",
                description ? "mt-1" : "mt-0.5",
              )}
            >
              {summaryText}
            </p>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((current) => !current)}
            aria-expanded={expanded}
          >
            {expanded ? "곡 닫기" : "곡 보기"}
          </Button>
          <Link
            href={`/contis/${conti.id}`}
            className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            열기
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </Link>
        </div>
      </div>
      {expanded && (
        <div className="border-t bg-background/35 p-3">
          <ContiSongSummaryTable songs={conti.songSummaries} mode="read" />
        </div>
      )}
    </div>
  )
}
