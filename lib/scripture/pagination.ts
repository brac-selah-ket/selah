import type { ScriptureSlidePage, ScriptureVerse } from './types';

export const DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT = '{절번호}\\t{절}';

const MAX_SCRIPTURE_VERSES = 80;

interface ScripturePaginationOptions {
  verseTextFormat?: string;
}

function pointLabel(verse: ScriptureVerse): string {
  return `${verse.chapter}:${verse.verse}`;
}

function pageTitle(start: ScriptureVerse, end: ScriptureVerse): string {
  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${start.book.abbreviation} ${pointLabel(start)}`;
  }
  if (start.chapter === end.chapter) {
    return `${start.book.abbreviation} ${pointLabel(start)}-${end.verse}`;
  }
  return `${start.book.abbreviation} ${pointLabel(start)}-${pointLabel(end)}`;
}

function normalizeVerseTextFormat(format?: string): string {
  if (!format || format.trim().length === 0) {
    return DEFAULT_SCRIPTURE_VERSE_TEXT_FORMAT.replaceAll('\\t', '\t');
  }
  return format.replaceAll('\\t', '\t');
}

function formatVerseText(verse: ScriptureVerse, format: string): string {
  return format
    .replaceAll('{절번호}', String(verse.verse))
    .replaceAll('{절}', verse.text);
}

export function paginateScriptureVerses(
  verses: ScriptureVerse[],
  versesPerSlide = 2,
  options: ScripturePaginationOptions = {},
): ScriptureSlidePage[] {
  if (!Number.isInteger(versesPerSlide) || versesPerSlide < 1 || versesPerSlide > 5) {
    throw new Error('절/슬라이드 값은 1에서 5 사이여야 합니다.');
  }
  if (verses.length > MAX_SCRIPTURE_VERSES) {
    throw new Error(`말씀 본문은 최대 ${MAX_SCRIPTURE_VERSES}절까지만 내보낼 수 있습니다.`);
  }

  const verseTextFormat = normalizeVerseTextFormat(options.verseTextFormat);
  const pages: ScriptureSlidePage[] = [];
  for (let index = 0; index < verses.length; index += versesPerSlide) {
    const chunk = verses.slice(index, index + versesPerSlide);
    const start = chunk[0];
    const end = chunk[chunk.length - 1];
    pages.push({
      title: pageTitle(start, end),
      text: chunk.map((verse) => formatVerseText(verse, verseTextFormat)).join('\n'),
      verseStart: pointLabel(start),
      verseEnd: pointLabel(end),
    });
  }
  return pages;
}
