"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import type { ContiSongSummary, ContiSongWithSong } from "@/lib/types"

type SummaryRow = ContiSongSummary | ContiSongWithSong

interface ContiSongSummaryTableProps {
  songs: SummaryRow[]
  mode: "read" | "action"
  onEdit?: (contiSongId: string) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  onRemove?: (contiSongId: string) => void
}

function isContiSongWithSong(song: SummaryRow): song is ContiSongWithSong {
  return "song" in song
}

function getSongName(song: SummaryRow): string {
  return isContiSongWithSong(song) ? song.song.name : song.songName
}

function getKeys(song: SummaryRow): string[] {
  return isContiSongWithSong(song) ? song.overrides.keys : song.keys
}

function getTempos(song: SummaryRow): number[] {
  return isContiSongWithSong(song) ? song.overrides.tempos : song.tempos
}

function getSectionOrder(song: SummaryRow): string[] {
  return isContiSongWithSong(song)
    ? song.overrides.sectionOrder
    : song.sectionOrder
}

function getPresetName(song: SummaryRow): string | null {
  if (!isContiSongWithSong(song)) return song.presetName
  return song.overrides.presetId ? "프리셋 적용" : null
}

function getSectionSummary(song: SummaryRow): string {
  const sections = getSectionOrder(song)
  return sections.length > 0 ? sections.join(" → ") : "-"
}

export function ContiSongSummaryTable({
  songs,
  mode,
  onEdit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: ContiSongSummaryTableProps) {
  if (songs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
        등록된 곡이 없습니다.
      </div>
    )
  }

  const showActions = mode === "action"
  const gridTemplateClass = showActions
    ? "grid-cols-[3rem_1.3fr_5rem_5rem_minmax(12rem,1fr)_6rem_auto]"
    : "grid-cols-[3rem_1.3fr_5rem_5rem_minmax(12rem,1fr)_6rem]"
  const tableMinWidthClass = showActions ? "min-w-[52rem]" : "min-w-[44rem]"

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className={tableMinWidthClass}>
        <div
          className={`grid ${gridTemplateClass} gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground`}
        >
          <span>#</span>
          <span>곡</span>
          <span>Key</span>
          <span>BPM</span>
          <span>섹션</span>
          <span>프리셋</span>
          {showActions && <span className="text-right">작업</span>}
        </div>
        {songs.map((song, index) => {
          const keys = getKeys(song)
          const tempos = getTempos(song)
          const presetName = getPresetName(song)

          return (
            <div
              key={song.id}
              className={`grid ${gridTemplateClass} items-center gap-3 border-b px-3 py-3 text-sm last:border-b-0`}
            >
              <span className="font-semibold text-primary">{index + 1}</span>
              <span className="min-w-0 truncate font-medium">
                {getSongName(song)}
              </span>
              <span className="flex min-w-0 flex-wrap gap-1">
                {keys.length > 0
                  ? keys.map((key, keyIndex) => (
                      <Badge key={`${key}-${keyIndex}`} variant="key">
                        {key}
                      </Badge>
                    ))
                  : "-"}
              </span>
              <span className="flex min-w-0 flex-wrap gap-1">
                {tempos.length > 0
                  ? tempos.map((tempo, tempoIndex) => (
                      <Badge key={`${tempo}-${tempoIndex}`} variant="tempo">
                        {tempo}
                      </Badge>
                    ))
                  : "-"}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {getSectionSummary(song)}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">
                {presetName ?? "-"}
              </span>
              {showActions && (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="편집"
                    disabled={!onEdit}
                    onClick={() => onEdit?.(song.id)}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="위로 이동"
                    disabled={index === 0 || !onMoveUp}
                    onClick={() => onMoveUp?.(index)}
                  >
                    <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="아래로 이동"
                    disabled={index === songs.length - 1 || !onMoveDown}
                    onClick={() => onMoveDown?.(index)}
                  >
                    <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="삭제"
                    disabled={!onRemove}
                    onClick={() => onRemove?.(song.id)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
