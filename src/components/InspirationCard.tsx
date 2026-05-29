import { Heart } from "lucide-react";
import type { InspirationItem } from "../lib/api/outfit-insights";
import { FeelMetricsChips } from "./FeelMetricsChips";
import { OutfitPhotoDisplay } from "./OutfitPhotoDisplay";

function isOwnOutfit(card: InspirationItem, currentUserName?: string): boolean {
  const self = currentUserName?.trim();
  const author = card.who?.trim();
  return Boolean(self && author && self === author);
}

export function InspirationCard({
  card,
  currentUserName,
  isSaved,
  onToggleFavorite,
  favoriteBusy = false,
  layout = "list",
  /** 收藏頁一律顯示愛心，以便取消收藏（含自己的穿搭） */
  showFavoriteButton,
  onPhotoFailed,
}: {
  card: InspirationItem;
  currentUserName?: string;
  isSaved: boolean;
  onToggleFavorite: () => void;
  favoriteBusy?: boolean;
  layout?: "list" | "reel";
  showFavoriteButton?: boolean;
  /** 圖片載入失敗（無有效照片） */
  onPhotoFailed?: () => void;
}) {
  const showFavorite =
    showFavoriteButton ?? !isOwnOutfit(card, currentUserName);
  const isReel = layout === "reel";
  const hasPhotoUrl = Boolean(card.photoUrl?.trim());

  if (!hasPhotoUrl) return null;

  return (
    <article
      className={
        isReel
          ? "inspiration-reel-card inspiration-card h-full overflow-hidden rounded-3xl"
          : "inspiration-feed-card inspiration-card overflow-hidden rounded-3xl"
      }
    >
      <div
        className={`inspiration-card-photo-cell relative ${isReel ? "min-h-0" : "min-h-[14rem]"}`}
      >
        <OutfitPhotoDisplay
          photoUrl={card.photoUrl}
          emoji={card.emoji}
          bg={card.bg}
          objectFit="contain"
          className={isReel ? "h-full w-full min-h-0" : "inspiration-card-photo-feed"}
          onPhotoError={onPhotoFailed}
        />
        {showFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriteBusy}
            aria-label={isSaved ? "取消收藏" : "加入收藏"}
            className={`inspiration-favorite-btn ${isSaved ? "inspiration-favorite-btn--saved" : ""}`}
          >
            <Heart
              size={18}
              fill={isSaved ? "currentColor" : "none"}
              strokeWidth={2}
              className="shrink-0"
            />
          </button>
        ) : null}
      </div>
      <div className={`inspiration-card-content shrink-0 ${isReel ? "p-4" : "p-3.5"}`}>
        <div className="inspiration-card-temp">{card.temp}</div>
        <div className="inspiration-card-meta mt-0.5 text-stone-500">
          {[card.location, card.date].filter(Boolean).join("・")}
        </div>
        {card.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-stone-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-stone-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <FeelMetricsChips metrics={card.feelMetrics} compact />
      </div>
    </article>
  );
}
