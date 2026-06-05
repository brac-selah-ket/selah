"use client"

import type { SheetMusicFile } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface SheetMusicPreviewItem {
  file: SheetMusicFile
  thumbnailUrl: string | null
  pdfPage: number | null
  pdfTotalPages: number | null
}

export function getSheetMusicPreviewKey(item: SheetMusicPreviewItem) {
  return `${item.file.id}-${item.pdfPage ?? "img"}`
}

export function getSheetMusicPreviewLabel(item: SheetMusicPreviewItem) {
  if (item.pdfPage != null) {
    return `${item.file.fileName} - ${item.pdfPage}페이지`
  }

  return item.file.fileName
}

interface SheetMusicPreviewPaneProps {
  item: SheetMusicPreviewItem | null
  className?: string
}

export function SheetMusicPreviewPane({
  item,
  className,
}: SheetMusicPreviewPaneProps) {
  return (
    <section
      data-slot="sheet-music-preview-pane"
      className={cn(
        "rounded-lg border bg-background/70 p-3",
        className,
      )}
    >
      {item ? (
        <div className="space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {getSheetMusicPreviewLabel(item)}
            </p>
            {item.pdfPage != null && item.pdfTotalPages != null && item.pdfTotalPages > 1 && (
              <p className="text-sm text-muted-foreground">
                {item.pdfPage}/{item.pdfTotalPages}페이지
              </p>
            )}
          </div>
          <div className="overflow-hidden rounded-md border bg-muted/20">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={getSheetMusicPreviewLabel(item)}
                className="mx-auto h-auto max-h-[calc(100vh-12rem)] w-auto max-w-full object-contain"
              />
            ) : (
              <div className="flex aspect-[1/1.414] w-full items-center justify-center bg-muted">
                <span className="text-sm text-muted-foreground">악보 불러오는 중...</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex aspect-[1/1.414] items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 text-center">
          <span className="text-sm text-muted-foreground">
            미리볼 악보를 선택하세요.
          </span>
        </div>
      )}
    </section>
  )
}
