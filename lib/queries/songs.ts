import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getSongs() {
  return getStoryboardRepository().getSongs();
}

export async function getSong(id: string) {
  return getStoryboardRepository().getSong(id);
}

export async function getSongPresets(songId: string) {
  return getStoryboardRepository().getSongPresets(songId);
}

export async function searchSongs(query: string) {
  return getStoryboardRepository().searchSongs(query);
}

export async function getSongPresetsWithSheetMusic(songId: string) {
  return getStoryboardRepository().getSongPresetsWithSheetMusic(songId);
}
