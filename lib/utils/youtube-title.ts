export function cleanYouTubeTitle(title: string): string {
  return title
    .replace(/\s*[\[\(]\s*(Official\s*(M\/?V|Video|Audio|Lyric\s*Video)|공식\s*(뮤직비디오|MV|영상)|Lyrics?\s*Video|가사\s*영상)\s*[\]\)]\s*/gi, '')
    .replace(/\s*[\[\(]\s*(?:4K|HD|HQ)\s*[\]\)]\s*/gi, '')
    .replace(/\s*\/\/\s*.*$/, '')
    .trim()
}
