import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache/tags';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getSongs() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songs());
  return getStoryboardRepository().getSongs();
}

export async function getSong(id: string) {
  return getStoryboardRepository().getSong(id);
}

export async function getSongPresets(songId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songPresets(songId));
  return getStoryboardRepository().getSongPresets(songId);
}

export async function searchSongs(query: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.songs());
  return getStoryboardRepository().searchSongs(query);
}

export async function getSongPresetsWithSheetMusic(songId: string) {
  return getStoryboardRepository().getSongPresetsWithSheetMusic(songId);
}
