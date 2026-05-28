import { neonStoryboardRepository } from './neon-repository';
import { getStoryboardDatabaseProviderName } from './provider';
import { tursoStoryboardRepository } from './turso-repository';
import type { StoryboardRepository } from './types';

export function getStoryboardRepository(): StoryboardRepository {
  const provider = getStoryboardDatabaseProviderName();

  if (provider === 'neon') {
    return neonStoryboardRepository;
  }

  if (provider === 'turso') {
    return tursoStoryboardRepository;
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
}
