'use server';

import type {
  ActionResult,
  PptxDriveFile,
  PptxExportResult,
  PptxTemplateStructure,
} from '@/lib/types';
import { getConti } from '@/lib/queries/contis';
import {
  ensurePptxFileAllowed,
  listPptxFilesFromDrive,
  sendPptxExportRequest,
  sendPptxInspectRequest,
} from '@/lib/pptx/export-service';
import { buildPptxSongData } from '@/lib/utils/pptx-helpers';

const SECTION_PREFIX = process.env.PPTX_SECTION_PREFIX || process.env.NEXT_PUBLIC_PPTX_SECTION_PREFIX || '찬양';

/**
 * List .pptx files from Google Drive folder.
 * Uses Google Drive REST API directly (no Python dependency needed).
 */
export async function listPptxFiles(): Promise<ActionResult<{ files: PptxDriveFile[] }>> {
  return listPptxFilesFromDrive();
}

export async function exportContiToPptx(options: {
  fileId: string;
  overwrite: boolean;
  outputFileName?: string;
  contiId: string;
  outputFolderId?: string;
  separateMashups?: boolean;
}): Promise<ActionResult<PptxExportResult>> {
  try {
    const allowedFile = await ensurePptxFileAllowed(options.fileId);
    if (!allowedFile.success) {
      return { success: false, error: allowedFile.error };
    }

    const conti = await getConti(options.contiId);
    if (!conti) {
      return { success: false, error: '선택한 콘티를 찾을 수 없습니다' };
    }

    const songs = buildPptxSongData(conti.songs, SECTION_PREFIX, {
      separateMashups: options.separateMashups ?? false,
    });
    if (songs.length === 0) {
      return { success: false, error: '내보낼 찬양 곡이 없습니다' };
    }

    return sendPptxExportRequest({
      fileId: allowedFile.data!.file_id,
      overwrite: options.overwrite,
      outputFileName: options.outputFileName,
      outputFolderId: options.outputFolderId,
      songs,
    });
  } catch (error) {
    console.error('[exportContiToPptx]', error);
    return {
      success: false,
      error: 'PPT 내보내기 중 오류가 발생했습니다',
    };
  }
}

export async function inspectPptxTemplate(
  fileId: string
): Promise<ActionResult<PptxTemplateStructure>> {
  const allowedFile = await ensurePptxFileAllowed(fileId);
  if (!allowedFile.success) {
    return { success: false, error: allowedFile.error };
  }
  return sendPptxInspectRequest(allowedFile.data!.file_id);
}
