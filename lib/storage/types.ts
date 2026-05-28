export type StorageProviderName = 'vercel-blob' | 'cloudflare-r2';

export interface PutObjectOptions {
  contentType?: string;
  allowOverwrite?: boolean;
}

export interface StoredObject {
  key: string;
  url: string;
  provider: StorageProviderName;
}

export interface ObjectStorage {
  put(key: string, body: Blob, options?: PutObjectOptions): Promise<StoredObject>;
  delete(urlOrKey: string): Promise<void>;
}
