import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getContis() {
  return getStoryboardRepository().getContis();
}

export async function getContisWithSongSummaries() {
  return getStoryboardRepository().getContisWithSongSummaries();
}

export async function getContiByDate(date: string) {
  return getStoryboardRepository().getContiByDate(date);
}

export async function getConti(id: string) {
  return getStoryboardRepository().getConti(id);
}

export async function getContiForExport(id: string) {
  return getStoryboardRepository().getContiForExport(id);
}

export async function getContiPdfExport(contiId: string) {
  return getStoryboardRepository().getContiPdfExport(contiId);
}
