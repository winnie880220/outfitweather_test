import { Heart } from "lucide-react";
import { FeedScreenHeader } from "../components/FeedScreenHeader";
import { InspirationCard } from "../components/InspirationCard";
import type { InspirationItem, OutfitInsights } from "../lib/api/outfit-insights";
import {
  isInspirationFavorite,
  type InspirationFavoritesState,
} from "../lib/inspiration-favorites";
import type { WeatherData } from "../types/api";

export function FavoritesScreen({
  cards,
  currentUserName,
  favorites,
  favoriteBusyId,
  onToggleFavorite,
  weather,
  insights,
  onRequestExit,
}: {
  cards: InspirationItem[];
  currentUserName: string;
  favorites: InspirationFavoritesState;
  favoriteBusyId: string | null;
  onToggleFavorite: (card: InspirationItem) => void;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  onRequestExit: () => void;
}) {
  return (
    <div className="inspiration-feed-layout inspiration-feed-layout--list app-screen-gradient">
      <FeedScreenHeader
        title="收藏"
        weather={weather}
        insights={insights}
        onRequestExit={onRequestExit}
      />

      {cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-400 ring-1 ring-stone-200/70">
            <Heart size={28} strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-stone-700">還沒有收藏</p>
          <p className="mt-2 max-w-[260px] text-xs leading-relaxed text-stone-500">
            在靈感頁點卡片右上角的愛心，把喜歡的穿搭加入這裡。
          </p>
        </div>
      ) : (
        <div className="inspiration-feed-scroll app-scroll app-inset min-h-0">
          <div className="inspiration-feed-list">
            {cards.map((card) => (
              <InspirationCard
                key={card.id}
                card={card}
                currentUserName={currentUserName}
                isSaved={isInspirationFavorite(favorites, card.id)}
                favoriteBusy={favoriteBusyId === card.id}
                onToggleFavorite={() => onToggleFavorite(card)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
