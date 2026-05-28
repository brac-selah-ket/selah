import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPublicUrl, getObjectKeyFromPublicUrl, requireR2Config } from './config';
import type { ObjectStorage } from './types';

let cachedClient: S3Client | null = null;

export const cloudflareR2Storage: ObjectStorage = {
  async put(key, body, options) {
    const config = requireR2Config();
    const bytes = new Uint8Array(await body.arrayBuffer());

    await getClient().send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: bytes,
      ContentType: options?.contentType,
      IfNoneMatch: options?.allowOverwrite ? undefined : '*',
    }));

    return {
      key,
      url: createPublicUrl(config.publicBaseUrl, key),
      provider: 'cloudflare-r2',
    };
  },

  async delete(urlOrKey) {
    const config = requireR2Config();
    const key = getObjectKeyFromPublicUrl(config.publicBaseUrl, urlOrKey);
    if (!key) return;

    await getClient().send(new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }));
  },
};

function getClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = requireR2Config();

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}
