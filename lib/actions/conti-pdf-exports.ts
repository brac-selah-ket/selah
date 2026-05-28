'use server';

import { revalidatePath } from 'next/cache';
import { put, del } from '@vercel/blob';
import type { ActionResult, ContiPdfExport } from '@/lib/types';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function saveContiPdfLayout(
  contiId: string,
  layoutState: string,
): Promise<ActionResult<ContiPdfExport>> {
  try {
    const pdfExport = await getStoryboardRepository().upsertContiPdfExport(contiId, {
      layoutState,
    });

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

    // Check for existing export to clean up old blob
    const repository = getStoryboardRepository();
    const existing = await repository.getContiPdfExport(contiId);

    // Delete old blob if exists
    if (existing?.pdfUrl) {
      try {
        await del(existing.pdfUrl);
      } catch {
        // Ignore blob deletion errors (file may already be gone)
      }
    }

    // Upload new PDF to Vercel Blob
    const blob = await put(`conti-exports/${contiId}.pdf`, file, {
      access: 'public',
    });

    await repository.upsertContiPdfExport(contiId, { pdfUrl: blob.url });

    revalidatePath('/contis');

    return {
      success: true,
      data: { pdfUrl: blob.url },
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

    // Delete blob if exists
    if (existing.pdfUrl) {
      try {
        await del(existing.pdfUrl);
      } catch {
        // Ignore blob deletion errors
      }
    }

    await repository.deleteContiPdfExport(exportId);
    revalidatePath('/contis');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'PDF 삭제 중 오류가 발생했습니다',
    };
  }
}
