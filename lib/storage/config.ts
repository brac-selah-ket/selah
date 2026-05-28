import type { StorageProviderName } from './types';

type StorageEnv = Partial<Record<string, string | undefined>>;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
}

export function getStorageProviderName(env: StorageEnv = process.env): StorageProviderName {
  const provider = env.STORAGE_PROVIDER?.trim().toLowerCase() || 'vercel-blob';

  if (provider === 'vercel-blob' || provider === 'blob') {
    return 'vercel-blob';
  }

  if (provider === 'cloudflare-r2' || provider === 'r2') {
    return 'cloudflare-r2';
  }

  throw new Error(`Unsupported STORAGE_PROVIDER: ${env.STORAGE_PROVIDER}`);
}

export function requireR2Config(env: StorageEnv = process.env): R2Config {
  return {
    accountId: requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID'),
    accessKeyId: requireEnv(env, 'R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv(env, 'R2_SECRET_ACCESS_KEY'),
    bucketName: requireEnv(env, 'R2_BUCKET_NAME'),
    publicBaseUrl: requireEnv(env, 'R2_PUBLIC_BASE_URL').replace(/\/+$/, ''),
  };
}

export function createPublicUrl(baseUrl: string, key: string): string {
  const normalizedBase = `${baseUrl.replace(/\/+$/, '')}/`;
  return new URL(encodeObjectKey(key), normalizedBase).toString();
}

export function getObjectKeyFromPublicUrl(baseUrl: string, urlOrKey: string): string | null {
  if (!urlOrKey) return null;
  if (!isHttpUrl(urlOrKey)) return trimLeadingSlashes(urlOrKey);

  let target: URL;
  let base: URL;

  try {
    target = new URL(urlOrKey);
    base = new URL(`${baseUrl.replace(/\/+$/, '')}/`);
  } catch {
    return null;
  }

  if (target.origin !== base.origin) {
    return null;
  }

  const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
  if (!target.pathname.startsWith(basePath)) {
    return null;
  }

  try {
    return decodeURIComponent(target.pathname.slice(basePath.length));
  } catch {
    return null;
  }
}

function requireEnv(env: StorageEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required when STORAGE_PROVIDER=cloudflare-r2`);
  }
  return value;
}

function encodeObjectKey(key: string): string {
  return trimLeadingSlashes(key)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function trimLeadingSlashes(value: string): string {
  return value.replace(/^\/+/, '');
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}
