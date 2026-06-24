import { tursoStoryboardRepository } from './turso-repository';
import type { StoryboardRepository } from './types';

export function getStoryboardRepository(): StoryboardRepository {
  return tursoStoryboardRepository;
}
