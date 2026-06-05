'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import type { SheetMusicFile } from '@/lib/types';
import { deleteSheetMusic } from '@/lib/actions/sheet-music';
import { getSheetMusicAssetUrl } from '@/lib/sheet-music-assets';
import { getPdfPageCount, renderPdfPagesToDataUrls } from '@/lib/utils/pdfjs';
import {
  getSheetMusicPreviewKey,
  type SheetMusicPreviewItem,
} from '@/components/shared/sheet-music-preview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface SheetMusicGalleryProps {
  files: SheetMusicFile[];
  editable?: boolean;
  songId?: string;
  onDeleted?: (fileId: string) => void;
  previewMode?: "dialog" | "controlled";
  onPreviewChange?: (item: SheetMusicPreviewItem | null) => void;
}

export function SheetMusicGallery({
  files,
  editable = false,
  onDeleted,
  previewMode = "dialog",
  onPreviewChange,
}: SheetMusicGalleryProps) {
  const [items, setItems] = useState<SheetMusicPreviewItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SheetMusicPreviewItem | null>(null);
  const previewChangeRef = useRef(onPreviewChange);
  const selectedPreviewKeyRef = useRef<string | null>(null);

  // Stable key derived from file IDs to avoid re-running effects on parent re-renders
  const filesKey = useMemo(() => files.map((f) => f.id).join(','), [files]);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  useEffect(() => {
    previewChangeRef.current = onPreviewChange;
  }, [onPreviewChange]);

  const handlePreview = (item: SheetMusicPreviewItem) => {
    if (previewMode === "controlled") {
      selectedPreviewKeyRef.current = getSheetMusicPreviewKey(item);
      setSelectedItem(item);
      previewChangeRef.current?.(item);
      return;
    }

    setSelectedItem(item);
  };

  // Build gallery items and render PDF thumbnails in one pass per PDF
  useEffect(() => {
    let cancelled = false;
    const currentFiles = filesRef.current;

    const syncControlledPreview = (nextItems: SheetMusicPreviewItem[]) => {
      if (previewMode !== "controlled") return;

      const selectedKey = selectedPreviewKeyRef.current;
      const nextSelectedItem = selectedKey
        ? nextItems.find((item) => getSheetMusicPreviewKey(item) === selectedKey)
        : nextItems[0];

      if (!nextSelectedItem) {
        selectedPreviewKeyRef.current = null;
        setSelectedItem(null);
      } else {
        selectedPreviewKeyRef.current = getSheetMusicPreviewKey(nextSelectedItem);
        setSelectedItem(nextSelectedItem);
      }
      previewChangeRef.current?.(nextSelectedItem ?? null);
    };

    async function buildItems() {
      const result: SheetMusicPreviewItem[] = [];

      for (const file of currentFiles) {
        const assetUrl = getSheetMusicAssetUrl(file);
        if (file.fileType.startsWith('image/')) {
          result.push({
            file,
            thumbnailUrl: assetUrl,
            pdfPage: null,
            pdfTotalPages: null,
            previewState: "ready",
          });
        } else if (file.fileType === 'application/pdf') {
          try {
            const pageCount = await getPdfPageCount(assetUrl);
            // Placeholder items so the grid appears immediately
            const startIdx = result.length;
            for (let p = 1; p <= pageCount; p++) {
              result.push({
                file,
                thumbnailUrl: null,
                pdfPage: p,
                pdfTotalPages: pageCount,
                previewState: "loading",
              });
            }
            if (!cancelled) {
              const nextItems = [...result];
              setItems(nextItems);
              syncControlledPreview(nextItems);
            }

            // Render all pages from this PDF in one document open
            const pageNums = Array.from({ length: pageCount }, (_, i) => i + 1);
            const dataUrls = await renderPdfPagesToDataUrls(assetUrl, pageNums, 1);
            if (!cancelled) {
              for (let p = 0; p < dataUrls.length; p++) {
                result[startIdx + p] = {
                  ...result[startIdx + p],
                  thumbnailUrl: dataUrls[p],
                  previewState: "ready",
                };
              }
              const nextItems = [...result];
              setItems(nextItems);
              syncControlledPreview(nextItems);
            }
          } catch (err) {
            console.error('[SheetMusicGallery] Failed to load PDF:', err);
            result.push({
              file,
              thumbnailUrl: null,
              pdfPage: null,
              pdfTotalPages: null,
              previewState: "unavailable",
              previewMessage: "PDF 미리보기를 불러올 수 없습니다.",
            });
          }
        }
      }

      if (!cancelled) {
        setItems(result);
        syncControlledPreview(result);
      }
    }

    buildItems();
    return () => { cancelled = true; };
  }, [filesKey, previewMode]);

  const handleDelete = async (fileId: string) => {
    const result = await deleteSheetMusic(fileId);

    if (result.success) {
      toast('악보가 삭제되었습니다');
      if (previewMode === "controlled" && selectedItem?.file.id === fileId) {
        selectedPreviewKeyRef.current = null;
        setSelectedItem(null);
        previewChangeRef.current?.(null);
      }
      onDeleted?.(fileId);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={getSheetMusicPreviewKey(item)}
            className="relative group"
            onMouseEnter={() => {
              if (previewMode === "controlled") {
                handlePreview(item);
              }
            }}
          >
            <button
              type="button"
              onClick={() => handlePreview(item)}
              onFocus={() => {
                if (previewMode === "controlled") {
                  handlePreview(item);
                }
              }}
              className="block w-full cursor-pointer overflow-hidden rounded-lg border text-left transition-colors hover:border-primary/50 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.pdfPage ? `${item.file.fileName} - ${item.pdfPage}페이지` : item.file.fileName}
                  className="w-full aspect-auto object-cover"
                />
              ) : (
                <div className="aspect-[1/1.414] flex items-center justify-center bg-muted animate-pulse">
                  <span className="text-sm text-muted-foreground">로딩 중...</span>
                </div>
              )}
              {item.pdfPage !== null && item.pdfTotalPages !== null && item.pdfTotalPages > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded">
                  {item.pdfPage}/{item.pdfTotalPages}
                </div>
              )}
            </button>

            {editable && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>악보 삭제</AlertDialogTitle>
                    <AlertDialogDescription>
                      {item.pdfTotalPages && item.pdfTotalPages > 1
                        ? `이 PDF 파일(${item.pdfTotalPages}페이지)을 삭제하시겠습니까?`
                        : '이 악보를 삭제하시겠습니까?'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(item.file.id)}>
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>

      {previewMode === "dialog" && (
        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>
                {selectedItem?.file.fileName}
                {selectedItem?.pdfPage != null && ` - ${selectedItem.pdfPage}페이지`}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-6">
              {selectedItem && selectedItem.thumbnailUrl && (
                <img
                  src={selectedItem.thumbnailUrl}
                  alt={selectedItem.file.fileName}
                  className="mx-auto max-h-[80vh] w-auto"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
