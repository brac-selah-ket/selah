export interface LyricsWarning {
  type: 'no-line-break' | 'line-too-long' | 'too-many-lines'
  message: string
}

const MAX_LINE_VISUAL_LENGTH = 23
const MAX_LINE_COUNT = 3

const HANGUL_REGEX = /[가-힣]/
const LATIN_OR_DIGIT_REGEX = /[A-Za-z0-9]/
const WHITESPACE_REGEX = /\s/

export function getLyricsLineVisualLength(line: string): number {
  let length = 0

  for (const char of line) {
    if (HANGUL_REGEX.test(char)) {
      length += 1
    } else if (WHITESPACE_REGEX.test(char)) {
      length += 0.3
    } else if (LATIN_OR_DIGIT_REGEX.test(char)) {
      length += 0.7
    } else {
      length += 1
    }
  }

  return Number(length.toFixed(10))
}

function isLineTooLong(line: string): boolean {
  return getLyricsLineVisualLength(line) > MAX_LINE_VISUAL_LENGTH
}

export function validateLyricsPage(text: string): LyricsWarning[] {
  if (!text.trim()) return []

  const warnings: LyricsWarning[] = []
  const lines = text.split('\n')
  const hasLineBreaks = lines.length > 1

  if (!hasLineBreaks) {
    if (isLineTooLong(text)) {
      warnings.push({
        type: 'no-line-break',
        message: '줄바꿈이 필요합니다',
      })
    }
  } else {
    if (lines.some(isLineTooLong)) {
      warnings.push({
        type: 'line-too-long',
        message: '줄이 너무 깁니다',
      })
    }

    if (lines.length >= MAX_LINE_COUNT) {
      warnings.push({
        type: 'too-many-lines',
        message: '줄 수가 너무 많습니다',
      })
    }
  }

  return warnings
}
