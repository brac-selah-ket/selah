import type { ScriptureSlidePage } from '@/lib/scripture/types';
import type {
  ContiSongWithSong,
  PptxDriveFile,
  PptxExportScriptureData,
  PptxExportSongData,
} from '@/lib/types';

/**
 * Build PPTX export song data from conti songs.
 * Section names are auto-generated: `${prefix} ${1-based index}`.
 * Only songs with sectionOrder configured are included.
 * Max 4 songs (matches typical worship setlist and PPT template sections).
 */
export function buildPptxSongData(
  songs: ContiSongWithSong[],
  prefix: string
): PptxExportSongData[] {
  return songs
    .filter((cs) => cs.overrides.sectionOrder.length > 0)
    .slice(0, 4)
    .map((cs, idx) => ({
      title: cs.song.name,
      section_name: `${prefix} ${idx + 1}`,
      section_order: cs.overrides.sectionOrder,
      lyrics: cs.overrides.lyrics,
      section_lyrics_map: Object.fromEntries(
        Object.entries(cs.overrides.sectionLyricsMap).map(
          ([k, v]) => [String(k), v]
        )
      ),
    }));
}

export function buildPptxScriptureData(
  reference: string,
  pages: ScriptureSlidePage[],
  sectionName: string,
  options: {
    sermonTitle?: string | null;
    sermonTitleSectionName?: string;
  } = {}
): PptxExportScriptureData {
  const sermonTitle = options.sermonTitle
    ?.replace(/\r?\n|\r/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

  return {
    section_name: sectionName,
    reference,
    pages: pages.map((page) => ({
      title: page.title,
      text: page.text,
      verse_start: page.verseStart,
      verse_end: page.verseEnd,
    })),
    ...(sermonTitle ? { sermon_title: sermonTitle } : {}),
    ...(options.sermonTitleSectionName ? { sermon_title_section_name: options.sermonTitleSectionName } : {}),
  };
}

export function findAllowedPptxFile(
  files: PptxDriveFile[],
  fileId: string
): PptxDriveFile | null {
  return files.find((file) => file.file_id === fileId) ?? null;
}
