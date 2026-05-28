import { del, put } from '@vercel/blob';
import type { ObjectStorage } from './types';

export const vercelBlobStorage: ObjectStorage = {
  async put(key, body, options) {
    const blob = await put(key, body, {
      access: 'public',
      allowOverwrite: options?.allowOverwrite,
      contentType: options?.contentType,
    });

    return {
      key: blob.pathname,
      url: blob.url,
      provider: 'vercel-blob',
    };
  },

  async delete(urlOrKey) {
    if (!urlOrKey) return;
    await del(urlOrKey);
  },
};
