import { findScriptureBook } from './books';
import type { ScripturePoint, ScriptureReference } from './types';

function splitBookAndRange(input: string): { book: string; range: string } {
  const trimmed = input.trim().replace(/\s+/g, ' ');
  const withSpace = trimmed.match(/^(.+?)\s+(\d+.*)$/);
  if (withSpace) return { book: withSpace[1], range: withSpace[2] };

  const withoutSpace = trimmed.match(/^([가-힣0-9]+?)(\d+\s*:\s*\d+.*)$/);
  if (withoutSpace) return { book: withoutSpace[1], range: withoutSpace[2] };

  throw new Error('성경 본문 형식이 올바르지 않습니다. 예: 요 3:16~18');
}

function parsePoint(value: string): ScripturePoint {
  const match = value.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) {
    throw new Error('장절 형식이 올바르지 않습니다. 예: 요 3:16');
  }
  return {
    chapter: Number.parseInt(match[1], 10),
    verse: Number.parseInt(match[2], 10),
  };
}

function comparePoints(a: ScripturePoint, b: ScripturePoint): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

function parseRange(range: string): { start: ScripturePoint; end: ScripturePoint } {
  const normalized = range.replace(/[-–—]/g, '~');
  const [startRaw, endRaw] = normalized.split('~').map((part) => part.trim());
  const start = parsePoint(startRaw);

  if (!endRaw) return { start, end: { ...start } };

  const end = endRaw.includes(':')
    ? parsePoint(endRaw)
    : { chapter: start.chapter, verse: Number.parseInt(endRaw, 10) };

  if (!Number.isFinite(end.verse)) {
    throw new Error('끝 절 형식이 올바르지 않습니다. 예: 요 3:16~18');
  }

  if (comparePoints(start, end) > 0) {
    throw new Error('끝 절이 시작 절보다 앞에 있습니다.');
  }

  return { start, end };
}

export function parseScriptureReference(input: string): ScriptureReference {
  const { book: rawBook, range } = splitBookAndRange(input);
  const book = findScriptureBook(rawBook);
  if (!book) {
    throw new Error(`알 수 없는 성경 권입니다: ${rawBook}`);
  }

  const { start, end } = parseRange(range);
  return { book, start, end };
}

function formatPoint(point: ScripturePoint): string {
  return `${point.chapter}:${point.verse}`;
}

export function formatScriptureReference(reference: ScriptureReference): string {
  const { book, start, end } = reference;
  if (start.chapter === end.chapter && start.verse === end.verse) {
    return `${book.abbreviation} ${formatPoint(start)}`;
  }
  if (start.chapter === end.chapter) {
    return `${book.abbreviation} ${formatPoint(start)}~${end.verse}`;
  }
  return `${book.abbreviation} ${formatPoint(start)}~${formatPoint(end)}`;
}

export function formatVerseLabel(reference: ScriptureReference, point: ScripturePoint): string {
  return `${reference.book.abbreviation} ${formatPoint(point)}`;
}
