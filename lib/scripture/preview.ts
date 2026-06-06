import { fetchScriptureVerses } from './provider';
import {
  formatScriptureReference,
  formatVerseLabel,
  parseScriptureReference,
} from './reference';
import type { ScriptureReference, ScriptureVerse } from './types';

export interface ScripturePreviewVerse {
  label: string;
  text: string;
}

export interface ScripturePreviewResult {
  reference: string;
  verses: ScripturePreviewVerse[];
}

type ScripturePreviewFetcher = (reference: ScriptureReference) => Promise<ScriptureVerse[]>;

export async function buildScripturePreview(
  scriptureReference: string,
  fetcher: ScripturePreviewFetcher = fetchScriptureVerses,
): Promise<ScripturePreviewResult> {
  const trimmedReference = scriptureReference.trim();
  if (!trimmedReference) {
    throw new Error('말씀 본문을 입력해 주세요');
  }

  const reference = parseScriptureReference(trimmedReference);
  const verses = await fetcher(reference);

  if (verses.length === 0) {
    throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
  }

  return {
    reference: formatScriptureReference(reference),
    verses: verses.map((verse) => ({
      label: formatVerseLabel(reference, verse),
      text: verse.text,
    })),
  };
}
