export interface SnapshotSong {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSheetMusicFile {
  id: string;
  songId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  sortOrder: number;
  createdAt: string;
}

export interface SnapshotSongPreset {
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
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotPresetSheetMusic {
  id: string;
  presetId: string;
  sheetMusicFileId: string;
  sortOrder: number;
}

export interface SnapshotConti {
  id: string;
  title: string | null;
  date: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiSong {
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
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotContiPdfExport {
  id: string;
  contiId: string;
  pdfUrl: string | null;
  layoutState: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSongPageImage {
  id: string;
  songId: string;
  contiId: string;
  imageUrl: string;
  pageIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex: number | null;
  presetSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardSnapshot {
  songs: SnapshotSong[];
  sheetMusicFiles: SnapshotSheetMusicFile[];
  songPresets: SnapshotSongPreset[];
  presetSheetMusic: SnapshotPresetSheetMusic[];
  contis: SnapshotConti[];
  contiSongs: SnapshotContiSong[];
  contiPdfExports: SnapshotContiPdfExport[];
  songPageImages: SnapshotSongPageImage[];
}

export type SnapshotCollectionName = keyof StoryboardSnapshot;

export type SnapshotCounts = {
  [CollectionName in SnapshotCollectionName]: {
    neon: number;
    turso: number;
  };
};

export interface VerificationResult {
  ok: boolean;
  counts: SnapshotCounts;
  errors: string[];
}
