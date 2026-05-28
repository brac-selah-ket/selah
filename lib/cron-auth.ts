import type { NextRequest } from 'next/server';

type CronEnv = Record<string, string | undefined>;

export function getCronSecret(env: CronEnv = process.env): string | undefined {
  const primary = env.CRON_SECRET?.trim();
  if (primary) return primary;

  const fallback = env.DISCORD_CRON_SECRET?.trim();
  return fallback || undefined;
}

export function isBearerSecretAuthorized(
  authHeader: string | null,
  secret: string | null | undefined,
): boolean {
  const normalizedSecret = secret?.trim();
  return Boolean(normalizedSecret && authHeader === `Bearer ${normalizedSecret}`);
}

export function isCronAuthorized(
  request: Pick<NextRequest, 'headers'>,
  env: CronEnv = process.env,
): boolean {
  return isBearerSecretAuthorized(request.headers.get('authorization'), getCronSecret(env));
}
