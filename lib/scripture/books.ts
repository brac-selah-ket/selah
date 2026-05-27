import type { ScriptureBook } from './types';

export const SCRIPTURE_BOOKS: ScriptureBook[] = [
  { order: 1, name: '창세기', abbreviation: '창', bskoreaCode: 'gen' },
  { order: 2, name: '출애굽기', abbreviation: '출', bskoreaCode: 'exo' },
  { order: 3, name: '레위기', abbreviation: '레', bskoreaCode: 'lev' },
  { order: 4, name: '민수기', abbreviation: '민', bskoreaCode: 'num' },
  { order: 5, name: '신명기', abbreviation: '신', bskoreaCode: 'deu' },
  { order: 6, name: '여호수아', abbreviation: '수', bskoreaCode: 'jos' },
  { order: 7, name: '사사기', abbreviation: '삿', bskoreaCode: 'jdg' },
  { order: 8, name: '룻기', abbreviation: '룻', bskoreaCode: 'rut' },
  { order: 9, name: '사무엘상', abbreviation: '삼상', bskoreaCode: '1sa' },
  { order: 10, name: '사무엘하', abbreviation: '삼하', bskoreaCode: '2sa' },
  { order: 11, name: '열왕기상', abbreviation: '왕상', bskoreaCode: '1ki' },
  { order: 12, name: '열왕기하', abbreviation: '왕하', bskoreaCode: '2ki' },
  { order: 13, name: '역대상', abbreviation: '대상', bskoreaCode: '1ch' },
  { order: 14, name: '역대하', abbreviation: '대하', bskoreaCode: '2ch' },
  { order: 15, name: '에스라', abbreviation: '스', bskoreaCode: 'ezr' },
  { order: 16, name: '느헤미야', abbreviation: '느', bskoreaCode: 'neh' },
  { order: 17, name: '에스더', abbreviation: '에', bskoreaCode: 'est' },
  { order: 18, name: '욥기', abbreviation: '욥', bskoreaCode: 'job' },
  { order: 19, name: '시편', abbreviation: '시', bskoreaCode: 'psa' },
  { order: 20, name: '잠언', abbreviation: '잠', bskoreaCode: 'pro' },
  { order: 21, name: '전도서', abbreviation: '전', bskoreaCode: 'ecc' },
  { order: 22, name: '아가', abbreviation: '아', bskoreaCode: 'sng' },
  { order: 23, name: '이사야', abbreviation: '사', bskoreaCode: 'isa' },
  { order: 24, name: '예레미야', abbreviation: '렘', bskoreaCode: 'jer' },
  { order: 25, name: '예레미야애가', abbreviation: '애', bskoreaCode: 'lam' },
  { order: 26, name: '에스겔', abbreviation: '겔', bskoreaCode: 'ezk' },
  { order: 27, name: '다니엘', abbreviation: '단', bskoreaCode: 'dan' },
  { order: 28, name: '호세아', abbreviation: '호', bskoreaCode: 'hos' },
  { order: 29, name: '요엘', abbreviation: '욜', bskoreaCode: 'jol' },
  { order: 30, name: '아모스', abbreviation: '암', bskoreaCode: 'amo' },
  { order: 31, name: '오바댜', abbreviation: '옵', bskoreaCode: 'oba' },
  { order: 32, name: '요나', abbreviation: '욘', bskoreaCode: 'jon' },
  { order: 33, name: '미가', abbreviation: '미', bskoreaCode: 'mic' },
  { order: 34, name: '나훔', abbreviation: '나', bskoreaCode: 'nam' },
  { order: 35, name: '하박국', abbreviation: '합', bskoreaCode: 'hab' },
  { order: 36, name: '스바냐', abbreviation: '습', bskoreaCode: 'zep' },
  { order: 37, name: '학개', abbreviation: '학', bskoreaCode: 'hag' },
  { order: 38, name: '스가랴', abbreviation: '슥', bskoreaCode: 'zec' },
  { order: 39, name: '말라기', abbreviation: '말', bskoreaCode: 'mal' },
  { order: 40, name: '마태복음', abbreviation: '마', bskoreaCode: 'mat' },
  { order: 41, name: '마가복음', abbreviation: '막', bskoreaCode: 'mrk' },
  { order: 42, name: '누가복음', abbreviation: '눅', bskoreaCode: 'luk' },
  { order: 43, name: '요한복음', abbreviation: '요', bskoreaCode: 'jhn' },
  { order: 44, name: '사도행전', abbreviation: '행', bskoreaCode: 'act' },
  { order: 45, name: '로마서', abbreviation: '롬', bskoreaCode: 'rom' },
  { order: 46, name: '고린도전서', abbreviation: '고전', bskoreaCode: '1co' },
  { order: 47, name: '고린도후서', abbreviation: '고후', bskoreaCode: '2co' },
  { order: 48, name: '갈라디아서', abbreviation: '갈', bskoreaCode: 'gal' },
  { order: 49, name: '에베소서', abbreviation: '엡', bskoreaCode: 'eph' },
  { order: 50, name: '빌립보서', abbreviation: '빌', bskoreaCode: 'php' },
  { order: 51, name: '골로새서', abbreviation: '골', bskoreaCode: 'col' },
  { order: 52, name: '데살로니가전서', abbreviation: '살전', bskoreaCode: '1th' },
  { order: 53, name: '데살로니가후서', abbreviation: '살후', bskoreaCode: '2th' },
  { order: 54, name: '디모데전서', abbreviation: '딤전', bskoreaCode: '1ti' },
  { order: 55, name: '디모데후서', abbreviation: '딤후', bskoreaCode: '2ti' },
  { order: 56, name: '디도서', abbreviation: '딛', bskoreaCode: 'tit' },
  { order: 57, name: '빌레몬서', abbreviation: '몬', bskoreaCode: 'phm' },
  { order: 58, name: '히브리서', abbreviation: '히', bskoreaCode: 'heb' },
  { order: 59, name: '야고보서', abbreviation: '약', bskoreaCode: 'jas' },
  { order: 60, name: '베드로전서', abbreviation: '벧전', bskoreaCode: '1pe' },
  { order: 61, name: '베드로후서', abbreviation: '벧후', bskoreaCode: '2pe' },
  { order: 62, name: '요한일서', abbreviation: '요일', bskoreaCode: '1jn' },
  { order: 63, name: '요한이서', abbreviation: '요이', bskoreaCode: '2jn' },
  { order: 64, name: '요한삼서', abbreviation: '요삼', bskoreaCode: '3jn' },
  { order: 65, name: '유다서', abbreviation: '유', bskoreaCode: 'jud' },
  { order: 66, name: '요한계시록', abbreviation: '계', bskoreaCode: 'rev' },
];

const EXTRA_ALIASES: Record<string, string> = {
  예레미야애가: '애',
  예레미야애가서: '애',
  예레미야애: '애',
  애가: '애',
  요한1서: '요일',
  요한2서: '요이',
  요한3서: '요삼',
};

const BOOK_BY_ALIAS = new Map<string, ScriptureBook>();

for (const book of SCRIPTURE_BOOKS) {
  BOOK_BY_ALIAS.set(book.name, book);
  BOOK_BY_ALIAS.set(book.abbreviation, book);
  BOOK_BY_ALIAS.set(book.name.replace(/서$/, ''), book);
}

for (const [alias, abbreviation] of Object.entries(EXTRA_ALIASES)) {
  const book = SCRIPTURE_BOOKS.find((candidate) => candidate.abbreviation === abbreviation);
  if (book) BOOK_BY_ALIAS.set(alias, book);
}

export function findScriptureBook(rawBook: string): ScriptureBook | null {
  const normalized = rawBook.replace(/\s+/g, '').trim();
  return BOOK_BY_ALIAS.get(normalized) ?? null;
}
