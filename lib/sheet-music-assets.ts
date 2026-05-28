import type { SheetMusicFile } from './types';

type SheetMusicAsset = Pick<SheetMusicFile, 'id'> | string;

export function getSheetMusicAssetUrl(file: SheetMusicAsset): string {
  const id = typeof file === 'string' ? file : file.id;
  return `/api/assets/sheet-music/${encodeURIComponent(id)}`;
}

export function getSheetMusicDownloadUrl(file: SheetMusicAsset): string {
  return `${getSheetMusicAssetUrl(file)}?download=1`;
}
