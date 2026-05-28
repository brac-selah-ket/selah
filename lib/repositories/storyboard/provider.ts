export type DatabaseProviderName = 'neon' | 'turso';

type DatabaseEnv = Partial<Record<string, string | undefined>>;

export function getStoryboardDatabaseProviderName(env: DatabaseEnv = process.env): DatabaseProviderName {
  const provider = env.DATABASE_PROVIDER?.trim().toLowerCase() || 'neon';

  if (provider === 'neon') {
    return 'neon';
  }

  if (provider === 'turso') {
    return 'turso';
  }

  throw new Error(`Unsupported DATABASE_PROVIDER: ${env.DATABASE_PROVIDER}`);
}
