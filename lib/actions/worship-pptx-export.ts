'use server';

import { ensurePptxFileAllowed, sendPptxExportRequest } from '@/lib/pptx/export-service';
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
} from '@/lib/types';
import { buildPptxScriptureData, buildPptxSongData } from '@/lib/utils/pptx-helpers';

const SECTION_PREFIX = process.env.PPTX_SECTION_PREFIX || process.env.NEXT_PUBLIC_PPTX_SECTION_PREFIX || '찬양';

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
  contiId: string;
  scriptureReference: string;
  versesPerSlide?: number;
  outputFolderId?: string;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const scriptureReference = options.scriptureReference.trim();
    if (!scriptureReference) {
      return { success: false, error: '말씀 본문을 입력해 주세요' };
    }

    const allowedFile = await ensurePptxFileAllowed(options.fileId);
    if (!allowedFile.success) {
      return { success: false, error: allowedFile.error };
    }

    const conti = await getConti(options.contiId);
    if (!conti) {
      return { success: false, error: '선택한 콘티를 찾을 수 없습니다' };
    }

    const songs = buildPptxSongData(conti.songs, SECTION_PREFIX);
    if (songs.length === 0) {
      return { success: false, error: '내보낼 찬양 곡이 없습니다' };
    }

    const scripture = await buildScripturePayload(
      scriptureReference,
      options.versesPerSlide
    );

    return sendPptxExportRequest({
      fileId: allowedFile.data!.file_id,
      overwrite: options.overwrite,
      outputFileName: options.outputFileName,
      outputFolderId: options.outputFolderId,
      songs,
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
