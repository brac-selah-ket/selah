"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Link01Icon,
  MusicNote01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import type { Song } from "@/lib/types"
import type { YouTubeImportReviewItem } from "@/components/contis/youtube-import-model"

interface YouTubeImportReviewProps {
  items: YouTubeImportReviewItem[]
  searchStates: Record<string, string>
  dropdownOpen: Record<string, boolean>
  getMatchingSongs: (itemId: string) => Song[]
  onDropdownOpenChange: (itemId: string, open: boolean) => void
  onEditName: (itemId: string, newName: string) => void
  onMatchSong: (itemId: string, song: Song | null) => void
  onPresetSelection: (itemId: string, presetId: string | null) => void
  onReplaceExistingYoutubeChange: (itemId: string, replace: boolean) => void
  onToggleExclude: (itemId: string) => void
  onToggleMashupWithNext: (itemId: string) => void
}

export function YouTubeImportReview({
  items,
  searchStates,
  dropdownOpen,
  getMatchingSongs,
  onDropdownOpenChange,
  onEditName,
  onMatchSong,
  onPresetSelection,
  onReplaceExistingYoutubeChange,
  onToggleExclude,
  onToggleMashupWithNext,
}: YouTubeImportReviewProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => {
        const nextItem = items[index + 1]
        const canToggleMashup = Boolean(nextItem && !item.excluded && !nextItem.excluded)
        const matchingSongs = getMatchingSongs(item.id)
        const showDropdown = dropdownOpen[item.id] && matchingSongs.length > 0
        const inputValue = searchStates[item.id] ?? item.editedName
        const duplicateReason =
          "duplicateReason" in item && typeof item.duplicateReason === "string"
            ? item.duplicateReason
            : undefined

        return (
          <div key={item.id} className="flex flex-col gap-2">
            <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="w-8 shrink-0 text-right text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="relative">
                    <Input
                      value={inputValue}
                      onChange={(e) => onEditName(item.id, e.target.value)}
                      onFocus={() => onDropdownOpenChange(item.id, true)}
                      onBlur={() => {
                        setTimeout(() => onDropdownOpenChange(item.id, false), 200)
                      }}
                      disabled={item.isAlreadyInConti}
                      className="pr-8"
                    />
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={16}
                      strokeWidth={2}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />

                    {showDropdown && (
                      <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
                        {matchingSongs.map((song) => (
                          <button
                            key={song.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                            onMouseDown={() => onMatchSong(item.id, song)}
                          >
                            <HugeiconsIcon
                              icon={MusicNote01Icon}
                              size={16}
                              strokeWidth={2}
                              className="shrink-0 text-muted-foreground"
                            />
                            <span className="truncate">{song.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.matchedSong && (
                      <Badge
                        variant="outline"
                        className={
                          item.isAlreadyInConti
                            ? "gap-1"
                            : "gap-1 cursor-pointer transition-colors hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                        }
                        onClick={() => {
                          if (!item.isAlreadyInConti) {
                            onMatchSong(item.id, null)
                          }
                        }}
                      >
                        <HugeiconsIcon
                          icon={MusicNote01Icon}
                          size={14}
                          strokeWidth={2}
                        />
                        {item.matchedSong.name}
                        {!item.isAlreadyInConti && (
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={14}
                            strokeWidth={2}
                          />
                        )}
                      </Badge>
                    )}

                    {item.isAlreadyInConti ? (
                      <>
                        <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-600">
                          기존 곡
                        </Badge>
                        <Badge variant="secondary">프리셋만 업데이트</Badge>
                      </>
                    ) : duplicateReason ? (
                      <Badge variant="destructive" className="text-xs">
                        {duplicateReason}
                      </Badge>
                    ) : item.matchedSong ? (
                      <Badge className="border-blue-500/20 bg-blue-500/10 text-blue-600">
                        기존 곡
                      </Badge>
                    ) : (
                      <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                        새 곡
                      </Badge>
                    )}
                  </div>

                  {!item.excluded && (
                    <div className="mt-1 flex flex-col gap-1 rounded-md bg-muted/50 p-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        프리셋
                      </label>
                      {item.matchedSong ? (
                        <>
                          <select
                            className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                            value={
                              item.createNewPreset
                                ? "__new__"
                                : (item.selectedPresetId ?? "__new__")
                            }
                            onChange={(e) =>
                              onPresetSelection(
                                item.id,
                                e.target.value === "__new__" ? null : e.target.value,
                              )
                            }
                          >
                            <option value="__new__">새 프리셋 만들기</option>
                            {item.presets === null ? (
                              <option disabled>불러오는 중...</option>
                            ) : (
                              item.presets.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                  {preset.name}
                                  {preset.youtubeReference ? " (YT 있음)" : ""}
                                </option>
                              ))
                            )}
                          </select>
                          {item.existingYoutubeRef && (
                            <div className="flex flex-col gap-2 pt-1">
                              <p className="text-xs text-muted-foreground">
                                이 프리셋에 이미 YouTube 레퍼런스가 있습니다.
                              </p>
                              <div className="flex flex-col gap-1 text-xs text-foreground">
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`youtube-replace-${item.id}`}
                                    checked={!item.replaceExistingYoutube}
                                    onChange={() =>
                                      onReplaceExistingYoutubeChange(item.id, false)
                                    }
                                  />
                                  <span>기존 YouTube 유지</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`youtube-replace-${item.id}`}
                                    checked={item.replaceExistingYoutube}
                                    onChange={() =>
                                      onReplaceExistingYoutubeChange(item.id, true)
                                    }
                                  />
                                  <span>playlist 영상으로 교체</span>
                                </label>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          새 프리셋이 자동 생성됩니다 ({item.presetName})
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 pt-2">
                <input
                  type="checkbox"
                  checked={!item.excluded}
                  onChange={() => onToggleExclude(item.id)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
              </div>
            </div>

            {canToggleMashup && (
              <div
                className={
                  item.mashupWithNext
                    ? "ml-11 flex items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1"
                    : "ml-11 flex items-center gap-2 px-2 py-1"
                }
              >
                <div
                  className={
                    item.mashupWithNext
                      ? "h-px flex-1 bg-primary/40"
                      : "h-px flex-1 bg-border"
                  }
                />
                <Button
                  type="button"
                  variant={item.mashupWithNext ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onToggleMashupWithNext(item.id)}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={2} />
                  {item.mashupWithNext ? "매시업 연결됨" : "매시업 연결"}
                </Button>
                <div
                  className={
                    item.mashupWithNext
                      ? "h-px flex-1 bg-primary/40"
                      : "h-px flex-1 bg-border"
                  }
                />
                {item.mashupWithNext && (
                  <Badge variant="outline" className="h-7 gap-1 text-xs">
                    {index + 1}-{index + 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
