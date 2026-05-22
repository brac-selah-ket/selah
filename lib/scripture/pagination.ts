import type { ScriptureSlidePage, ScriptureVerse } from './types';

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

export function paginateScriptureVerses(
  verses: ScriptureVerse[],
  versesPerSlide = 2,
): ScriptureSlidePage[] {
  if (!Number.isInteger(versesPerSlide) || versesPerSlide < 1 || versesPerSlide > 5) {
    throw new Error('절/슬라이드 값은 1에서 5 사이여야 합니다.');
  }

  const pages: ScriptureSlidePage[] = [];
  for (let index = 0; index < verses.length; index += versesPerSlide) {
    const chunk = verses.slice(index, index + versesPerSlide);
    const start = chunk[0];
    const end = chunk[chunk.length - 1];
    pages.push({
      title: pageTitle(start, end),
      text: chunk.map((verse) => `${verse.verse} ${verse.text}`.trim()).join('\n'),
      verseStart: pointLabel(start),
      verseEnd: pointLabel(end),
    });
  }
  return pages;
}
