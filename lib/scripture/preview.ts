import { fetchScriptureVerses } from './provider';
import {
  formatScriptureReferences,
  formatVerseLabel,
  parseScriptureReferences,
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

  const references = parseScriptureReferences(trimmedReference);
  const verses: ScripturePreviewVerse[] = [];

  for (const reference of references) {
    const passageVerses = await fetcher(reference);
    if (passageVerses.length === 0) {
      throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
    }
    verses.push(
      ...passageVerses.map((verse) => ({
        label: formatVerseLabel(reference, verse),
        text: verse.text,
      })),
    );
  }

  return {
    reference: formatScriptureReferences(references),
    verses,
  };
}
