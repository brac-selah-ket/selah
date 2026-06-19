export interface Song {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SheetMusicFile {
  id: string;
  songId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sortOrder: number;
  createdAt: Date;
}

export interface SongPreset {
  id: string;
  songId: string;
  name: string;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  youtubeReference: string | null;
  youtubeTitle: string | null;
  pdfMetadata: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PresetSheetMusic {
  id: string;
  presetId: string;
  sheetMusicFileId: string;
  sortOrder: number;
}

export interface Conti {
  id: string;
  title: string | null;
  date: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContiSong {
  id: string;
  contiId: string;
  songId: string;
  sortOrder: number;
  keys: string | null;
  tempos: string | null;
  sectionOrder: string | null;
  lyrics: string | null;
  sectionLyricsMap: string | null;
  notes: string | null;
  sheetMusicFileIds: string | null;
  presetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface SongPresetData {
  name: string;
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
}

export interface ContiSongWithSong extends ContiSong {
  song: Song;
  overrides: ContiSongOverrides;
  appliedPreset?: Pick<SongPreset, 'id' | 'name' | 'youtubeReference' | 'youtubeTitle'> | null;
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

export interface ContiPdfExport {
  id: string;
  contiId: string;
  pdfUrl: string | null;
  layoutState: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SongPageImage {
  id: string;
  songId: string;
  contiId: string;
  imageUrl: string;
  pageIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex: number | null;
  presetSnapshot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordThreadState {
  id: string;
  threadId: string;
  sundayDate: string;
  contiId: string | null;
  preacher: string | null;
  leader: string | null;
  worshipLeader: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscordProcessedMessage {
  id: string;
  threadId: string;
  messageId: string;
  parseStatus: string;
  rawContent: string | null;
  processedAt: Date;
}

export interface DiscordInteractionReceipt {
  id: string;
  interactionId: string;
  interactionType: number;
  processedAt: Date;
}

export interface WorshipPrepNotification {
  id: string;
  sundayDate: string;
  type: string;
  status: string;
  threadId: string | null;
  messageId: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
