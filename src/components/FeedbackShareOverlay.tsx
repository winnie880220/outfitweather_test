import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Download, Loader2 } from "lucide-react";
import { FeedbackShareCard } from "./FeedbackShareCard";
import type { FeedbackOutfitContext } from "./FeedbackOutfitCard";
import type { OutfitAnalysis } from "../lib/api";
import { fetchFeedbackFeelSummary } from "../lib/api/feedback-feel-summary";
import {
  downloadShareCardElement,
  type FeedbackShareFeelMetrics,
} from "../lib/feedback-share-image";

export type FeedbackShareSnapshot = {
  context: FeedbackOutfitContext;
  analysis: OutfitAnalysis | null;
  metrics: FeedbackShareFeelMetrics;
  dateLabel: string;
  summary: string;
  note: string;
  /** 下載用 data URL，避免 iOS 清除 blob 後匯出空白 */
  photoDataUrl?: string;
  photoFallbackUrl?: string;
};

export function formatShareDateLabel(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/** 預覽區額外縮小，避免遮住底部按鈕（含 Safari 工具列） */
const SHARE_PREVIEW_SCALE_FACTOR = 0.9;

export function FeedbackShareOverlay({
  open,
  snapshot,
  onDismiss,
  onDownloadSuccess,
  onDownloadError,
}: {
  open: boolean;
  snapshot: FeedbackShareSnapshot | null;
  onDismiss: () => void;
  onDownloadSuccess?: (msg: string) => void;
  onDownloadError?: (msg: string) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiConclusion, setAiConclusion] = useState<string | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);
  const previewScalerRef = useRef<HTMLDivElement>(null);
  const aiRequestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    console.log("[FeedbackShareOverlay] OPEN — snapshot:", snapshot != null);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !snapshot) {
      setAiLoading(false);
      setAiScore(null);
      setAiConclusion(null);
      return;
    }

    const requestId = ++aiRequestRef.current;
    setAiLoading(true);
    setAiScore(null);
    setAiConclusion(null);

    void fetchFeedbackFeelSummary({
      breathability: snapshot.metrics.breathability,
      wrapping: snapshot.metrics.snugness,
      stuffiness: snapshot.metrics.stuffiness,
      upperBodyTags: snapshot.analysis?.upperBodyTags,
      lowerBodyTags: snapshot.analysis?.lowerBodyTags,
      temp: snapshot.context.temp,
      condition: snapshot.context.condition,
      locationName: snapshot.context.locationName,
      userNote: snapshot.note.trim() || undefined,
    })
      .then((result) => {
        if (aiRequestRef.current !== requestId) return;
        setAiScore(result.score);
        setAiConclusion(result.conclusion);
      })
      .catch(() => {
        if (aiRequestRef.current !== requestId) return;
        setAiScore(null);
        setAiConclusion(null);
      })
      .finally(() => {
        if (aiRequestRef.current !== requestId) return;
        setAiLoading(false);
      });
  }, [open, snapshot]);

  useEffect(() => {
    if (!open || !snapshot) return;
    const area = previewAreaRef.current;
    const scaler = previewScalerRef.current;
    if (!area || !scaler) return;

    const syncScale = () => {
      const card = scaler.firstElementChild as HTMLElement | null;
      if (!card) return;
      scaler.style.transform = "";
      scaler.style.height = "";
      scaler.style.marginBottom = "";
      const availableW = area.clientWidth;
      const availableH = area.clientHeight;
      const naturalW = card.offsetWidth;
      const naturalH = card.offsetHeight;
      if (!availableW || !availableH || !naturalW || !naturalH) return;
      const fit = Math.min(1, availableW / naturalW, availableH / naturalH);
      const scale = fit * SHARE_PREVIEW_SCALE_FACTOR;
      if (scale < 0.999) {
        scaler.style.transform = `scale(${scale})`;
        scaler.style.transformOrigin = "top center";
        scaler.style.height = `${naturalH * scale}px`;
        scaler.style.marginBottom = "0";
      }
    };

    syncScale();
    const ro = new ResizeObserver(syncScale);
    ro.observe(area);
    ro.observe(scaler);
    const t1 = window.setTimeout(syncScale, 60);
    const t2 = window.setTimeout(syncScale, 280);
  }, [open, snapshot, aiLoading, aiConclusion]);

  const handleDownload = useCallback(async () => {
    if (!snapshot || downloading || !cardRef.current) return;
    const photoUrl =
      snapshot.photoDataUrl ??
      snapshot.photoFallbackUrl ??
      snapshot.context.photoUrl;
    setDownloading(true);
    try {
      await downloadShareCardElement(cardRef.current, photoUrl);
      onDownloadSuccess?.("穿搭卡片已儲存");
    } catch (err) {
      onDownloadError?.(
        err instanceof Error ? err.message : "無法儲存，請再試一次"
      );
    } finally {
      setDownloading(false);
    }
  }, [snapshot, downloading, onDownloadSuccess, onDownloadError]);

  return createPortal(
    <AnimatePresence>
      {open && snapshot ? (
        <motion.div
          className="feedback-share-overlay fixed inset-0 z-[80] flex flex-col overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="presentation"
        >
          <motion.div
            className="feedback-share-overlay__backdrop absolute inset-0 bg-stone-900/78 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
            onClick={onDismiss}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-share-overlay-title"
            initial={{ opacity: 0, y: 48, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="feedback-share-overlay__sheet relative z-[1] mx-auto w-full max-w-lg px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="feedback-share-overlay__header shrink-0 text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.22 }}
            >
              <h2
                id="feedback-share-overlay-title"
                className="font-sans not-italic font-semibold text-white"
              >
                體感已記錄！
              </h2>
              <p className="mt-2 max-w-full px-1 text-sm leading-relaxed text-stone-300">
                這是今天的穿搭體感卡片，可選擇下載保存
              </p>
            </motion.div>

            <motion.div
              ref={previewAreaRef}
              className="feedback-share-overlay__preview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.25 }}
            >
              <div
                ref={previewScalerRef}
                className="feedback-share-overlay__preview-scaler"
              >
                <FeedbackShareCard
                  ref={cardRef}
                  context={snapshot.context}
                  analysis={snapshot.analysis}
                  metrics={snapshot.metrics}
                  dateLabel={snapshot.dateLabel}
                  summary={snapshot.summary}
                  note={snapshot.note}
                  aiConclusion={aiConclusion}
                  aiLoading={aiLoading}
                  photoFallbackUrl={
                    snapshot.photoDataUrl ??
                    snapshot.photoFallbackUrl ??
                    snapshot.context.photoUrl
                  }
                  animated
                />
              </div>
            </motion.div>

            <footer className="feedback-share-overlay__footer">
              <motion.div
                className="feedback-share-overlay__actions-bar"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.2 }}
              >
                <motion.button
                  type="button"
                  onClick={handleDownload}
                  disabled={
                    downloading ||
                    !(
                      snapshot.photoDataUrl ??
                      snapshot.photoFallbackUrl ??
                      snapshot.context.photoUrl
                    )
                  }
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.2 }}
                  className="feedback-share-overlay__download"
                >
                  {downloading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} strokeWidth={2.25} />
                  )}
                  <span>下載今日穿搭卡片</span>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={onDismiss}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.52, duration: 0.2 }}
                  className="feedback-share-overlay__done"
                >
                  完成
                </motion.button>
              </motion.div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
