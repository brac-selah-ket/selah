import { neonStoryboardRepository } from './neon-repository';
import { tursoStoryboardRepository } from './turso-repository';

export function getStoryboardRepository() {
  const provider = process.env.DATABASE_PROVIDER ?? 'neon';

  if (provider === 'neon') {
    return neonStoryboardRepository;
  }

  if (provider === 'turso') {
    return tursoStoryboardRepository;
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${provider}`);
}
