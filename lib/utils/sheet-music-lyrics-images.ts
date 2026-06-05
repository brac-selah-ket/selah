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
  const pages: SheetMusicLyricsImagePage[] = []

  for (const file of sheetMusicFiles) {
    const assetUrl = getSheetMusicAssetUrl(file)

    if (file.fileType.startsWith('image/')) {
      const rawDataUrl = await fetchImageFileAsDataUrl(file)
      pages.push({
        imageDataUrl: await compressImageDataUrlForGemini(rawDataUrl),
        sourceName: file.fileName,
        pageLabel: file.fileName,
      })
      continue
    }

    if (file.fileType === 'application/pdf') {
      const pageCount = await getPdfPageCount(assetUrl)
      const pageNums = Array.from({ length: pageCount }, (_, index) => index + 1)
      const renderedPages = await renderPdfPagesToDataUrls(assetUrl, pageNums, 2)

      for (let index = 0; index < renderedPages.length; index++) {
        pages.push({
          imageDataUrl: await compressImageDataUrlForGemini(renderedPages[index]),
          sourceName: file.fileName,
          pageLabel: `${file.fileName} - ${index + 1}/${pageCount}페이지`,
        })
      }
    }
  }

  return pages
}
