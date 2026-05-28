export const VISIBLE_SPACE = '·';
export const VISIBLE_TAB = '⇥';
export const VISIBLE_NEWLINE = '↵';

export function toVisibleWhitespaceText(value: string): string {
  return value
    .replace(/ /g, VISIBLE_SPACE)
    .replace(/\t/g, VISIBLE_TAB)
    .replace(/\n/g, `${VISIBLE_NEWLINE}\n`);
}
