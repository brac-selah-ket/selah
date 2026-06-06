"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { previewScriptureReference } from '@/lib/actions/scripture';
import type { ScripturePreviewResult } from '@/lib/scripture/preview';

interface ScripturePreviewDialogProps {
  open: boolean;
  scriptureReference: string | null;
  onOpenChange: (open: boolean) => void;
}

type PreviewStatus = 'idle' | 'loading' | 'success' | 'error';

const scripturePreviewCache = new Map<string, ScripturePreviewResult>();

function normalizeScriptureCacheKey(scriptureReference: string): string {
  return scriptureReference.trim().replace(/\s+/g, ' ');
}

export function ScripturePreviewDialog({
  open,
  scriptureReference,
  onOpenChange,
}: ScripturePreviewDialogProps) {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [preview, setPreview] = useState<ScripturePreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const normalizedReference = normalizeScriptureCacheKey(scriptureReference ?? '');

  const loadPreview = useCallback(
    async ({ bypassCache = false }: { bypassCache?: boolean } = {}) => {
      const cacheKey = normalizeScriptureCacheKey(scriptureReference ?? '');

      if (!cacheKey) {
        requestIdRef.current += 1;
        setPreview(null);
        setError('말씀 본문을 입력해 주세요');
        setStatus('error');
        return;
      }

      if (!bypassCache) {
        const cachedPreview = scripturePreviewCache.get(cacheKey);
        if (cachedPreview) {
          requestIdRef.current += 1;
          setPreview(cachedPreview);
          setError(null);
          setStatus('success');
          return;
        }
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setPreview(null);
      setError(null);
      setStatus('loading');

      const result = await previewScriptureReference(cacheKey);

      if (requestIdRef.current !== requestId) return;

      if (result.success && result.data) {
        scripturePreviewCache.set(cacheKey, result.data);
        scripturePreviewCache.set(normalizeScriptureCacheKey(result.data.reference), result.data);
        setPreview(result.data);
        setError(null);
        setStatus('success');
        return;
      }

      setPreview(null);
      setError(result.error ?? '말씀 본문 미리보기를 불러오지 못했습니다.');
      setStatus('error');
    },
    [scriptureReference],
  );

  useEffect(() => {
    if (!open) return;

    async function run() {
      await loadPreview();
    }

    void run();
  }, [loadPreview, open]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      requestIdRef.current += 1;
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size='lg' className='max-h-[85vh] grid-rows-[auto_1fr_auto]'>
        <DialogHeader>
          <DialogTitle>말씀 본문 미리보기</DialogTitle>
          <DialogDescription>{preview?.reference ?? normalizedReference}</DialogDescription>
        </DialogHeader>

        <div className='min-h-48 overflow-y-auto pr-1' aria-live='polite'>
          {status === 'loading' && (
            <div className='flex min-h-48 items-center justify-center text-sm text-muted-foreground'>
              <HugeiconsIcon
                icon={Loading03Icon}
                strokeWidth={2}
                className='mr-2 size-5 animate-spin'
              />
              본문을 불러오는 중입니다
            </div>
          )}

          {status === 'error' && error && (
            <div
              role='alert'
              className='rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive'
            >
              {error}
            </div>
          )}

          {status === 'success' && preview && (
            <div className='space-y-3'>
              {preview.verses.map((verse) => (
                <div key={verse.label} className='rounded-lg border bg-card p-3'>
                  <p className='mb-1 text-xs font-medium text-muted-foreground'>{verse.label}</p>
                  <p className='whitespace-pre-wrap text-sm leading-6 text-foreground'>
                    {verse.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => void loadPreview({ bypassCache: true })}
            disabled={status === 'loading' || !normalizedReference}
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon='inline-start' />
            다시 불러오기
          </Button>
          <Button type='button' variant='secondary' onClick={() => handleOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
