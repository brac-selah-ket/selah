import { getStorageProviderName } from './config';
import { cloudflareR2Storage } from './cloudflare-r2';
import type { ObjectStorage, PutObjectOptions, StoredObject } from './types';
import { vercelBlobStorage } from './vercel-blob';

export async function putObject(
  key: string,
  body: Blob,
  options?: PutObjectOptions,
): Promise<StoredObject> {
  return getObjectStorage().put(key, body, options);
}

export async function deleteObject(urlOrKey: string): Promise<void> {
  return getObjectStorage().delete(urlOrKey);
}

export function getObjectStorage(): ObjectStorage {
  const provider = getStorageProviderName();

  if (provider === 'vercel-blob') {
    return vercelBlobStorage;
  }

  return cloudflareR2Storage;
}
