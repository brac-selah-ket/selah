"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft02Icon,
  FileExportIcon,
  Loading03Icon,
  Presentation01Icon,
  Tick01Icon,
} from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PptxTextEditorDrawer } from "@/components/worship-prep/pptx-text-editor-drawer"
import { listPptxFiles } from "@/lib/actions/pptx-export"
import {
  exportWorshipToPptx,
  getContiForWorshipPptxExport,
  inspectWorshipPptxText,
  previewScripturePptx,
} from "@/lib/actions/worship-pptx-export"
import { DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT } from "@/lib/scripture/pagination"
import { buildPptxSongData } from "@/lib/utils/pptx-helpers"
import {
  buildInitialPptxTextDrafts,
  buildPptxTextOverrides,
} from "@/lib/utils/pptx-text-overrides"
import type { WorshipPrepSummary } from "@/lib/queries/worship-prep"
import type {
  Conti,
  ContiWithSongs,
  PptxDriveFile,
  PptxExportScripturePageData,
  PptxTextStructure,
} from "@/lib/types"

type Step = "file-list" | "worship-data" | "mode-select" | "confirm"

interface WorshipPptxExportButtonProps {
  item: WorshipPrepSummary
  contis: Conti[]
  defaultConti?: ContiWithSongs | null
}

const SECTION_PREFIX = process.env.NEXT_PUBLIC_PPTX_SECTION_PREFIX || "찬양"

const VERSES_PER_SLIDE_OPTIONS = [1, 2, 3, 4, 5]

function formatContiLabel(conti: Pick<Conti, "date" | "title">): string {
  return `${conti.date} - ${conti.title || "콘티"}`
}

function getScripturePreviewRequestKey(
  scriptureReference: string,
  versesPerSlide: number,
  verseTextFormat: string
): string {
  return JSON.stringify([scriptureReference.trim(), versesPerSlide, verseTextFormat])
}

export function WorshipPptxExportButton({
  item,
  contis,
  defaultConti,
}: WorshipPptxExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("file-list")
  const [isPending, startTransition] = useTransition()
  const pptxTextRequestSeqRef = useRef(0)
  const selectedFileIdRef = useRef<string | null>(null)
  const scripturePreviewRequestKeyRef = useRef("")

  const [files, setFiles] = useState<PptxDriveFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  const [selectedFile, setSelectedFile] = useState<PptxDriveFile | null>(null)
  const [scriptureReference, setScriptureReference] = useState(item.scripture ?? "")
  const [selectedContiId, setSelectedContiId] = useState(defaultConti?.id ?? "")
  const [versesPerSlide, setVersesPerSlide] = useState(2)
  const [verseTextFormat, setVerseTextFormat] = useState(DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT)
  const [loadedContis, setLoadedContis] = useState<Record<string, ContiWithSongs>>(() =>
    defaultConti ? { [defaultConti.id]: defaultConti } : {}
  )
  const [contiLoading, setContiLoading] = useState(false)
  const [contiError, setContiError] = useState<string | null>(null)

  const [overwrite, setOverwrite] = useState(true)
  const [outputFileName, setOutputFileName] = useState("")
  const [scripturePreview, setScripturePreview] = useState<{
    requestedReference: string
    requestedVersesPerSlide: number
    requestedVerseTextFormat: string
    reference: string
    slideCount: number
    pages: PptxExportScripturePageData[]
  } | null>(null)
  const [pptxTextDrawerOpen, setPptxTextDrawerOpen] = useState(false)
  const [pptxTextStructure, setPptxTextStructure] = useState<PptxTextStructure | null>(null)
  const [pptxTextLoading, setPptxTextLoading] = useState(false)
  const [pptxTextError, setPptxTextError] = useState<string | null>(null)
  const [pptxTextDrafts, setPptxTextDrafts] = useState<Record<string, string>>({})

  const selectedConti = selectedContiId ? loadedContis[selectedContiId] ?? null : null
  const currentScriptureReference = scriptureReference.trim()
  const effectiveVerseTextFormat = verseTextFormat.trim()
    ? verseTextFormat
    : DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT
  const currentScripturePreviewRequestKey = getScripturePreviewRequestKey(
    currentScriptureReference,
    versesPerSlide,
    effectiveVerseTextFormat
  )
  useEffect(() => {
    selectedFileIdRef.current = selectedFile?.file_id ?? null
  }, [selectedFile])

  useEffect(() => {
    scripturePreviewRequestKeyRef.current = currentScripturePreviewRequestKey
  }, [currentScripturePreviewRequestKey])

  function isCurrentScripturePreview(preview: NonNullable<typeof scripturePreview>): boolean {
    return (
      getScripturePreviewRequestKey(
        preview.requestedReference,
        preview.requestedVersesPerSlide,
        preview.requestedVerseTextFormat
      ) === currentScripturePreviewRequestKey
    )
  }

  const currentScripturePreview =
    scripturePreview && isCurrentScripturePreview(scripturePreview) ? scripturePreview : null

  const songData = useMemo(() => {
    if (!selectedConti) return []
    return buildPptxSongData(selectedConti.songs, SECTION_PREFIX)
  }, [selectedConti])

  const textOverrides = useMemo(
    () => buildPptxTextOverrides(pptxTextStructure, pptxTextDrafts),
    [pptxTextDrafts, pptxTextStructure]
  )

  const selectedContiLabel = useMemo(() => {
    const conti = contis.find((item) => item.id === selectedContiId) ?? selectedConti
    if (!conti) return ""
    return formatContiLabel(conti)
  }, [contis, selectedConti, selectedContiId])

  const contiLabelsById = useMemo(() => {
    return new Map(contis.map((conti) => [conti.id, formatContiLabel(conti)]))
  }, [contis])

  const canOpen = contis.length > 0

  function invalidatePptxTextRequest() {
    pptxTextRequestSeqRef.current += 1
  }

  function resetDialog() {
    invalidatePptxTextRequest()
    selectedFileIdRef.current = null
    scripturePreviewRequestKeyRef.current = getScripturePreviewRequestKey(
      item.scripture ?? "",
      2,
      DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT
    )
    setStep("file-list")
    setFiles([])
    setFilesError(null)
    setSelectedFile(null)
    setScriptureReference(item.scripture ?? "")
    setSelectedContiId(defaultConti?.id ?? "")
    setVersesPerSlide(2)
    setVerseTextFormat(DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT)
    setOverwrite(true)
    setOutputFileName("")
    setScripturePreview(null)
    setPptxTextDrawerOpen(false)
    setPptxTextStructure(null)
    setPptxTextLoading(false)
    setPptxTextError(null)
    setPptxTextDrafts({})
    setContiError(null)
  }

  function loadFilesIfNeeded() {
    if (files.length > 0 || filesLoading || filesError) return

    setFilesLoading(true)
    listPptxFiles().then((result) => {
      if (result.success && result.data) {
        setFiles(result.data.files)
      } else {
        setFilesError(result.error || "파일 목록을 가져오지 못했습니다")
      }
      setFilesLoading(false)
    })
  }

  async function ensureSelectedConti(contiId = selectedContiId) {
    if (!contiId) {
      setContiError("콘티를 선택해 주세요")
      return null
    }

    const cachedConti = loadedContis[contiId]
    if (cachedConti) return cachedConti

    setContiLoading(true)
    setContiError(null)
    const result = await getContiForWorshipPptxExport(contiId)
    setContiLoading(false)

    if (!result.success || !result.data) {
      const message = result.error || "콘티 정보를 가져오지 못했습니다"
      setContiError(message)
      toast.error(message)
      return null
    }

    setLoadedContis((current) => ({ ...current, [result.data!.id]: result.data! }))
    return result.data
  }

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen)
    if (newOpen) {
      loadFilesIfNeeded()
      return
    }

    resetDialog()
  }

  function handleSelectFile(file: PptxDriveFile) {
    invalidatePptxTextRequest()
    selectedFileIdRef.current = file.file_id
    setSelectedFile(file)
    setOutputFileName(file.name)
    setPptxTextDrawerOpen(false)
    setPptxTextStructure(null)
    setPptxTextLoading(false)
    setPptxTextError(null)
    setPptxTextDrafts({})
    setStep("worship-data")
  }

  function handleContiChange(contiId: string) {
    setSelectedContiId(contiId)
    setScripturePreview(null)
    setContiError(null)
    if (!loadedContis[contiId]) {
      void ensureSelectedConti(contiId)
    }
  }

  function handleWorshipDataConfirm() {
    startTransition(async () => {
      const scripture = scriptureReference.trim()
      if (!scripture) {
        toast.error("말씀 본문을 입력해 주세요")
        return
      }

      const conti = await ensureSelectedConti()
      if (!conti) return

      const songs = buildPptxSongData(conti.songs, SECTION_PREFIX)
      if (songs.length === 0) {
        toast.error("내보낼 찬양 곡이 없습니다", {
          description: "선택한 콘티에 섹션 순서가 설정된 곡이 필요합니다.",
        })
        return
      }

      setStep("mode-select")
    })
  }

  async function loadScripturePreview(): Promise<NonNullable<typeof scripturePreview> | null> {
    const scripture = scriptureReference.trim()
    if (!scripture) {
      toast.error("말씀 본문을 입력해 주세요")
      return null
    }
    const requestKey = getScripturePreviewRequestKey(
      scripture,
      versesPerSlide,
      effectiveVerseTextFormat
    )

    const result = await previewScripturePptx({
      scriptureReference: scripture,
      versesPerSlide,
      verseTextFormat: effectiveVerseTextFormat,
    })

    if (!result.success || !result.data) {
      toast.error(result.error || "말씀 본문을 확인하지 못했습니다")
      return null
    }

    const currentKey = scripturePreviewRequestKeyRef.current
    if (currentKey !== requestKey) {
      return null
    }

    const preview = {
      requestedReference: scripture,
      requestedVersesPerSlide: versesPerSlide,
      requestedVerseTextFormat: effectiveVerseTextFormat,
      reference: result.data.reference,
      slideCount: result.data.slideCount,
      pages: result.data.pages,
    }
    setScripturePreview(preview)
    return preview
  }

  function handlePreviewScripture() {
    startTransition(async () => {
      await loadScripturePreview()
    })
  }

  function handleModeConfirm() {
    if (!overwrite && !outputFileName.trim()) {
      toast.error("파일명을 입력해 주세요")
      return
    }

    startTransition(async () => {
      const preview = currentScripturePreview || (await loadScripturePreview())
      if (!preview || !isCurrentScripturePreview(preview)) return
      setStep("confirm")
    })
  }

  function handleBack() {
    if (step === "worship-data") {
      setStep("file-list")
      setSelectedFile(null)
      selectedFileIdRef.current = null
    } else if (step === "mode-select") {
      setStep("worship-data")
    } else if (step === "confirm") {
      setStep("mode-select")
    }
  }

  async function handleOpenPptxTextEditor() {
    if (!selectedFile) {
      toast.error("PPT 파일을 선택해 주세요")
      return
    }

    setPptxTextDrawerOpen(true)
    if (pptxTextStructure?.file_id === selectedFile.file_id) return

    const inspectedFileId = selectedFile.file_id
    const requestSeq = pptxTextRequestSeqRef.current + 1
    pptxTextRequestSeqRef.current = requestSeq
    setPptxTextLoading(true)
    setPptxTextError(null)
    const result = await inspectWorshipPptxText(inspectedFileId)
    if (requestSeq !== pptxTextRequestSeqRef.current || selectedFileIdRef.current !== inspectedFileId) {
      return
    }
    setPptxTextLoading(false)

    if (!result.success || !result.data) {
      const message = result.error || "PPT 텍스트를 불러오지 못했습니다"
      setPptxTextError(message)
      toast.error(message)
      return
    }

    setPptxTextStructure(result.data)
    setPptxTextDrafts(buildInitialPptxTextDrafts(result.data))
  }

  function handleResetPptxTextDrafts() {
    setPptxTextDrafts(buildInitialPptxTextDrafts(pptxTextStructure))
  }

  function handleExport() {
    if (!selectedFile || !selectedConti) return

    if (!scriptureReference.trim()) {
      toast.error("말씀 본문을 입력해 주세요")
      return
    }

    if (songData.length === 0) {
      toast.error("내보낼 찬양 곡이 없습니다")
      return
    }

    startTransition(async () => {
      const result = await exportWorshipToPptx({
        fileId: selectedFile.file_id,
        overwrite,
        outputFileName: overwrite ? undefined : outputFileName.trim(),
        contiId: selectedConti.id,
        scriptureReference: scriptureReference.trim(),
        versesPerSlide,
        verseTextFormat: effectiveVerseTextFormat,
        sermonTitle: item.title,
        textOverrides,
      })

      if (!result.success || !result.data) {
        toast.error(result.error || "예배 PPT 내보내기에 실패했습니다")
        return
      }

      handleOpenChange(false)

      if (result.data.download_url) {
        const a = document.createElement("a")
        a.href = result.data.download_url
        a.download = result.data.file_name || "worship.pptx"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success("예배 PPT 다운로드를 시작했습니다")
      } else if (result.data.web_view_link) {
        toast.success("예배 PPT 내보내기 완료", {
          description: `${result.data.file_name} (${result.data.slides_generated}슬라이드)`,
          action: {
            label: "Google Drive에서 열기",
            onClick: () => window.open(result.data!.web_view_link, "_blank"),
          },
        })
      } else {
        toast.success("예배 PPT 내보내기 완료", {
          description: `${result.data.file_name} 파일이 저장되었습니다`,
        })
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => handleOpenChange(true)}
        disabled={!canOpen}
        title={canOpen ? undefined : "선택할 콘티가 없습니다"}
      >
        <HugeiconsIcon icon={FileExportIcon} strokeWidth={2} data-icon="inline-start" />
        예배 PPT 내보내기
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange} modal={pptxTextDrawerOpen ? false : true}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] grid-rows-[auto_1fr_auto]">
          <DialogHeader>
            <DialogTitle>
              {step === "file-list" && "PPT 파일 선택"}
              {step === "worship-data" && "예배 데이터 설정"}
              {step === "mode-select" && "내보내기 방식"}
              {step === "confirm" && "내보내기 확인"}
            </DialogTitle>
            <DialogDescription>
              {step === "file-list" && "Google Drive에서 수정할 .pptx 파일을 선택하세요."}
              {step === "worship-data" && "말씀 본문과 함께 내보낼 콘티를 확인하세요."}
              {step === "mode-select" && "선택한 파일을 덮어쓰거나 새 파일로 저장할 수 있습니다."}
              {step === "confirm" && "아래 내용을 확인한 후 내보내기를 시작하세요."}
            </DialogDescription>
          </DialogHeader>

          {step === "file-list" && (
            <div className="flex flex-col gap-2 overflow-y-auto min-h-0">
              {filesLoading && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  파일 목록을 불러오는 중...
                </p>
              )}
              {filesError && (
                <p className="text-sm text-destructive py-4 text-center">
                  {filesError}
                </p>
              )}
              {!filesLoading && !filesError && files.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  .pptx 파일이 없습니다
                </p>
              )}
              {!filesLoading && files.map((file) => (
                <button
                  key={file.file_id}
                  type="button"
                  onClick={() => handleSelectFile(file)}
                  className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-foreground/30 transition-colors"
                >
                  <HugeiconsIcon icon={Presentation01Icon} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    {file.modified_time && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.modified_time).toLocaleDateString("ko-KR")}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === "worship-data" && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">선택한 파일</p>
                <p className="truncate text-sm font-medium">{selectedFile?.name}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scripture-reference" className="text-sm">
                  말씀 본문
                </Label>
                <Input
                  id="scripture-reference"
                  value={scriptureReference}
                  onChange={(event) => {
                    setScriptureReference(event.target.value)
                    setScripturePreview(null)
                  }}
                  placeholder="요 3:16-18"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conti-select" className="text-sm">
                  콘티
                </Label>
                <Select
                  id="conti-select"
                  value={selectedContiId || null}
                  onValueChange={(value) => handleContiChange(String(value ?? ""))}
                >
                  <SelectTrigger className="h-9 w-full justify-between">
                    <SelectValue placeholder="콘티 선택">
                      {(value) => contiLabelsById.get(String(value ?? "")) ?? "콘티 선택"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {contis.map((conti) => (
                      <SelectItem key={conti.id} value={conti.id}>
                        {formatContiLabel(conti)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contiLoading && (
                  <p className="text-xs text-muted-foreground">콘티 정보를 불러오는 중...</p>
                )}
                {contiError && (
                  <p className="text-xs text-destructive">{contiError}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="verses-per-slide" className="text-sm">
                  절/슬라이드
                </Label>
                <Select
                  id="verses-per-slide"
                  value={String(versesPerSlide)}
                  onValueChange={(value) => {
                    setVersesPerSlide(Number(value))
                    setScripturePreview(null)
                  }}
                >
                  <SelectTrigger className="h-9 w-full justify-between">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERSES_PER_SLIDE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="verse-text-format" className="text-sm">
                  절 표시 서식
                </Label>
                <Input
                  id="verse-text-format"
                  value={verseTextFormat}
                  onChange={(event) => {
                    setVerseTextFormat(event.target.value)
                    setScripturePreview(null)
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">말씀 미리보기</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePreviewScripture}
                    disabled={isPending}
                  >
                    {isPending && (
                      <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />
                    )}
                    {isPending ? "불러오는 중..." : "미리보기"}
                  </Button>
                </div>
                {currentScripturePreview && (
                  <div className="rounded-lg border bg-muted/30">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                      <span className="text-sm font-medium">{currentScripturePreview.reference}</span>
                      <span className="text-xs text-muted-foreground">
                        {currentScripturePreview.slideCount}슬라이드
                      </span>
                    </div>
                    <div className="max-h-[min(42vh,28rem)] space-y-2 overflow-y-auto p-3">
                      {currentScripturePreview.pages.map((page, index) => (
                        <div key={`${page.verse_start}-${page.verse_end}-${index}`} className="rounded-md border bg-background p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">{page.title}</p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{page.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "mode-select" && selectedFile && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">선택한 파일</p>
                  <p className="truncate text-sm font-medium">{selectedFile.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">예배 데이터</p>
                  <p className="break-words text-sm font-medium">{scriptureReference.trim()}</p>
                  <p className="break-words text-xs text-muted-foreground">{selectedContiLabel}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setOverwrite(true)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    overwrite ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">덮어쓰기</p>
                    <p className="text-xs text-muted-foreground">
                      Google Drive 파일을 직접 수정합니다
                    </p>
                  </div>
                  {overwrite && (
                    <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setOverwrite(false)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    !overwrite ? "border-primary bg-primary/5" : "hover:border-foreground/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">새 파일</p>
                    <p className="text-xs text-muted-foreground">
                      파일을 다운로드합니다
                    </p>
                  </div>
                  {!overwrite && (
                    <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="shrink-0 text-primary" />
                  )}
                </button>
              </div>

              {!overwrite && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="worship-output-name" className="text-sm">
                    파일명
                  </Label>
                  <Input
                    id="worship-output-name"
                    value={outputFileName}
                    onChange={(event) => setOutputFileName(event.target.value)}
                    placeholder="worship.pptx"
                  />
                </div>
              )}
            </div>
          )}

          {step === "confirm" && selectedFile && currentScripturePreview && (
            <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">파일</span>
                  <span className="min-w-0 break-words text-right font-medium">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">방식</span>
                  <span className="min-w-0 break-words text-right font-medium">
                    {overwrite ? "덮어쓰기" : `새 파일: ${outputFileName}`}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">말씀</span>
                  <span className="min-w-0 break-words text-right font-medium">{currentScripturePreview.reference}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">말씀 제목</span>
                  <span className="min-w-0 break-words text-right font-medium">{item.title || "-"}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">말씀 슬라이드</span>
                  <span className="font-medium">{currentScripturePreview.slideCount}장</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">절/슬라이드</span>
                  <span className="font-medium">{versesPerSlide}</span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">콘티</span>
                  <span className="min-w-0 break-words text-right font-medium">{selectedContiLabel}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">찬양 목록</p>
                <div className="space-y-1">
                  {songData.map((song) => (
                    <div key={song.section_name} className="flex justify-between gap-3 text-sm">
                      <span className="min-w-0 break-words">
                        <span className="text-muted-foreground">{song.section_name}:</span>{" "}
                        {song.title}
                      </span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        ~{song.section_order.filter((section) => section.trim().toLowerCase() !== "intro").length}슬라이드
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {step !== "file-list" && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isPending || pptxTextDrawerOpen}
              >
                <HugeiconsIcon icon={ArrowLeft02Icon} strokeWidth={2} data-icon="inline-start" />
                뒤로
              </Button>
            )}
            {step === "file-list" && (
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                취소
              </Button>
            )}
            {step === "worship-data" && (
              <Button onClick={handleWorshipDataConfirm} disabled={isPending || contiLoading}>
                {(isPending || contiLoading) && (
                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />
                )}
                {isPending || contiLoading ? "확인 중..." : "다음"}
              </Button>
            )}
            {step === "mode-select" && (
              <Button onClick={handleModeConfirm} disabled={isPending}>
                {isPending && (
                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />
                )}
                {isPending ? "말씀 확인 중..." : "다음"}
              </Button>
            )}
            {step === "confirm" && (
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenPptxTextEditor}
                disabled={isPending || pptxTextLoading || pptxTextDrawerOpen}
              >
                {pptxTextLoading ? "불러오는 중..." : "PPT 텍스트 수정"}
              </Button>
            )}
            {step === "confirm" && (
              <Button
                onClick={handleExport}
                disabled={isPending || pptxTextDrawerOpen}
              >
                {isPending && (
                  <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="animate-spin" data-icon="inline-start" />
                )}
                {isPending ? "내보내는 중..." : "내보내기"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PptxTextEditorDrawer
        open={pptxTextDrawerOpen}
        onOpenChange={setPptxTextDrawerOpen}
        fileName={selectedFile?.name ?? ""}
        structure={pptxTextStructure}
        loading={pptxTextLoading}
        error={pptxTextError}
        drafts={pptxTextDrafts}
        onDraftsChange={setPptxTextDrafts}
        onReset={handleResetPptxTextDrafts}
      />
    </>
  )
}
