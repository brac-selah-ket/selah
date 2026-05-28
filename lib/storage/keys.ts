import { generateId } from '@/lib/id';

export function createUploadObjectKey(prefix: string, fileName: string): string {
  return `${trimSlashes(prefix)}/${generateId()}-${sanitizeFileName(fileName)}`;
}

export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() || 'file';
  const safeName = baseName
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[?#]/g, '-')
    .slice(0, 180)
    .trim();

  return safeName || 'file';
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}
