import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import {
  buildOutfitTagPlacements,
  type OutfitTagPlacement,
} from "../lib/outfit-tag-layout";

export function OutfitPhotoTagOverlay({
  upperBodyTags,
  lowerBodyTags,
  tagAnchors,
  loading = false,
  compactTags = false,
  exportStatic = false,
  className = "",
}: {
  upperBodyTags: string[];
  lowerBodyTags: string[];
  tagAnchors?: Array<{ label: string; anchorX: number; anchorY: number }>;
  loading?: boolean;
  compactTags?: boolean;
  /** 分享卡匯出：靜態標籤，避免 html-to-image 漏繪 motion 動畫 */
  exportStatic?: boolean;
  className?: string;
}) {
  const placements = buildOutfitTagPlacements(
    upperBodyTags,
    lowerBodyTags,
    tagAnchors
  );
  const showTags = !loading && placements.length > 0;

  if (exportStatic) {
    return (
      <div
        className={`outfit-tag-overlay pointer-events-none absolute inset-0 overflow-hidden ${className}`}
        aria-live="polite"
      >
        {showTags ? (
          <>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {placements.map((p, i) => (
                <line
                  key={`line-${p.label}-${i}`}
                  x1={p.labelX}
                  y1={p.labelY}
                  x2={p.anchorX}
                  y2={p.anchorY}
                  stroke="rgba(120, 113, 108, 0.55)"
                  strokeWidth={0.28}
                  strokeLinecap="round"
                />
              ))}
            </svg>
            {placements.map((p, i) => (
              <StaticTagLabel
                key={`${p.label}-${i}`}
                placement={p}
                compact={compactTags}
              />
            ))}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      className={`outfit-tag-overlay pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-live="polite"
      aria-busy={loading}
    >
      <AnimatePresence>
        {loading ? (
          <motion.div
            key="scan"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="outfit-tag-scan-panel absolute inset-0 flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ opacity: [0.65, 1, 0.65] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="outfit-tag-scan-icon mb-2.5 flex h-11 w-11 items-center justify-center rounded-full"
            >
              <Sparkles size={18} className="text-[#8b7355]" strokeWidth={2} />
            </motion.div>
            <p className="text-xs font-medium tracking-wide text-stone-600">
              AI 分析穿搭中…
            </p>
            <motion.div
              className="outfit-tag-scan-line absolute inset-x-6 top-0 h-px"
              animate={{ top: ["14%", "86%", "14%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showTags ? (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {placements.map((p, i) => (
            <TagConnector key={`line-${p.label}-${i}`} placement={p} delay={i * 0.08} />
          ))}
        </svg>
      ) : null}

      <AnimatePresence>
        {showTags
          ? placements.map((p, i) => (
              <TagLabel
                key={`${p.label}-${i}`}
                placement={p}
                index={i}
                compact={compactTags}
              />
            ))
          : null}
      </AnimatePresence>
    </motion.div>
  );
}

function StaticTagLabel({
  placement,
  compact = false,
}: {
  placement: OutfitTagPlacement;
  compact?: boolean;
}) {
  const onRight = placement.labelX >= 50;

  return (
    <>
      <span
        className="outfit-tag-anchor absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${placement.anchorX}%`, top: `${placement.anchorY}%` }}
      />
      <span
        className={`outfit-tag-pill absolute whitespace-nowrap -translate-y-1/2 px-2.5 py-1 font-semibold tracking-wide ${
          compact ? "outfit-tag-pill--compact max-w-none" : "max-w-[28%]"
        }`}
        style={{
          ...(onRight
            ? { right: `${100 - placement.labelX}%`, left: "auto" }
            : { left: `${placement.labelX}%`, right: "auto" }),
          top: `${placement.labelY}%`,
        }}
      >
        {placement.label}
      </span>
    </>
  );
}

function TagConnector({
  placement,
  delay,
}: {
  placement: OutfitTagPlacement;
  delay: number;
}) {
  return (
    <motion.line
      x1={placement.labelX}
      y1={placement.labelY}
      x2={placement.anchorX}
      y2={placement.anchorY}
      stroke="rgba(120, 113, 108, 0.55)"
      strokeWidth={0.28}
      strokeLinecap="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
  );
}

function TagLabel({
  placement,
  index,
  compact = false,
}: {
  placement: OutfitTagPlacement;
  index: number;
  compact?: boolean;
}) {
  const onRight = placement.labelX >= 50;

  return (
    <>
      <motion.span
        className="outfit-tag-anchor absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${placement.anchorX}%`, top: `${placement.anchorY}%` }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.28, delay: index * 0.08 + 0.12 }}
      />
      <motion.span
        className={`outfit-tag-pill absolute whitespace-nowrap -translate-y-1/2 px-2.5 py-1 font-semibold tracking-wide ${
          compact ? "outfit-tag-pill--compact max-w-none" : "max-w-[28%]"
        }`}
        style={{
          ...(onRight
            ? { right: `${100 - placement.labelX}%`, left: "auto" }
            : { left: `${placement.labelX}%`, right: "auto" }),
          top: `${placement.labelY}%`,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 28,
          delay: index * 0.09 + 0.04,
        }}
      >
        {placement.label}
      </motion.span>
    </>
  );
}
