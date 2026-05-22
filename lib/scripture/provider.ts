import * as cheerio from 'cheerio';
import type { ScriptureBook, ScriptureReference, ScriptureVerse } from './types';

const BSKOREA_LEGACY_URL = 'https://www.bskorea.or.kr/bible/korbibReadpage.php';

function cleanVerseText(value: string): string {
  return value
    .replace(/\d+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseBskoreaChapterHtml(
  html: string,
  book: ScriptureBook,
  chapter: number,
): ScriptureVerse[] {
  const $ = cheerio.load(html);
  const verses: ScriptureVerse[] = [];
  const seen = new Set<number>();

  $('.leftCont span').each((_, element) => {
    const text = $(element).text().replace(/\u00a0/g, ' ').trim();
    const match = text.match(/^(\d+)\s+(.+)$/s);
    if (!match) return;

    const verse = Number.parseInt(match[1], 10);
    if (!Number.isFinite(verse) || seen.has(verse)) return;

    const verseText = cleanVerseText(match[2]);
    if (!verseText) return;

    seen.add(verse);
    verses.push({ book, chapter, verse, text: verseText });
  });

  if (verses.length === 0) {
    throw new Error(`${book.abbreviation} ${chapter}장에서 본문을 찾지 못했습니다.`);
  }

  return verses.sort((a, b) => a.verse - b.verse);
}

async function fetchChapterHtml(book: ScriptureBook, chapter: number): Promise<string> {
  const url = new URL(BSKOREA_LEGACY_URL);
  url.searchParams.set('version', 'GAE');
  url.searchParams.set('book', book.bskoreaCode);
  url.searchParams.set('chap', String(chapter));

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'storyboard-worship-ppt-export/1.0',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`성경 본문 조회 실패 (${response.status})`);
  }

  return response.text();
}

function chaptersInReference(reference: ScriptureReference): number[] {
  const chapters: number[] = [];
  for (let chapter = reference.start.chapter; chapter <= reference.end.chapter; chapter += 1) {
    chapters.push(chapter);
  }
  return chapters;
}

export async function fetchScriptureVerses(reference: ScriptureReference): Promise<ScriptureVerse[]> {
  const chapterCache = new Map<number, ScriptureVerse[]>();
  const allVerses: ScriptureVerse[] = [];

  for (const chapter of chaptersInReference(reference)) {
    let chapterVerses = chapterCache.get(chapter);
    if (!chapterVerses) {
      const html = await fetchChapterHtml(reference.book, chapter);
      chapterVerses = parseBskoreaChapterHtml(html, reference.book, chapter);
      chapterCache.set(chapter, chapterVerses);
    }

    const filtered = chapterVerses.filter((verse) => {
      if (verse.chapter === reference.start.chapter && verse.verse < reference.start.verse) return false;
      if (verse.chapter === reference.end.chapter && verse.verse > reference.end.verse) return false;
      return true;
    });
    allVerses.push(...filtered);
  }

  if (allVerses.length === 0) {
    throw new Error('요청한 범위에서 성경 본문을 찾지 못했습니다.');
  }

  const first = allVerses[0];
  const last = allVerses[allVerses.length - 1];
  if (first.chapter !== reference.start.chapter || first.verse !== reference.start.verse) {
    throw new Error(`시작 절을 찾지 못했습니다: ${reference.book.abbreviation} ${reference.start.chapter}:${reference.start.verse}`);
  }
  if (last.chapter !== reference.end.chapter || last.verse !== reference.end.verse) {
    throw new Error(`끝 절을 찾지 못했습니다: ${reference.book.abbreviation} ${reference.end.chapter}:${reference.end.verse}`);
  }

  return allVerses;
}
