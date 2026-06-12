import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { saveContiPdfLayout } from "@/lib/actions/conti-pdf-exports";
import { syncPresetPdfMetadataFromContiLayout } from "@/lib/actions/conti-songs";
import type { PdfLayoutState } from "@/lib/types";
import type { EditorPage } from "../types";

export function useAutoSave(
  pages: EditorPage[],
  contiId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildLayoutStateRef = useRef<() => PdfLayoutState>(() => ({
    pages: [],
    canvasWidth: 800,
    canvasHeight: 1131,
  }));
  const saveLatestRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const activeSavePromiseRef = useRef<Promise<boolean> | null>(null);
  const pendingSaveRef = useRef(false);
  const [presetSyncing, setPresetSyncing] = useState(false);

  const buildLayoutState = useCallback((): PdfLayoutState => {
    return {
      pages: pages.map((p, i) => ({
        pageIndex: i,
        songIndex: p.songIndex,
        sheetMusicFileId: p.sheetMusicFileId,
        pdfPageIndex: p.pdfPageIndex,
        overlays: p.overlays,
        imageScale: p.imageScale !== 1 ? p.imageScale : undefined,
        imageOffsetX: p.imageOffsetX !== 0 ? p.imageOffsetX : undefined,
        imageOffsetY: p.imageOffsetY !== 0 ? p.imageOffsetY : undefined,
        cropX: p.cropX ?? undefined,
        cropY: p.cropY ?? undefined,
        cropWidth: p.cropWidth ?? undefined,
        cropHeight: p.cropHeight ?? undefined,
        originalImageUrl:
          p.originalImageUrl && !p.originalImageUrl.startsWith("data:")
            ? p.originalImageUrl
            : undefined,
      })),
      canvasWidth: containerRef.current?.clientWidth ?? 800,
      canvasHeight: containerRef.current?.clientHeight ?? 1131,
    };
  }, [pages, containerRef]);

  useEffect(() => {
    buildLayoutStateRef.current = buildLayoutState;
  }, [buildLayoutState]);

  const persistLayout = useCallback(
    async (layoutState: PdfLayoutState): Promise<boolean> => {
      setSaveStatus("saving");
      const result = await saveContiPdfLayout(
        contiId,
        JSON.stringify(layoutState),
      );
      if (result.success) {
        setSaveStatus("saved");
        return true;
      }

      setSaveStatus("unsaved");
      toast.error(result.error ?? "저장 중 오류가 발생했습니다");
      return false;
    },
    [contiId],
  );

  const saveLatest = useCallback((): Promise<boolean> => {
    if (activeSavePromiseRef.current) {
      pendingSaveRef.current = true;
      setSaveStatus("unsaved");
      return activeSavePromiseRef.current;
    }

    const savePromise = (async () => {
      let allSaved = true;
      try {
        do {
          pendingSaveRef.current = false;
          const saved = await persistLayout(buildLayoutStateRef.current());
          allSaved = allSaved && saved;
          if (!saved) {
            pendingSaveRef.current = false;
          }
        } while (pendingSaveRef.current);

        return allSaved;
      } finally {
        activeSavePromiseRef.current = null;
      }
    })();

    activeSavePromiseRef.current = savePromise;
    return savePromise;
  }, [persistLayout]);

  useEffect(() => {
    saveLatestRef.current = async () => {
      await saveLatest();
    };
  }, [saveLatest]);

  const performSave = useCallback(async () => {
    await saveLatest();
  }, [saveLatest]);

  const triggerAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveLatestRef.current();
    }, 3000);
  }, []);

  async function handleManualSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const saved = await saveLatest();
    if (!saved) return;

    toast.success("레이아웃이 저장되었습니다");
  }

  async function handlePresetSyncSave() {
    const layoutState = buildLayoutState();
    setPresetSyncing(true);

    try {
      const layoutStateText = JSON.stringify(layoutState);
      const syncResult = await syncPresetPdfMetadataFromContiLayout(
        contiId,
        layoutStateText,
      );

      if (!syncResult.success) {
        toast.warning(syncResult.error ?? "프리셋 동기화 중 오류가 발생했습니다");
        return;
      }

      const updatedPresetCount = syncResult.data?.updatedPresetCount ?? 0;
      if (updatedPresetCount > 0) {
        toast.success(`프리셋 ${updatedPresetCount}개가 업데이트되었습니다`);
        return;
      }

      toast.info("연결된 프리셋이 없어 업데이트할 항목이 없습니다");
    } finally {
      setPresetSyncing(false);
    }
  }

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === "unsaved") {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  return {
    saveStatus,
    triggerAutoSave,
    performSave,
    handleManualSave,
    handlePresetSyncSave,
    presetSyncing,
  };
}
