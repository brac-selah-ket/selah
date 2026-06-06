'use server';

import type { ActionResult } from '@/lib/types';
import {
  buildScripturePreview,
  type ScripturePreviewResult,
} from '@/lib/scripture/preview';

export async function previewScriptureReference(
  scriptureReference: string,
): Promise<ActionResult<ScripturePreviewResult>> {
  try {
    return {
      success: true,
      data: await buildScripturePreview(scriptureReference),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '말씀 본문 미리보기를 불러오지 못했습니다.',
    };
  }
}
