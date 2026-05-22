"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { OverrideEditorFields } from "@/components/shared/override-editor-fields"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { updateContiSong, saveContiSongAsPreset } from "@/lib/actions/conti-songs"
import {
  getPresetSheetMusicFileIds,
  getPresetsForSong,
  getSongPresetWithSheetMusic,
  updateSongPreset,
} from "@/lib/actions/song-presets"
import type {
  ContiSongWithSong,
  PresetPdfMetadata,
  SheetMusicFile,
  SongPreset,
  SongPresetWithSheetMusic,
} from "@/lib/types"
import { SheetMusicSelector } from "@/components/shared/sheet-music-selector"
import { getSheetMusicForSong } from "@/lib/actions/sheet-music"
import { SheetMusicUploader } from "@/components/songs/sheet-music-uploader"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { PresetPdfEditor } from "@/components/songs/preset-pdf-editor"

interface ContiSongEditorProps {
  contiSong: ContiSongWithSong
  open: boolean
  onOpenChange: (open: boolean) => void
}

function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field) as T
  } catch {
    return fallback
  }
}

export function ContiSongEditor({
  contiSong,
  open,
  onOpenChange,
}: ContiSongEditorProps) {
  const router = useRouter()
  const { id, overrides } = contiSong

  // Local state for all override fields (batch save)
  const [keys, setKeys] = useState<string[]>(overrides.keys)
  const [tempos, setTempos] = useState<number[]>(overrides.tempos)
  const [sectionOrder, setSectionOrder] = useState<string[]>(overrides.sectionOrder)
  const [lyrics, setLyrics] = useState<string[]>(overrides.lyrics)
  const [sectionLyricsMap, setSectionLyricsMap] = useState<Record<number, number[]>>(overrides.sectionLyricsMap)
  const [notes, setNotes] = useState<string | null>(overrides.notes)

  // Unsaved changes tracking
  const { isDirty, markDirty, reset: resetDirty } = useUnsavedChanges(overrides)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Pending states
  const [isSaving, setIsSaving] = useState(false)
  const [isPresetSaving, setIsPresetSaving] = useState(false)

  // Preset management
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<SongPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [sheetMusicFileIds, setSheetMusicFileIds] = useState<string[] | null>(null)
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(overrides.presetId)
  const [songSheetMusic, setSongSheetMusic] = useState<SheetMusicFile[]>([])
  const [pdfEditorOpen, setPdfEditorOpen] = useState(false)
  const [editingPdfPreset, setEditingPdfPreset] = useState<SongPresetWithSheetMusic | null>(null)
  const [loadingPdfPresetId, setLoadingPdfPresetId] = useState<string | null>(null)

  const refreshPresets = useCallback(async () => {
    const result = await getPresetsForSong(contiSong.songId)
    if (result.success && result.data) {
      setPresets(result.data)
      return result.data
    }
    return []
  }, [contiSong.songId])

  const refreshSheetMusic = useCallback(async () => {
    const result = await getSheetMusicForSong(contiSong.songId)
    if (result.success && result.data) {
      setSongSheetMusic(result.data)
      return result.data
    }
    return []
  }, [contiSong.songId])

  const selectedSheetMusic = useMemo(() => {
    if (!sheetMusicFileIds) {
      return songSheetMusic
    }
    const selected = new Set(sheetMusicFileIds)
    return songSheetMusic.filter((file) => selected.has(file.id))
  }, [sheetMusicFileIds, songSheetMusic])

  const editingPdfSheetMusic = useMemo(() => {
    if (!editingPdfPreset) {
      return []
    }
    if (editingPdfPreset.sheetMusicFileIds.length === 0) {
      return songSheetMusic
    }
    const byId = new Map(songSheetMusic.map((file) => [file.id, file]))
    return editingPdfPreset.sheetMusicFileIds.reduce<SheetMusicFile[]>((result, fileId) => {
      const file = byId.get(fileId)
      if (file) result.push(file)
      return result
    }, [])
  }, [editingPdfPreset, songSheetMusic])

  const editingPdfSectionOrder = useMemo(
    () => parseJsonField<string[]>(editingPdfPreset?.sectionOrder ?? null, []),
    [editingPdfPreset],
  )

  const editingPdfTempos = useMemo(
    () => parseJsonField<number[]>(editingPdfPreset?.tempos ?? null, []),
    [editingPdfPreset],
  )

  const editingPdfMetadata = useMemo(
    () => parseJsonField<PresetPdfMetadata | null>(editingPdfPreset?.pdfMetadata ?? null, null),
    [editingPdfPreset],
  )

  // Initialize state from contiSong when drawer opens
  useEffect(() => {
    if (open) {
      setKeys(overrides.keys)
      setTempos(overrides.tempos)
      setSectionOrder(overrides.sectionOrder)
      setLyrics(overrides.lyrics)
      setSectionLyricsMap(overrides.sectionLyricsMap)
      setNotes(overrides.notes)
      setSheetMusicFileIds(overrides.sheetMusicFileIds)
      setAppliedPresetId(overrides.presetId)
      resetDirty()
      setEditorKey(k => k + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contiSong.id])

  // Fetch presets when drawer opens
  useEffect(() => {
    if (open) {
      void refreshPresets()
    }
  }, [open, refreshPresets])

  // Fetch sheet music for this song when drawer opens
  useEffect(() => {
    if (open) {
      void refreshSheetMusic()
    }
  }, [open, refreshSheetMusic])

  // onChange handlers that update state AND mark dirty
  const handleKeysTemposChange = (data: { keys: string[]; tempos: number[] }) => {
    setKeys(data.keys)
    setTempos(data.tempos)
    markDirty()
  }

  const handleSectionOrderChange = (data: { sectionOrder: string[] }) => {
    setSectionOrder(data.sectionOrder)
    markDirty()
  }

  const handleLyricsChange = (data: { lyrics: string[]; swappedPages?: [number, number]; insertedAt?: number }) => {
    setLyrics(data.lyrics)
    if (data.swappedPages) {
      const [a, b] = data.swappedPages
      setSectionLyricsMap(prev => {
        const next: Record<number, number[]> = {}
        for (const [key, indices] of Object.entries(prev)) {
          const filtered = indices.filter(i => i !== a && i !== b)
          if (filtered.length > 0) {
            next[Number(key)] = filtered
          }
        }
        return next
      })
      toast.warning(`페이지 ${a + 1}, ${b + 1}의 섹션-가사 매핑이 해제되었습니다`)
    }
    if (data.insertedAt !== undefined) {
      const insertIdx = data.insertedAt
      setSectionLyricsMap(prev => {
        if (Object.keys(prev).length === 0) return prev
        const next: Record<number, number[]> = {}
        for (const [key, indices] of Object.entries(prev)) {
          next[Number(key)] = indices.map(i => (i >= insertIdx ? i + 1 : i))
        }
        return next
      })
      toast.info(`페이지 ${insertIdx + 1} 위치에 빈 페이지가 삽입되어 매핑이 조정되었습니다`)
    }
    markDirty()
  }

  const handleSectionLyricsMapChange = (data: { sectionLyricsMap: Record<number, number[]> }) => {
    setSectionLyricsMap(data.sectionLyricsMap)
    markDirty()
  }

  const handleNotesChange = (newNotes: string | null) => {
    setNotes(newNotes)
    markDirty()
  }

  const handleSheetMusicUploaded = (file: SheetMusicFile) => {
    setSongSheetMusic((current) => {
      if (current.some((item) => item.id === file.id)) return current
      return [...current, file]
    })
    setSheetMusicFileIds((current) => {
      if (current === null) return current
      if (current.includes(file.id)) return current
      markDirty()
      return [...current, file.id]
    })
    router.refresh()
  }

  const handleSheetMusicDeleted = (fileId: string) => {
    setSongSheetMusic((current) => current.filter((file) => file.id !== fileId))
    setSheetMusicFileIds((current) => {
      if (current === null) return current
      const next = current.filter((id) => id !== fileId)
      if (next.length === current.length) return current
      markDirty()
      return next.length > 0 ? next : null
    })
    router.refresh()
  }

  // Batch save
  const handleSave = async () => {
    setIsSaving(true)
    try {
        const result = await updateContiSong(id, {
        keys, tempos, sectionOrder, lyrics, sectionLyricsMap, notes, sheetMusicFileIds, presetId: appliedPresetId,
      })
      if (result.success) {
        toast.success("곡 설정이 저장되었습니다")
        resetDirty()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Close with unsaved changes check
  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      onOpenChange(false)
    }
  }

  // Preset load — updates local state only (no server action)
  async function handleLoadPreset(preset: SongPreset) {
    if (!confirm(`"${preset.name}" 프리셋을 불러오면 현재 설정이 덮어씌워집니다. 계속하시겠습니까?`)) {
      return
    }
    setKeys(parseJsonField<string[]>(preset.keys, []))
    setTempos(parseJsonField<number[]>(preset.tempos, []))
    setSectionOrder(parseJsonField<string[]>(preset.sectionOrder, []))
    setLyrics(parseJsonField<string[]>(preset.lyrics, []))
    setSectionLyricsMap(parseJsonField<Record<number, number[]>>(preset.sectionLyricsMap, {}))
    setNotes(preset.notes)
    // Load preset's sheet music selection
    const fileIds = await getPresetSheetMusicFileIds(preset.id)
    setSheetMusicFileIds(fileIds.length > 0 ? fileIds : null)
    setAppliedPresetId(preset.id)
    setEditorKey(k => k + 1)
    markDirty()
    toast.success(`"${preset.name}" 프리셋을 불러왔습니다`)
  }

  async function handleOpenPresetPdfEditor(presetId: string) {
    setLoadingPdfPresetId(presetId)
    try {
      const result = await getSongPresetWithSheetMusic(presetId)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "프리셋을 불러올 수 없습니다")
        return
      }
      setEditingPdfPreset(result.data)
      setPdfEditorOpen(true)
    } finally {
      setLoadingPdfPresetId(null)
    }
  }

  async function handleSavePresetPdfMetadata(metadata: PresetPdfMetadata | null) {
    if (!editingPdfPreset) return

    const result = await updateSongPreset(editingPdfPreset.id, { pdfMetadata: metadata })
    if (!result.success) {
      throw new Error(result.error ?? "프리셋 PDF 저장 중 오류가 발생했습니다")
    }

    if (result.data) {
      setEditingPdfPreset((current) =>
        current
          ? {
              ...current,
              ...result.data,
              sheetMusicFileIds: current.sheetMusicFileIds,
            }
          : current,
      )
    }
    await refreshPresets()
    router.refresh()
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={() => onOpenChange(false)}
        onBeforeClose={() => {
          if (isDirty) {
            setShowUnsavedDialog(true)
            return false
          }
          return true
        }}
        title="곡 편집"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* 프리셋 관리 / 악보 선택 — 2-column grid */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-base font-medium">프리셋 관리</h3>
              {presets.length > 0 && (
                <div className="mb-3">
                  <label className="text-sm text-muted-foreground mb-1 block">프리셋 불러오기</label>
                  <div className="flex flex-col gap-1">
                    {presets.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          className="hover:bg-muted flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-left text-base transition-colors disabled:opacity-50"
                          onClick={() => handleLoadPreset(p)}
                          disabled={isSaving}
                        >
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="flex items-center gap-1.5">
                            {p.youtubeReference && (
                              <a
                                href={`https://www.youtube.com/watch?v=${p.youtubeReference}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                YT
                              </a>
                            )}
                            {p.isDefault && (
                              <span className="text-sm text-muted-foreground">기본</span>
                            )}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenPresetPdfEditor(p.id)}
                          disabled={loadingPdfPresetId === p.id}
                        >
                          {loadingPdfPresetId === p.id ? "로딩" : "PDF 편집"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!showPresetSave ? (
                <Button variant="outline" size="sm" onClick={() => setShowPresetSave(true)}>
                  프리셋으로 저장
                </Button>
              ) : (
                <div className="space-y-3">
                  {presets.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-muted-foreground">기존 프리셋 업데이트</label>
                      <select
                        className="rounded border px-2 py-1 text-base"
                        value={selectedPresetId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value || null
                          setSelectedPresetId(val)
                          if (val) {
                            const preset = presets.find(p => p.id === val)
                            if (preset) setPresetName(preset.name)
                          } else {
                            setPresetName("")
                          }
                        }}
                      >
                        <option value="">새 프리셋 만들기</option>
                        {presets.map(p => (
                          <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (기본)" : ""}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Input
                    placeholder="프리셋 이름"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!presetName.trim() || isPresetSaving}
                      onClick={() => {
                        if (isDirty) {
                          toast.error("먼저 저장을 눌러 변경사항을 반영한 후 프리셋으로 저장하세요.")
                          return
                        }
                        setIsPresetSaving(true)
                        saveContiSongAsPreset(
                          contiSong.id,
                          presetName.trim(),
                          selectedPresetId ?? undefined
                        ).then(async (result) => {
                          if (result.success) {
                            toast.success(selectedPresetId ? "프리셋이 업데이트되었습니다" : "새 프리셋이 저장되었습니다")
                            setShowPresetSave(false)
                            setPresetName("")
                            setSelectedPresetId(null)
                            await refreshPresets()
                          } else {
                            toast.error(result.error ?? "프리셋 저장 중 오류가 발생했습니다")
                          }
                        }).finally(() => {
                          setIsPresetSaving(false)
                        })
                      }}
                    >
                      {isPresetSaving ? "저장 중..." : (selectedPresetId ? "프리셋 업데이트" : "프리셋 저장")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowPresetSave(false); setPresetName(""); setSelectedPresetId(null) }}>
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-base font-medium">악보 관리</label>
                <p className="text-sm text-muted-foreground">
                  악보를 등록하고 PDF 내보내기에 포함할 파일을 선택하세요.
                </p>
              </div>
              <SheetMusicUploader
                songId={contiSong.songId}
                onUploaded={handleSheetMusicUploaded}
              />
              {songSheetMusic.length > 0 ? (
                <>
                  <SheetMusicSelector
                    songId={contiSong.songId}
                    selectedFileIds={sheetMusicFileIds ?? []}
                    onSelectionChange={(ids) => { setSheetMusicFileIds(ids.length > 0 ? ids : null); markDirty() }}
                    availableFiles={songSheetMusic}
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">등록된 악보</p>
                    <SheetMusicGallery
                      files={songSheetMusic}
                      editable
                      songId={contiSong.songId}
                      onDeleted={handleSheetMusicDeleted}
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  등록된 악보가 없습니다.
                </div>
              )}
            </div>
          </div>

          <div className="border-t" />

          <div key={editorKey}>
            <OverrideEditorFields
              keys={keys}
              tempos={tempos}
              sectionOrder={sectionOrder}
              lyrics={lyrics}
              sectionLyricsMap={sectionLyricsMap}
              notes={notes}
              sheetMusicFiles={selectedSheetMusic}
              onKeysTemposChange={handleKeysTemposChange}
              onSectionOrderChange={handleSectionOrderChange}
              onLyricsChange={handleLyricsChange}
              onSectionLyricsMapChange={handleSectionLyricsMapChange}
              onNotesChange={handleNotesChange}
            />
          </div>
        </div>
      </Drawer>

      <Dialog
        open={pdfEditorOpen}
        onOpenChange={(nextOpen) => {
          setPdfEditorOpen(nextOpen)
          if (!nextOpen) setEditingPdfPreset(null)
        }}
      >
        <DialogContent className="!w-screen !h-[100dvh] !max-w-none sm:!max-w-none rounded-none overflow-x-hidden overflow-y-auto p-3 sm:p-4 flex flex-col">
          <div className="min-h-0 flex-1">
            {editingPdfPreset && (
              <PresetPdfEditor
                songName={contiSong.song.name}
                sheetMusic={editingPdfSheetMusic}
                sectionOrder={editingPdfSectionOrder}
                tempos={editingPdfTempos}
                initialMetadata={editingPdfMetadata}
                onSave={handleSavePresetPdfMetadata}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경사항이 있습니다. 저장하지 않고 닫으시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              계속 편집
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              setShowUnsavedDialog(false)
              resetDirty()
              onOpenChange(false)
            }}>
              저장하지 않고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
