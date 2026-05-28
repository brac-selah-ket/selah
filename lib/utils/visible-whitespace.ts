export const VISIBLE_SPACE = '·';
export const VISIBLE_TAB = '→';
export const VISIBLE_TAB_PADDING = '\u00a0\u00a0\u00a0';
export const VISIBLE_NEWLINE = '↵';

export function toVisibleWhitespaceText(value: string): string {
  return value
    .replace(/ /g, VISIBLE_SPACE)
    .replace(/\t/g, `${VISIBLE_TAB}${VISIBLE_TAB_PADDING}`)
    .replace(/\n/g, `${VISIBLE_NEWLINE}\n`);
}
