import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { sanitizeContiDescription } from "@/lib/conti-description"
import type { Conti } from "@/lib/types"

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}.${month}.${day}`
}

function formatLongDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-")
  return `${year}년 ${month}월 ${day}일`
}

export function ContiCard({ conti }: { conti: Conti }) {
  const description = sanitizeContiDescription(conti.description)
  const title = conti.title || formatLongDate(conti.date)

  return (
    <Link
      href={`/contis/${conti.id}`}
      className="group grid gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/55 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center"
    >
      <div className="text-sm font-semibold text-primary/75">
        {formatDate(conti.date)}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {description}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">설명이 없는 콘티입니다</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        열기
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          className="size-4"
        />
      </div>
    </Link>
  )
}
