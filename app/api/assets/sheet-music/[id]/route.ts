import { NextRequest, NextResponse } from 'next/server';
import { getStoryboardRepository } from '@/lib/repositories/storyboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = await getStoryboardRepository().getSheetMusicFile(id);

  if (!file) {
    return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
  }

  const range = request.headers.get('range');
  const upstream = await fetch(file.fileUrl, {
    cache: 'no-store',
    headers: range ? { Range: range } : undefined,
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { success: false, message: 'Stored file could not be loaded' },
      { status: upstream.status },
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', file.fileType || upstream.headers.get('content-type') || 'application/octet-stream');
  headers.set('Content-Disposition', contentDisposition(
    request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline',
    file.fileName,
  ));
  headers.set('Cache-Control', 'private, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');

  copyHeader(upstream.headers, headers, 'accept-ranges');
  copyHeader(upstream.headers, headers, 'content-length');
  copyHeader(upstream.headers, headers, 'content-range');
  copyHeader(upstream.headers, headers, 'etag');
  copyHeader(upstream.headers, headers, 'last-modified');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

function copyHeader(source: Headers, target: Headers, name: string) {
  const value = source.get(name);
  if (value) {
    target.set(name, value);
  }
}

function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'sheet-music';
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
