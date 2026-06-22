import type { InferSelectModel } from 'drizzle-orm';
import type {
  songs,
  sheetMusicFiles,
  contis,
  contiSongs,
  songPresets,
  contiPdfExports,
  songPageImages,
  presetSheetMusic,
  songPresetSongs,
  discordThreadStates,
  discordProcessedMessages,
  discordInteractionReceipts,
  worshipPrepNotifications,
} from './db/schema';

export type Song = InferSelectModel<typeof songs>;
export type SheetMusicFile = InferSelectModel<typeof sheetMusicFiles>;
export type Conti = InferSelectModel<typeof contis>;
export type ContiSong = InferSelectModel<typeof contiSongs>;
export type SongPreset = InferSelectModel<typeof songPresets>;
export type PresetSheetMusic = InferSelectModel<typeof presetSheetMusic>;
export type SongPresetSong = InferSelectModel<typeof songPresetSongs>;

export interface ContiSongOverrides {
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
  sheetMusicFileIds: string[] | null;  // null = use all
  presetId: string | null;
}

export interface PresetPdfPageMetadata {
  pdfPageIndex: number | null;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  overlays: OverlayElement[];
}

export interface PresetPdfFileMetadata {
  sheetMusicFileId: string;
  pages: PresetPdfPageMetadata[];
}

export interface PresetPdfMetadata {
  files: PresetPdfFileMetadata[];
}

export type SongPresetType = 'single' | 'mashup';

export interface SongPresetMember {
  id: string;
  presetId: string;
  songId: string;
  sortOrder: number;
  partLabel: string | null;
  songName?: string;
}

export interface SongPresetData {
  name: string;
  displayTitle?: string | null;
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
  isDefault: boolean;
  youtubeReference?: string | null;
  youtubeTitle?: string | null;
  sheetMusicFileIds?: string[];  // references to sheet_music_files.id
  pdfMetadata?: PresetPdfMetadata | null;
}

export interface SongWithSheetMusic extends Song {
  sheetMusic: SheetMusicFile[];
  presets?: SongPresetWithSheetMusic[];
}

export interface SongPresetWithSheetMusic extends SongPreset {
  sheetMusicFileIds: string[];
  members: SongPresetMember[];
}

export interface ContiSongWithSong extends ContiSong {
  song: Song;
  overrides: ContiSongOverrides;
  appliedPreset?: Pick<SongPreset, 'id' | 'name' | 'youtubeReference' | 'youtubeTitle'> | null;
}

export interface ArrangementItem {
  key: string;
  type: 'single' | 'mashup';
  displayTitle: string;
  displaySongNames: string[];
  songs: ContiSongWithSong[];
  primarySong: ContiSongWithSong;
  presetId: string | null;
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  tempos: number[];
  keys: string[];
}

export interface ContiWithSongs extends Conti {
  songs: ContiSongWithSong[];
}

export interface ContiSongSummary {
  id: string
  songId: string
  sortOrder: number
  songName: string
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  presetId: string | null
  presetName: string | null
  youtubeReference: string | null
  youtubeTitle: string | null
  hasSheetMusicSelection: boolean
}

export interface ContiWithSongSummaries extends Conti {
  songSummaries: ContiSongSummary[]
  songCount: number
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export type ContiPdfExport = InferSelectModel<typeof contiPdfExports>;
export type SongPageImage = InferSelectModel<typeof songPageImages>;
export type DiscordThreadState = InferSelectModel<typeof discordThreadStates>;
export type DiscordProcessedMessage = InferSelectModel<typeof discordProcessedMessages>;
export type DiscordInteractionReceipt = InferSelectModel<typeof discordInteractionReceipts>;
export type WorshipPrepNotification = InferSelectModel<typeof worshipPrepNotifications>;

export interface OverlayElement {
  id: string;
  type: 'songNumber' | 'sectionOrder' | 'bpm' | 'custom';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color?: string;
}

export interface PageLayout {
  pageIndex: number;
  songIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex?: number | null;
  overlays: OverlayElement[];
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  originalImageUrl?: string;
}

export interface PdfLayoutState {
  pages: PageLayout[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface ContiSongWithSheetMusic extends ContiSongWithSong {
  sheetMusic: SheetMusicFile[];
  presetPdfMetadata?: PresetPdfMetadata | null;
}

export interface ContiWithSongsAndSheetMusic extends Conti {
  songs: ContiSongWithSheetMusic[];
}

export interface YouTubePlaylistItem {
  title: string
  videoId: string
  position: number
}

// PPTX Export types

export interface PptxDriveFile {
  file_id: string;
  name: string;
  modified_time: string;
}

export interface PptxExportSongData {
  title: string;
  section_name: string;
  section_order: string[];
  lyrics: string[];
  section_lyrics_map: Record<string, number[]>;
}

export interface PptxExportScripturePageData {
  title: string;
  text: string;
  verse_start: string;
  verse_end: string;
}

export interface PptxExportScriptureData {
  section_name: string;
  reference: string;
  pages: PptxExportScripturePageData[];
  sermon_title?: string;
  sermon_title_section_name?: string;
}

export interface PptxTextShape {
  shape_id: string;
  shape_name: string;
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptxTextSlide {
  slide_id: number;
  slide_index: number;
  section_name: string;
  title: string;
  shapes: PptxTextShape[];
}

export interface PptxTextSection {
  section_id: string;
  name: string;
  slide_ids: number[];
  slides: PptxTextSlide[];
}

export interface PptxTextStructure {
  file_id: string;
  sections: PptxTextSection[];
}

export interface PptxTextOverride {
  slide_id: number;
  shape_id: string;
  text: string;
}

export interface PptxExportRequest {
  action: 'export_lyrics';
  file_id: string;
  overwrite: boolean;
  output_file_name?: string;
  output_folder_id?: string;
  songs: PptxExportSongData[];
  scripture?: PptxExportScriptureData;
  text_overrides?: PptxTextOverride[];
}

export interface PptxExportResult {
  file_id: string;
  file_name: string;
  web_view_link: string;
  download_url?: string;
  songs_processed: number;
  slides_generated: number;
  scripture_processed?: boolean;
  scripture_slides_generated?: number;
  text_overrides_applied?: number;
  text_overrides_skipped?: number;
}

export interface PptxTemplateSectionInfo {
  name: string;
  id: string;
  slide_ids: number[];
  slide_count: number;
}

export interface PptxTemplateShape {
  name: string;
  shape_type: string;
  has_text_frame: boolean;
  text_preview?: string;
  paragraph_count?: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptxTemplateSlide {
  slide_index: number;
  shapes: PptxTemplateShape[];
}

export interface PptxTemplateStructure {
  slide_count: number;
  slides: PptxTemplateSlide[];
  sections: PptxTemplateSectionInfo[] | null;
}
