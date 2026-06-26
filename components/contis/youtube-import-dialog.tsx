"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { batchImportSongsToConti } from "@/lib/actions/conti-songs"
import { buildBatchImportItems } from "@/components/contis/youtube-import-model"
import { YouTubeImportReview } from "@/components/contis/youtube-import-review"
import { useYouTubeImportState } from "@/components/contis/youtube-import-state"
import type { Song } from "@/lib/types"

interface YouTubeImportDialogProps {
  contiId: string
  contiTitle: string | null
  contiDate: string
  existingSongIds: string[]
  allSongs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function YouTubeImportDialog({
  contiId,
  contiTitle,
  contiDate,
  existingSongIds,
  allSongs,
  open,
  onOpenChange,
}: YouTubeImportDialogProps) {
  const defaultPresetName = contiTitle || contiDate
  const [isPending, startTransition] = useTransition()
  const importState = useYouTubeImportState({
    defaultPresetName,
    existingSongIds,
    allSongs,
  })

  function handleImport() {
    const importableItems = importState.items.filter((item) => !item.excluded)

    if (importableItems.length === 0) {
      toast.error("가져올 곡이 없습니다")
      return
    }

    // Validate: every existing-song item must have a preset action
    const invalidItems = importableItems.filter(
      (item) => item.matchedSong && !item.createNewPreset && !item.selectedPresetId
    )
    if (invalidItems.length > 0) {
      toast.error("모든 기존 곡에 프리셋을 선택해주세요")
      return
    }

    startTransition(async () => {
      const batchItems = buildBatchImportItems(importState.items, defaultPresetName)

      const result = await batchImportSongsToConti(contiId, batchItems)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "곡 가져오기 중 오류가 발생했습니다")
        return
      }

      const msgs = []
      if (result.data.added > 0) msgs.push(`${result.data.added}곡 추가`)
      if (result.data.created > 0) msgs.push(`새 곡 ${result.data.created}개 생성`)
      if (result.data.presetUpdated > 0) msgs.push(`프리셋 ${result.data.presetUpdated}개 업데이트`)
      if (result.data.mashupsApplied > 0) msgs.push(`매시업 ${result.data.mashupsApplied}개 연결`)
      toast.success(msgs.join(', '))
      onOpenChange(false)
      importState.resetState()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) importState.resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>YouTube 플레이리스트에서 가져오기</DialogTitle>
        </DialogHeader>

        {importState.step === "url-input" ? (
          <div className="flex flex-col gap-4">
            <Input
              placeholder="YouTube 플레이리스트 URL을 붙여넣으세요"
              value={importState.url}
              onChange={(e) => importState.setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !importState.isPending) {
                  importState.handleFetchPlaylist()
                }
              }}
              disabled={importState.isPending}
            />
            <Button
              onClick={importState.handleFetchPlaylist}
              disabled={!importState.url.trim() || importState.isPending}
            >
              {importState.isPending ? "불러오는 중..." : "불러오기"}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
              <YouTubeImportReview
                items={importState.items}
                searchStates={importState.searchStates}
                dropdownOpen={importState.dropdownOpen}
                getMatchingSongs={importState.getMatchingSongs}
                onDropdownOpenChange={(itemId, open) =>
                  importState.setDropdownOpen((prev) => ({
                    ...prev,
                    [itemId]: open,
                  }))
                }
                onEditName={importState.handleEditName}
                onMatchSong={importState.handleMatchSong}
                onPresetSelection={importState.handlePresetSelection}
                onReplaceExistingYoutubeChange={
                  importState.handleReplaceExistingYoutubeChange
                }
                onToggleExclude={importState.toggleExclude}
                onToggleMashupWithNext={importState.toggleMashupWithNext}
              />
            </div>

            <DialogFooter className="sticky bottom-0 bg-background">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => importState.setStep("url-input")}
                  disabled={isPending}
                  className="sm:w-auto"
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  뒤로
                </Button>
                <div className="flex-1 text-sm text-muted-foreground sm:text-center">
                  {importState.importStats.total > 0 ? (
                    <>
                      {importState.importStats.total}개 항목
                      {importState.importStats.newSongs > 0 && ` · 새 곡 ${importState.importStats.newSongs}`}
                      {importState.importStats.existingSongs > 0 && ` · 기존 곡 ${importState.importStats.existingSongs}`}
                      {importState.importStats.presetOnly > 0 && ` · 프리셋만 ${importState.importStats.presetOnly}`}
                    </>
                  ) : (
                    "가져올 항목이 없습니다"
                  )}
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importState.importStats.total === 0 || isPending}
                  className="sm:w-auto"
                >
                  {isPending ? (
                    "가져오는 중..."
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={Tick01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                      가져오기
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
