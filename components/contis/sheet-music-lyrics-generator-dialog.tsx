"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AiMagicIcon, AlertCircleIcon, Loading03Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { generateLyricsFromSheetMusicImages } from "@/lib/actions/sheet-music-lyrics"
import type { SheetMusicFile } from "@/lib/types"
import { buildSheetMusicLyricsImagePages } from "@/lib/utils/sheet-music-lyrics-images"

type GeneratorStatus = "idle" | "loading" | "ready" | "error"

interface SheetMusicLyricsGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheetMusicFiles: SheetMusicFile[]
  songName?: string
  onGeneratedLyrics: (lyrics: string[]) => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "가사 자동 생성 중 오류가 발생했습니다."
}

export function SheetMusicLyricsGeneratorDialog({
  open,
  onOpenChange,
  sheetMusicFiles,
  songName,
  onGeneratedLyrics,
}: SheetMusicLyricsGeneratorDialogProps) {
  const [status, setStatus] = useState<GeneratorStatus>("idle")
  const [loadingMessage, setLoadingMessage] = useState("악보 이미지를 준비하는 중...")
  const [error, setError] = useState<string | null>(null)
  const [preparedPageCount, setPreparedPageCount] = useState(0)
  const [generatedLyrics, setGeneratedLyrics] = useState<string[]>([])

  const prevOpenRef = useRef(false)
  const requestIdRef = useRef(0)

  const resetState = useCallback(() => {
    setStatus("idle")
    setLoadingMessage("악보 이미지를 준비하는 중...")
    setError(null)
    setPreparedPageCount(0)
    setGeneratedLyrics([])
  }, [])

  const runGeneration = useCallback(async () => {
    const requestId = ++requestIdRef.current

    setStatus("loading")
    setLoadingMessage("악보 이미지를 준비하는 중...")
    setError(null)
    setPreparedPageCount(0)
    setGeneratedLyrics([])

    try {
      const pages = await buildSheetMusicLyricsImagePages(sheetMusicFiles)
      if (requestId !== requestIdRef.current) return

      if (pages.length === 0) {
        throw new Error("가사를 생성할 악보 이미지가 없습니다.")
      }

      setPreparedPageCount(pages.length)
      setLoadingMessage("Gemini로 가사를 생성하는 중...")

      const result = await generateLyricsFromSheetMusicImages({
        songName,
        pages,
      })
      if (requestId !== requestIdRef.current) return

      if (!result.success || !result.data?.lyrics?.length) {
        throw new Error(result.error ?? "생성된 가사를 찾을 수 없습니다.")
      }

      setGeneratedLyrics(result.data.lyrics)
      setStatus("ready")
    } catch (generationError) {
      if (requestId !== requestIdRef.current) return

      setError(getErrorMessage(generationError))
      setStatus("error")
    }
  }, [sheetMusicFiles, songName])

  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    if (!open) {
      requestIdRef.current += 1
      resetState()
      return
    }

    if (!wasOpen) {
      void runGeneration()
    }
  }, [open, resetState, runGeneration])

  const handleAddLyrics = () => {
    if (generatedLyrics.length === 0) return

    onGeneratedLyrics(generatedLyrics)
    toast.success(`${generatedLyrics.length}개 가사 페이지를 추가했습니다`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>가사 자동 생성</DialogTitle>
          <DialogDescription>
            현재 선택한 악보에서 가사 페이지만 생성해 아래 미리보기로 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {status === "loading" && (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-6 animate-spin text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{loadingMessage}</p>
                <p className="text-sm text-muted-foreground">
                  {preparedPageCount > 0
                    ? `${preparedPageCount}개 악보 페이지를 준비했습니다.`
                    : "악보 파일을 변환하고 있습니다."}
                </p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} className="mt-0.5 size-5 text-destructive" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">가사 생성에 실패했습니다</p>
                  <p className="text-sm text-destructive/90">{error}</p>
                </div>
              </div>
            </div>
          )}

          {status === "ready" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                악보 {preparedPageCount}페이지에서 가사 {generatedLyrics.length}페이지를 생성했습니다.
              </div>

              <div className="space-y-3">
                {generatedLyrics.map((page, index) => (
                  <div key={index} className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} className="size-4 text-primary" />
                      페이지 {index + 1}
                    </div>
                    <Textarea
                      readOnly
                      rows={Math.min(6, Math.max(3, page.split("\n").length + 1))}
                      className="resize-none text-sm"
                      value={page}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          {status === "error" && (
            <Button type="button" onClick={() => void runGeneration()}>
              <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
              다시 시도
            </Button>
          )}
          {status === "ready" && (
            <Button type="button" onClick={handleAddLyrics}>
              <HugeiconsIcon icon={AiMagicIcon} strokeWidth={2} />
              가사에 추가
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
