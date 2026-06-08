import { cacheLife, cacheTag } from 'next/cache';
import { cacheTags } from '@/lib/cache/tags';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export async function getContis() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis());
  return getStoryboardRepository().getContis();
}

export async function getContisWithSongSummaries() {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis());
  return getStoryboardRepository().getContisWithSongSummaries();
}

export async function getContiByDate(date: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis(), cacheTags.contiByDate(date));
  return getStoryboardRepository().getContiByDate(date);
}

export async function getConti(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis(), cacheTags.conti(id));
  return getStoryboardRepository().getConti(id);
}

export async function getContiForExport(id: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.contis(), cacheTags.conti(id));
  return getStoryboardRepository().getContiForExport(id);
}

export async function getContiPdfExport(contiId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(cacheTags.conti(contiId));
  return getStoryboardRepository().getContiPdfExport(contiId);
}
