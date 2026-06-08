'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult, ContiPdfExport } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';
import { invalidateConti } from '@/lib/cache/invalidation';
import { deleteObject, putObject } from '@/lib/storage';

export async function saveContiPdfLayout(
  contiId: string,
  layoutState: string,
): Promise<ActionResult<ContiPdfExport>> {
  try {
    const pdfExport = await getStoryboardRepository().upsertContiPdfExport(contiId, {
      layoutState,
    });
    invalidateConti(contiId);

    return {
      success: true,
      data: pdfExport,
    };
  } catch (error) {
    return {
      success: false,
      error: '레이아웃 저장 중 오류가 발생했습니다',
    };
  }
}

export async function exportContiPdf(
  contiId: string,
  formData: FormData,
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const file = formData.get('file') as File;

    if (!file) {
      return {
        success: false,
        error: 'PDF 파일이 없습니다',
      };
    }

    const repository = getStoryboardRepository();
    const existing = await repository.getContiPdfExport(contiId);

    if (existing?.pdfUrl) {
      try {
        await deleteObject(existing.pdfUrl);
      } catch {
        // Ignore deletion errors; the old file may already be gone.
      }
    }

    const object = await putObject(`conti-exports/${contiId}.pdf`, file, {
      allowOverwrite: true,
      contentType: file.type || 'application/pdf',
    });

    await repository.upsertContiPdfExport(contiId, { pdfUrl: object.url });

    invalidateConti(contiId);
    revalidatePath('/contis');

    return {
      success: true,
      data: { pdfUrl: object.url },
    };
  } catch (error) {
    return {
      success: false,
      error: 'PDF 내보내기 중 오류가 발생했습니다',
    };
  }
}

export async function deleteContiPdfExport(
  exportId: string,
): Promise<ActionResult> {
  try {
    const repository = getStoryboardRepository();
    const existing = await repository.getContiPdfExportById(exportId);

    if (!existing) {
      return {
        success: false,
        error: 'PDF 내보내기를 찾을 수 없습니다',
      };
    }

    if (existing.pdfUrl) {
      try {
        await deleteObject(existing.pdfUrl);
      } catch {
        // Ignore deletion errors; the old file may already be gone.
      }
    }

    await repository.deleteContiPdfExport(exportId);
    invalidateConti(existing.contiId);
    revalidatePath('/contis');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'PDF 삭제 중 오류가 발생했습니다',
    };
  }
}
