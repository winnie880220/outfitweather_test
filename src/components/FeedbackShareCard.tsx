import { motion } from "motion/react";
import { forwardRef, useEffect, useMemo, useRef } from "react";
import { dominantOutfitColor } from "../../lib/outfit-colors";
import { OutfitPhotoTagOverlay } from "./OutfitPhotoTagOverlay";
import { OutfitColorChip } from "./OutfitColorChip";
import type { FeedbackOutfitContext } from "./FeedbackOutfitCard";
import type { OutfitAnalysis } from "../lib/api";
import { feelMetricChips } from "../lib/feel-metrics";
import type { FeedbackShareFeelMetrics } from "../lib/feedback-share-image";

function formatLocation(name?: string): string | null {
  if (!name?.trim()) return null;
  const parts = name.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  return parts[0] || name;
}

function contextBadgeText(context: FeedbackOutfitContext): string | null {
  const location = formatLocation(context.locationName);
  const weatherLabel =
    context.temp !== undefined
      ? `${Math.round(context.temp)}°C${context.condition ? ` ${context.condition}` : ""}`
      : context.condition || null;

  const parts = [
    context.recordedTime ? `${context.recordedTime} 拍攝` : null,
    location,
    weatherLabel,
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : null;
}

function brandLabel(): string {
  const now = new Date();
  return `衣氣象 · ${now.getMonth() + 1}/${now.getDate()}`;
}

const popIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 420, damping: 28 },
  },
};

type FeedbackShareCardProps = {
  context: FeedbackOutfitContext;
  analysis: OutfitAnalysis | null;
  metrics: FeedbackShareFeelMetrics;
  dateLabel: string;
  summary: string;
  note: string;
  aiConclusion?: string | null;
  aiLoading?: boolean;
  photoFallbackUrl?: string;
  className?: string;
  animated?: boolean;
};

export const FeedbackShareCard = forwardRef<HTMLElement, FeedbackShareCardProps>(
  function FeedbackShareCard(
    {
      context,
      analysis,
      metrics,
      dateLabel,
      summary,
      note,
      aiConclusion,
      aiLoading = false,
      photoFallbackUrl,
      className = "",
      animated = true,
    },
    ref
  ) {
    const badgeText = useMemo(() => contextBadgeText(context), [context]);
    const photoSrc = context.photoUrl ?? photoFallbackUrl;
    const photoBgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const el = photoBgRef.current;
      if (!el) return;
      if (photoSrc) {
        el.style.backgroundImage = `url("${photoSrc}")`;
      } else {
        el.style.removeProperty("background-image");
      }
    }, [photoSrc]);
    const feelInline = useMemo(
      () =>
        feelMetricChips({
          breathability: metrics.breathability,
          wrapping: metrics.snugness,
          stuffiness: metrics.stuffiness,
        })
          .map((c) => `${c.label} ${c.value}%`)
          .join(" · "),
      [metrics]
    );

    const dominantColor = useMemo(
      () => dominantOutfitColor(analysis?.colors),
      [analysis?.colors]
    );

    const showTags =
      analysis &&
      (analysis.upperBodyTags.length > 0 ||
        analysis.lowerBodyTags.length > 0 ||
        analysis.colors.length > 0);

    const MotionWrap = animated ? motion.section : "section";
    const MotionBlock = animated ? motion.div : "div";
    const motionProps = animated
      ? {
          initial: { opacity: 0, y: 10, scale: 0.98 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { type: "spring", stiffness: 340, damping: 26, delay: 0.05 },
        }
      : {};

    const textBody =
      aiLoading ? (
        <p className="style-note-card__ai-loading">AI 評分中…</p>
      ) : aiConclusion ? (
        <p className="style-note-card__ai-conclusion">{aiConclusion}</p>
      ) : (
        <p className="style-note-card__summary">{summary}</p>
      );

    return (
      <MotionWrap
        ref={ref}
        {...motionProps}
        className={`style-note-card style-note-card--export-9x16 ${className}`}
        aria-label="體感分享卡片"
        data-feedback-share-card
        data-share-aspect="9:16"
      >
        <div className="style-note-card__spiral" aria-hidden />

        <header className="style-note-card__header">
          <h2 className="style-note-card__welcome-title">Outfit Weather</h2>
          <p className="style-note-card__welcome-date">{dateLabel}</p>
          {badgeText ? <p className="style-note-card__meta">{badgeText}</p> : null}
        </header>

        <div className="style-note-card__body-stack">
          <MotionBlock
            {...(animated ? { variants: popIn, initial: "hidden", animate: "show" } : {})}
            className="style-note-card__stage"
          >
            <div className="style-note-card__polaroid-wrap">
              <div className="style-note-card__polaroid">
                <div className="style-note-card__polaroid-photo">
                {photoSrc ? (
                  <>
                    <div
                      ref={photoBgRef}
                      className="style-note-card__export-photo-bg"
                      role="img"
                      aria-label="穿搭"
                    />
                    <img
                      src={photoSrc}
                      alt=""
                      aria-hidden
                      className="style-note-card__export-photo-helper"
                      decoding="sync"
                    />
                  </>
                ) : (
                  <div className="flex h-full min-h-[80px] items-center justify-center text-4xl">
                    🧥
                  </div>
                )}
                {showTags ? (
                  <OutfitPhotoTagOverlay
                    upperBodyTags={analysis.upperBodyTags}
                    lowerBodyTags={analysis.lowerBodyTags}
                    tagAnchors={analysis.tagAnchors}
                    compactTags
                  />
                ) : null}
                {dominantColor ? (
                  <div
                    className="style-note-card__photo-color-tag"
                    aria-label={`代表色 ${dominantColor}`}
                  >
                    <OutfitColorChip name={dominantColor} variant="on-photo" />
                  </div>
                ) : null}
                </div>
              </div>
            </div>
          </MotionBlock>

          <div className="style-note-card__copy">
            <p className="style-note-card__feel-inline">{feelInline}</p>
            {textBody}
            {note.trim() ? (
              <p className="style-note-card__note-small">「{note.trim()}」</p>
            ) : null}
            <p className="style-note-card__brand">{brandLabel()}</p>
          </div>
        </div>
      </MotionWrap>
    );
  }
);
