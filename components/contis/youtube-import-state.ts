"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchYouTubePlaylist } from "@/lib/actions/youtube"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { Song } from "@/lib/types"
import type { YouTubeImportReviewItem } from "@/components/contis/youtube-import-model"

type Step = "url-input" | "review"

export type YouTubeImportStateItem = YouTubeImportReviewItem & {
  duplicateReason?: string
}

function detectDuplicates(items: YouTubeImportStateItem[]) {
  const matchedSongIds = new Map<string, string>()
  const newSongNames = new Map<string, string>()

  return items.map((item) => {
    let duplicateReason: string | undefined

    if (item.matchedSong) {
      const firstMatch = matchedSongIds.get(item.matchedSong.id)
      if (firstMatch && firstMatch !== item.id) {
        duplicateReason = "다른 항목과 동일한 곡입니다"
      } else {
        matchedSongIds.set(item.matchedSong.id, item.id)
      }
    } else if (item.editedName.trim()) {
      const normalizedName = item.editedName.trim().toLowerCase()
      const firstMatch = newSongNames.get(normalizedName)
      if (firstMatch && firstMatch !== item.id) {
        duplicateReason = "같은 이름의 새 곡이 중복됩니다"
      } else {
        newSongNames.set(normalizedName, item.id)
      }
    }

    return {
      ...item,
      excluded: duplicateReason ? true : item.excluded,
      duplicateReason,
    }
  })
}

export function useYouTubeImportState({
  defaultPresetName,
  existingSongIds,
  allSongs,
}: {
  defaultPresetName: string
  existingSongIds: string[]
  allSongs: Song[]
}) {
  const [step, setInternalStep] = useState<Step>("url-input")
  const [url, setUrl] = useState("")
  const [items, setItems] = useState<YouTubeImportStateItem[]>([])
  const [searchStates, setSearchStates] = useState<Record<string, string>>({})
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({})
  const [isPending, startTransition] = useTransition()
  const playlistRequestTokenRef = useRef(0)
  const matchRequestTokensRef = useRef<Record<string, number>>({})

  const existingSongSet = useMemo(
    () => new Set(existingSongIds),
    [existingSongIds],
  )

  const importStats = useMemo(() => {
    const importable = items.filter((item) => !item.excluded)
    const newSongs = importable.filter((item) => !item.matchedSong).length
    const existingSongs = importable.filter(
      (item) => item.matchedSong && !item.isAlreadyInConti,
    ).length
    const presetOnly = importable.filter((item) => item.isAlreadyInConti).length

    return {
      total: importable.length,
      newSongs,
      existingSongs,
      presetOnly,
    }
  }, [items])

  function clearReviewState() {
    playlistRequestTokenRef.current += 1
    matchRequestTokensRef.current = {}
    setItems([])
    setSearchStates({})
    setDropdownOpen({})
  }

  function setStep(nextStep: Step) {
    if (nextStep === "url-input") {
      clearReviewState()
    }

    setInternalStep(nextStep)
  }

  function resetState() {
    clearReviewState()
    setInternalStep("url-input")
    setUrl("")
  }

  function handleFetchPlaylist() {
    if (!url.trim()) {
      toast.error("YouTube 플레이리스트 URL을 입력해주세요")
      return
    }

    const requestToken = playlistRequestTokenRef.current + 1
    playlistRequestTokenRef.current = requestToken
    matchRequestTokensRef.current = {}

    startTransition(async () => {
      const result = await fetchYouTubePlaylist(url.trim())
      if (playlistRequestTokenRef.current !== requestToken) {
        return
      }

      if (!result.success || !result.data) {
        toast.error(result.error ?? "플레이리스트를 불러오는 중 오류가 발생했습니다")
        return
      }

      const importItems = result.data.map<YouTubeImportStateItem>((item, index) => ({
        id: `yt-${index}`,
        originalTitle: item.title,
        editedName: item.title,
        videoId: item.videoId,
        matchedSong: null,
        isAlreadyInConti: false,
        excluded: false,
        selectedPresetId: null,
        createNewPreset: true,
        presetName: defaultPresetName,
        presets: null,
        existingYoutubeRef: null,
        replaceExistingYoutube: true,
      }))

      setItems(detectDuplicates(importItems))
      setInternalStep("review")
    })
  }

  function handleEditName(itemId: string, newName: string) {
    setItems((prev) =>
      detectDuplicates(
        prev.map((item) =>
          item.id === itemId ? { ...item, editedName: newName } : item,
        ),
      ),
    )
    setSearchStates((prev) => ({ ...prev, [itemId]: newName }))
  }

  function handleMatchSong(itemId: string, song: Song | null) {
    const requestToken = (matchRequestTokensRef.current[itemId] ?? 0) + 1
    matchRequestTokensRef.current[itemId] = requestToken
    const playlistToken = playlistRequestTokenRef.current

    setItems((prev) =>
      detectDuplicates(
        prev.map((item) => {
          if (item.id !== itemId) return item

          const isAlreadyInConti = song ? existingSongSet.has(song.id) : false

          return {
            ...item,
            matchedSong: song ? { id: song.id, name: song.name } : null,
            isAlreadyInConti,
            excluded: false,
            selectedPresetId: null,
            createNewPreset: true,
            presetName: item.presetName || defaultPresetName,
            presets: null,
            existingYoutubeRef: null,
            replaceExistingYoutube: true,
          }
        }),
      ),
    )
    setDropdownOpen((prev) => ({ ...prev, [itemId]: false }))

    if (!song) {
      return
    }

    getPresetsForSong(song.id).then((result) => {
      if (
        !result.success ||
        !result.data ||
        playlistRequestTokenRef.current !== playlistToken ||
        matchRequestTokensRef.current[itemId] !== requestToken
      ) {
        return
      }

      setItems((prev) =>
        prev.map((item) => {
          if (
            item.id !== itemId ||
            item.matchedSong?.id !== song.id ||
            matchRequestTokensRef.current[itemId] !== requestToken
          ) {
            return item
          }

          return { ...item, presets: result.data! }
        }),
      )
    })
  }

  function handlePresetSelection(itemId: string, presetId: string | null) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item

        if (presetId === null) {
          return {
            ...item,
            selectedPresetId: null,
            createNewPreset: true,
            existingYoutubeRef: null,
            replaceExistingYoutube: true,
          }
        }

        const preset = item.presets?.find((entry) => entry.id === presetId)

        return {
          ...item,
          selectedPresetId: presetId,
          createNewPreset: false,
          existingYoutubeRef: preset?.youtubeReference ?? null,
          replaceExistingYoutube: false,
        }
      }),
    )
  }

  function handleReplaceExistingYoutubeChange(itemId: string, replace: boolean) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, replaceExistingYoutube: replace } : item,
      ),
    )
  }

  function toggleExclude(itemId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, excluded: !item.excluded } : item,
      ),
    )
  }

  function getMatchingSongs(itemId: string) {
    const item = items.find((entry) => entry.id === itemId)
    const search = (searchStates[itemId] ?? item?.editedName ?? "").trim().toLowerCase()

    if (!search) {
      return []
    }

    return allSongs.filter((song) => song.name.toLowerCase().includes(search))
  }

  return {
    step,
    setStep,
    url,
    setUrl,
    items,
    isPending,
    searchStates,
    dropdownOpen,
    setDropdownOpen,
    resetState,
    handleFetchPlaylist,
    handleEditName,
    handleMatchSong,
    handlePresetSelection,
    handleReplaceExistingYoutubeChange,
    toggleExclude,
    getMatchingSongs,
    importStats,
  }
}
