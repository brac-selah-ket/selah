'use client'

import { getSheetMusicAssetUrl } from '@/lib/sheet-music-assets'
import type { SheetMusicFile } from '@/lib/types'
import { getPdfPageCount, renderPdfPagesToDataUrls } from '@/lib/utils/pdfjs'

export interface SheetMusicLyricsImagePage {
  imageDataUrl: string
  sourceName: string
  pageLabel: string
}

export const GEMINI_LYRICS_IMAGE_MAX_EDGE = 1800
export const GEMINI_LYRICS_IMAGE_JPEG_QUALITY = 0.86
export const GEMINI_LYRICS_IMAGE_MAX_TOTAL_BYTES = 20 * 1024 * 1024

function assertBrowserRuntime(): void {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof FileReader === 'undefined' ||
    typeof Image === 'undefined'
  ) {
    throw new Error('악보 이미지 준비는 브라우저 환경에서만 실행할 수 있습니다.')
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
}

function getDataUrlDecodedByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',', 2)[1]
  if (!base64) {
    return 0
  }

  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function assertPreparedImageBudget(
  totalBytes: number,
  pageLabel: string,
): void {
  if (totalBytes > GEMINI_LYRICS_IMAGE_MAX_TOTAL_BYTES) {
    throw new Error(
      `${pageLabel} 처리 후 준비된 이미지가 20MB를 초과했습니다. 페이지 수를 줄이거나 더 작은 악보 파일을 사용해 주세요.`,
    )
  }
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('파일을 data URL로 변환할 수 없습니다.'))
      }
    }
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'))
    reader.readAsDataURL(blob)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'))
    image.src = dataUrl
  })
}

export async function compressImageDataUrlForGemini(
  dataUrl: string,
): Promise<string> {
  assertBrowserRuntime()

  const image = await loadImage(dataUrl)
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight)
  const scale =
    maxDimension > GEMINI_LYRICS_IMAGE_MAX_EDGE
      ? GEMINI_LYRICS_IMAGE_MAX_EDGE / maxDimension
      : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('이미지 변환 캔버스를 만들 수 없습니다.')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', GEMINI_LYRICS_IMAGE_JPEG_QUALITY)
}

async function fetchImageFileAsDataUrl(file: SheetMusicFile): Promise<string> {
  const response = await fetch(getSheetMusicAssetUrl(file))
  if (!response.ok) {
    throw new Error(`${file.fileName} 파일을 불러올 수 없습니다.`)
  }

  const blob = await response.blob()
  return readBlobAsDataUrl(blob)
}

export async function buildSheetMusicLyricsImagePages(
  sheetMusicFiles: SheetMusicFile[],
): Promise<SheetMusicLyricsImagePage[]> {
  assertBrowserRuntime()

  const pages: SheetMusicLyricsImagePage[] = []
  let totalPreparedImageBytes = 0

  for (const file of sheetMusicFiles) {
    const assetUrl = getSheetMusicAssetUrl(file)

    if (file.fileType.startsWith('image/')) {
      try {
        const rawDataUrl = await fetchImageFileAsDataUrl(file)
        const imageDataUrl = await compressImageDataUrlForGemini(rawDataUrl)
        totalPreparedImageBytes += getDataUrlDecodedByteLength(imageDataUrl)
        assertPreparedImageBudget(totalPreparedImageBytes, file.fileName)

        pages.push({
          imageDataUrl,
          sourceName: file.fileName,
          pageLabel: file.fileName,
        })
      } catch (error) {
        throw new Error(`${file.fileName} 이미지 준비 실패: ${getErrorMessage(error)}`)
      }
      continue
    }

    if (file.fileType === 'application/pdf') {
      let pageCount: number

      try {
        pageCount = await getPdfPageCount(assetUrl)
      } catch (error) {
        throw new Error(`${file.fileName} PDF 페이지 수 확인 실패: ${getErrorMessage(error)}`)
      }

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        const pageLabel = `${file.fileName} - ${pageNumber}/${pageCount}페이지`

        try {
          const [renderedPage] = await renderPdfPagesToDataUrls(
            assetUrl,
            [pageNumber],
            2,
          )
          const imageDataUrl = await compressImageDataUrlForGemini(renderedPage)
          totalPreparedImageBytes += getDataUrlDecodedByteLength(imageDataUrl)
          assertPreparedImageBudget(totalPreparedImageBytes, pageLabel)

          pages.push({
            imageDataUrl,
            sourceName: file.fileName,
            pageLabel,
          })
        } catch (error) {
          throw new Error(`${pageLabel} 준비 실패: ${getErrorMessage(error)}`)
        }
      }
    }
  }

  return pages
}
