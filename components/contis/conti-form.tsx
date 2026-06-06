"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { createConti, updateConti } from "@/lib/actions/contis"
import { batchImportSongsToConti } from "@/lib/actions/conti-songs"
import { YouTubeImportReview } from "@/components/contis/youtube-import-review"
import { buildBatchImportItems } from "@/components/contis/youtube-import-model"
import { useYouTubeImportState } from "@/components/contis/youtube-import-state"
import { sanitizeContiDescription } from "@/lib/conti-description"
import type { Conti, Song } from "@/lib/types"

export function ContiForm({
  conti,
  allSongs = [],
  enableInlineYouTubeImport = false,
}: {
  conti?: Conti
  allSongs?: Song[]
  enableInlineYouTubeImport?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [title, setTitle] = useState(conti?.title ?? "")
  const [date, setDate] = useState(conti?.date ?? "")
  const [description, setDescription] = useState(sanitizeContiDescription(conti?.description) ?? "")

  const isEdit = !!conti
  const defaultPresetName = title.trim() || date || "새 콘티"
  const importState = useYouTubeImportState({
    defaultPresetName,
    existingSongIds: [],
    allSongs,
  })
  const reviewItems = importState.items.map((item) =>
    item.createNewPreset ? { ...item, presetName: defaultPresetName } : item,
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const formData = new FormData()
    formData.set("title", title)
    formData.set("date", date)
    formData.set("description", description)

    startTransition(async () => {
      if (isEdit) {
        const result = await updateConti(conti.id, formData)

        if (result.success) {
          toast.success("콘티가 수정되었습니다")
          router.push(`/contis/${conti.id}`)
        } else {
          toast.error(result.error ?? "오류가 발생했습니다")
        }
        return
      }

      const importItems =
        enableInlineYouTubeImport && importState.step === "review"
          ? buildBatchImportItems(
              importState.items
                .filter((item) => !item.excluded)
                .map((item) => ({ ...item, presetName: defaultPresetName })),
              defaultPresetName,
            )
          : []

      if (
        enableInlineYouTubeImport &&
        importState.step === "review" &&
        importItems.length === 0
      ) {
        toast.error("가져올 항목이 없습니다")
        return
      }

      const hasInvalidItems =
        importState.step === "review" &&
        importState.items.some(
          (item) =>
            !item.excluded &&
            item.matchedSong &&
            !item.createNewPreset &&
            !item.selectedPresetId,
        )

      if (hasInvalidItems) {
        toast.error("모든 기존 곡에 프리셋을 선택해주세요")
        return
      }

      const result = await createConti(formData)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "오류가 발생했습니다")
        return
      }

      const newContiId = result.data.id

      if (importItems.length > 0) {
        const importResult = await batchImportSongsToConti(newContiId, importItems)
        if (!importResult.success) {
          toast.error(
            `콘티는 생성됐지만 곡 가져오기에 실패했습니다: ${importResult.error ?? "오류가 발생했습니다"}`,
          )
          router.push(`/contis/${newContiId}`)
          return
        }
      }

      toast.success("콘티가 생성되었습니다")
      router.push(`/contis/${newContiId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel>인도자 (선택사항)</FieldLabel>
          <Input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="인도자 이름을 입력하세요"
          />
        </Field>

        <Field>
          <FieldLabel>날짜</FieldLabel>
          <DatePicker value={date} onChange={setDate} />
        </Field>

        <Field>
          <FieldLabel>설명 (선택사항)</FieldLabel>
          <Textarea
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="콘티에 대한 설명을 입력하세요"
            rows={3}
          />
        </Field>

        {!isEdit && enableInlineYouTubeImport && (
          <Field>
            <FieldLabel>YouTube 재생목록 가져오기</FieldLabel>
            <FieldDescription>
              선택사항입니다. 비워두면 빈 콘티만 생성됩니다.
            </FieldDescription>
            {importState.step === "url-input" ? (
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="YouTube 플레이리스트 URL을 붙여넣으세요"
                  value={importState.url}
                  onChange={(e) => importState.setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !importState.isPending) {
                      e.preventDefault()
                      importState.handleFetchPlaylist()
                    }
                  }}
                  disabled={importState.isPending || isPending}
                />
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={importState.handleFetchPlaylist}
                    disabled={
                      !importState.url.trim() ||
                      importState.isPending ||
                      isPending
                    }
                  >
                    {importState.isPending ? "불러오는 중..." : "불러오기"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
              <YouTubeImportReview
                  items={reviewItems}
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
                />
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => importState.setStep("url-input")}
                    disabled={importState.isPending || isPending}
                  >
                    목록 다시 불러오기
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    {importState.importStats.total > 0 ? (
                      <>
                        {importState.importStats.total}개 항목
                        {importState.importStats.newSongs > 0 &&
                          ` · 새 곡 ${importState.importStats.newSongs}`}
                        {importState.importStats.existingSongs > 0 &&
                          ` · 기존 곡 ${importState.importStats.existingSongs}`}
                        {importState.importStats.presetOnly > 0 &&
                          ` · 프리셋만 ${importState.importStats.presetOnly}`}
                      </>
                    ) : (
                      "가져올 항목이 없습니다"
                    )}
                  </div>
                </div>
              </div>
            )}
          </Field>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            취소
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
