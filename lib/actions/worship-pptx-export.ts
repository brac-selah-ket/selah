'use server';

import { exportContiToPptx } from '@/lib/actions/pptx-export';
import { getConti } from '@/lib/queries/contis';
import { paginateScriptureVerses } from '@/lib/scripture/pagination';
import { fetchScriptureVerses } from '@/lib/scripture/provider';
import { formatScriptureReference, parseScriptureReference } from '@/lib/scripture/reference';
import type {
  ActionResult,
  ContiWithSongs,
  PptxExportResult,
  PptxExportScriptureData,
  PptxExportScripturePageData,
  PptxExportSongData,
} from '@/lib/types';
import { buildPptxScriptureData } from '@/lib/utils/pptx-helpers';

function getScriptureSectionName(): string {
  return (
    process.env.PPTX_SCRIPTURE_SECTION_NAME ||
    process.env.NEXT_PUBLIC_PPTX_SCRIPTURE_SECTION_NAME ||
    '봉독 말씀'
  );
}

async function buildScripturePayload(
  scriptureReference: string,
  versesPerSlide?: number
): Promise<PptxExportScriptureData> {
  const parsedReference = parseScriptureReference(scriptureReference);
  const reference = formatScriptureReference(parsedReference);
  const verses = await fetchScriptureVerses(parsedReference);
  const pages = paginateScriptureVerses(verses, versesPerSlide);

  return buildPptxScriptureData(reference, pages, getScriptureSectionName());
}

export async function previewScripturePptx(options: {
  scriptureReference: string;
  versesPerSlide?: number;
}): Promise<ActionResult<{
  reference: string;
  slideCount: number;
  pages: PptxExportScripturePageData[];
}>> {
  try {
    const scriptureReference = options.scriptureReference.trim();
    if (!scriptureReference) {
      return { success: false, error: '말씀 본문을 입력해 주세요' };
    }

    const scripture = await buildScripturePayload(
      scriptureReference,
      options.versesPerSlide
    );

    return {
      success: true,
      data: {
        reference: scripture.reference,
        slideCount: scripture.pages.length,
        pages: scripture.pages,
      },
    };
  } catch (error) {
    console.error('[previewScripturePptx]', error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : '말씀 PPT 미리보기를 준비하는 중 오류가 발생했습니다',
    };
  }
}

export async function getContiForWorshipPptxExport(
  contiId: string
): Promise<ActionResult<ContiWithSongs>> {
  try {
    if (!contiId) {
      return { success: false, error: '콘티를 선택해 주세요' };
    }

    const conti = await getConti(contiId);
    if (!conti) {
      return { success: false, error: '선택한 콘티를 찾을 수 없습니다' };
    }

    return { success: true, data: conti };
  } catch (error) {
    console.error('[getContiForWorshipPptxExport]', error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : '콘티 정보를 가져오는 중 오류가 발생했습니다',
    };
  }
}

export async function exportWorshipToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  scriptureReference: string;
  versesPerSlide?: number;
  songs: PptxExportSongData[];
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const scriptureReference = options.scriptureReference.trim();
    if (!scriptureReference) {
      return { success: false, error: '말씀 본문을 입력해 주세요' };
    }
    if (!Array.isArray(options.songs) || options.songs.length === 0) {
      return { success: false, error: '내보낼 찬양 곡이 없습니다' };
    }

    const scripture = await buildScripturePayload(
      scriptureReference,
      options.versesPerSlide
    );

    return exportContiToPptx({
      fileId: options.fileId,
      overwrite: options.overwrite,
      outputFileName: options.outputFileName,
      outputFolderId: options.outputFolderId,
      songs: options.songs,
      scripture,
    });
  } catch (error) {
    console.error('[exportWorshipToPptx]', error);
    return {
      success: false,
      error: error instanceof Error
        ? error.message
        : '예배 PPT 내보내기 중 오류가 발생했습니다',
    };
  }
}
