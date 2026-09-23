"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrangementEditor,
  type ArrangementDraft,
} from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicUploader } from "@/components/songs/sheet-music-uploader"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { updateContiSong, saveContiSongAsPreset } from "@/lib/actions/conti-songs"
import { getPresetsForSongWithSheetMusic, updateSongPreset } from "@/lib/actions/song-presets"
import { shouldSyncAppliedPresetYoutube } from "@/components/shared/arrangement-editor/save-rules"
import { getSheetMusicForSong } from "@/lib/actions/sheet-music"
import { songPresetToDraft } from "@/lib/utils/song-preset-draft"
import { toYouTubeInputValue } from "@/lib/utils/youtube"
import type {
  ContiSongWithSong,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
} from "@/lib/types"

interface ContiSongEditorProps {
  contiSong: ContiSongWithSong
  open: boolean
  onOpenChange: (open: boolean) => void
}

function contiSongToDraft(contiSong: ContiSongWithSong): ArrangementDraft {
  return {
    name: contiSong.song.name,
    displayTitle: null,
    keys: contiSong.overrides.keys,
    tempos: contiSong.overrides.tempos,
    sectionOrder: contiSong.overrides.sectionOrder,
    lyrics: contiSong.overrides.lyrics,
    sectionLyricsMap: contiSong.overrides.sectionLyricsMap,
    notes: contiSong.overrides.notes,
    sheetMusicFileIds: contiSong.overrides.sheetMusicFileIds,
    pdfMetadata: null,
    youtubeReference: toYouTubeInputValue(contiSong.appliedPreset?.youtubeReference),
    youtubeTitle: contiSong.appliedPreset?.youtubeTitle ?? null,
    isDefault: false,
    appliedPresetId: contiSong.overrides.presetId,
  }
}

function draftToContiSongOverrides(draft: ArrangementDraft) {
  return {
    keys: draft.keys,
    tempos: draft.tempos,
    sectionOrder: draft.sectionOrder,
    lyrics: draft.lyrics,
    sectionLyricsMap: draft.sectionLyricsMap,
    notes: draft.notes,
    // Conti export treats null/no explicit selection as all sheet music.
    sheetMusicFileIds: draft.sheetMusicFileIds && draft.sheetMusicFileIds.length > 0
      ? draft.sheetMusicFileIds
      : null,
    presetId: draft.appliedPresetId,
  }
}

export function ContiSongEditor({
  contiSong,
  open,
  onOpenChange,
}: ContiSongEditorProps) {
  const router = useRouter()
  const [presets, setPresets] = useState<ResolvedSongPresetWithSheetMusic[]>([])
  const [songSheetMusic, setSongSheetMusic] = useState<SheetMusicFile[]>([])
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
  const [sheetMusicPreviewLoading, setSheetMusicPreviewLoading] = useState(false)
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
  const currentSongIdRef = useRef(contiSong.songId)
  const sheetMusicRequestIdRef = useRef(0)

  useEffect(() => {
    currentSongIdRef.current = contiSong.songId
  }, [contiSong.songId])

  const refreshPresets = useCallback(async () => {
    const songId = contiSong.songId
    const result = await getPresetsForSongWithSheetMusic(songId)
    if (currentSongIdRef.current !== songId) {
      return []
    }
    if (result.success && result.data) {
      setPresets(result.data)
      return result.data
    }
    return []
  }, [contiSong.songId])

  const refreshSheetMusic = useCallback(async () => {
    const songId = contiSong.songId
    const requestId = sheetMusicRequestIdRef.current + 1
    sheetMusicRequestIdRef.current = requestId
    setSheetMusicLoading(true)
    const result = await getSheetMusicForSong(songId)
    if (currentSongIdRef.current !== songId || sheetMusicRequestIdRef.current !== requestId) {
      return []
    }
    if (result.success && result.data) {
      setSongSheetMusic(result.data)
      setSheetMusicLoading(false)
      return result.data
    }
    setSheetMusicLoading(false)
    return []
  }, [contiSong.songId])

  useEffect(() => {
    if (open) {
      void Promise.resolve().then(refreshPresets)
    }
  }, [open, refreshPresets])

  useEffect(() => {
    if (open) {
      void Promise.resolve().then(refreshSheetMusic)
    }
  }, [open, refreshSheetMusic])

  useEffect(() => {
    let cancelled = false

    void Promise.resolve().then(() => {
      if (!cancelled) {
        setSongSheetMusic([])
        setSheetMusicPreviewLoading(false)
        setSheetMusicPreviewItem(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [contiSong.songId])

  useEffect(() => {
    if (!open) {
      let cancelled = false

      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSheetMusicPreviewLoading(false)
          setSheetMusicPreviewItem(null)
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [open])

  const handleSheetMusicUploaded = (file: SheetMusicFile) => {
    setSongSheetMusic((current) => {
      if (current.some((item) => item.id === file.id)) return current
      return [...current, file]
    })
    router.refresh()
  }

  const handleSheetMusicDeleted = (fileId: string) => {
    setSongSheetMusic((current) => current.filter((file) => file.id !== fileId))
    setSheetMusicPreviewLoading(false)
    setSheetMusicPreviewItem((current) =>
      current?.file.id === fileId ? null : current,
    )
    router.refresh()
  }

  return (
    <ArrangementEditor
      mode="conti-song"
      title="콘티 곡 편집"
      songId={contiSong.songId}
      songName={contiSong.song.name}
      open={open}
      initialDraft={contiSongToDraft(contiSong)}
      availableSheetMusic={songSheetMusic}
      sheetMusicPreviewItem={sheetMusicPreviewItem}
      sheetMusicLoading={sheetMusicLoading || sheetMusicPreviewLoading}
      sheetMusicWorkspacePreview
      sheetMusicManagementSlot={
        <div className="space-y-4">
          <SheetMusicUploader
            songId={contiSong.songId}
            onUploaded={handleSheetMusicUploaded}
          />
          {songSheetMusic.length > 0 && (
            <SheetMusicGallery
              files={songSheetMusic}
              editable
              songId={contiSong.songId}
              onDeleted={handleSheetMusicDeleted}
              previewMode="controlled"
              onPreviewChange={setSheetMusicPreviewItem}
              onPreviewLoadingChange={setSheetMusicPreviewLoading}
            />
          )}
        </div>
      }
      presetOptions={presets}
      presetSaveTargets={presets}
      onOpenChange={onOpenChange}
      onLoadPreset={async (preset) => ({
        ...songPresetToDraft(preset),
        name: contiSong.song.name,
        displayTitle: null,
        isDefault: false,
      })}
      onSave={async (draft) => {
        const result = await updateContiSong(
          contiSong.id,
          draftToContiSongOverrides(draft),
        )

        if (!result.success) {
          return { success: false, error: result.error }
        }

        // YouTube lives on the applied preset, not the conti row.
        const appliedPresetId = draft.appliedPresetId
        const appliedPresetYoutube =
          presets.find((preset) => preset.id === appliedPresetId)?.youtubeReference ??
          (appliedPresetId === contiSong.overrides.presetId
            ? contiSong.appliedPreset?.youtubeReference
            : null)
        if (
          appliedPresetId &&
          shouldSyncAppliedPresetYoutube(draft.youtubeReference, appliedPresetYoutube)
        ) {
          const presetResult = await updateSongPreset(appliedPresetId, {
            youtubeReference: draft.youtubeReference,
            youtubeTitle: draft.youtubeTitle,
          })
          if (!presetResult.success) {
            router.refresh()
            return { success: false, error: presetResult.error }
          }
        }

        router.refresh()
        return { success: true }
      }}
      onSaveToPreset={async (draft, request) => {
        const updateResult = await updateContiSong(
          contiSong.id,
          draftToContiSongOverrides(draft),
        )

        if (!updateResult.success) {
          return { success: false, error: updateResult.error }
        }

        const presetResult = await saveContiSongAsPreset(
          contiSong.id,
          request.presetName,
          request.presetId ?? undefined,
          {
            youtubeReference: request.youtubeReference,
            youtubeTitle: null,
            includeLyrics: request.includeLyrics,
            lyricsSaveScope: request.lyricsSaveScope,
          },
        )

        if (presetResult.success) {
          router.refresh()
        }

        return { success: presetResult.success, error: presetResult.error }
      }}
      onRefreshPresetOptions={async () => {
        await refreshPresets()
        router.refresh()
      }}
    />
  )
}
