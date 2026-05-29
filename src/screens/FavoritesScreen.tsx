import { Heart } from "lucide-react";
import { FeedScreenHeader } from "../components/FeedScreenHeader";
import { InspirationCard } from "../components/InspirationCard";
import type { InspirationItem, OutfitInsights } from "../lib/api/outfit-insights";
import {
  isInspirationFavorite,
  type InspirationFavoritesState,
} from "../lib/inspiration-favorites";
import { weatherInsightReferenceTemp } from "../../lib/weather-insight-temp";
import { useReelSlideHeight } from "../lib/use-reel-slide-height";
import type { WeatherData } from "../types/api";

export function FavoritesScreen({
  cards,
  totalFavoriteCount = 0,
  favoriteTempBand = null,
  currentUserName,
  favorites,
  favoriteBusyId,
  onToggleFavorite,
  weather,
  insights,
  onRequestExit,
}: {
  cards: InspirationItem[];
  /** 今日 active 列上、未依溫區篩選前的收藏數 */
  totalFavoriteCount?: number;
  /** 目前顯示用溫區（體感 ±1 或 ±2） */
  favoriteTempBand?: { min: number; max: number } | null;
  currentUserName: string;
  favorites: InspirationFavoritesState;
  favoriteBusyId: string | null;
  onToggleFavorite: (card: InspirationItem) => void;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  onRequestExit: () => void;
}) {
  const reelScrollRef = useReelSlideHeight<HTMLDivElement>([cards.length]);

  return (
    <div className="inspiration-feed-layout inspiration-feed-layout--favorites app-screen-gradient">
      <FeedScreenHeader
        title="今日收藏"
        weather={weather}
        insights={insights}
        onRequestExit={onRequestExit}
      />

      {cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-400 ring-1 ring-stone-200/70">
            <Heart size={28} strokeWidth={1.5} />
          </div>
          {totalFavoriteCount > 0 && weather && favoriteTempBand ? (
            <>
              <p className="text-sm font-medium text-stone-700">此溫區尚無今日收藏</p>
              <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-stone-500">
                目前體感約 {Math.round(weatherInsightReferenceTemp(weather))}°C，僅顯示{" "}
                {favoriteTempBand.min}–{favoriteTempBand.max}°C 的穿搭。你今天另有{" "}
                {totalFavoriteCount} 筆收藏在其他溫區。
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-stone-700">今天還沒有收藏</p>
              <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-stone-500">
                在靈感頁點卡片右上角的愛心，收藏會記在今天的清單裡。
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          ref={reelScrollRef}
          className="inspiration-feed-scroll inspiration-feed-scroll--reels app-scroll app-inset min-h-0"
          aria-label="今日收藏穿搭，上下滑動切換"
        >
          {cards.map((card) => (
            <div key={card.id} className="inspiration-feed-reel-slide">
              <InspirationCard
                layout="reel"
                card={card}
                currentUserName={currentUserName}
                isSaved={isInspirationFavorite(favorites, card.id)}
                favoriteBusy={favoriteBusyId === card.id}
                showFavoriteButton
                onToggleFavorite={() => onToggleFavorite(card)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
