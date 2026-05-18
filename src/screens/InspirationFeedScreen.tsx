import { useMemo, useState } from "react";
import { LogOut, Shirt } from "lucide-react";
import { BottomActionBar } from "../components/BottomActionBar";
import { FeedScreenHeader } from "../components/FeedScreenHeader";
import { InspirationCard } from "../components/InspirationCard";
import {
  InspirationGenderTabs,
  type InspirationGenderFilter,
} from "../components/InspirationGenderTabs";
import type { InspirationItem, OutfitInsights } from "../lib/api/outfit-insights";
import {
  isInspirationFavorite,
  type InspirationFavoritesState,
} from "../lib/inspiration-favorites";
import type { WeatherData } from "../types/api";

function AppExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-exit-btn" aria-label="離開並返回初始頁">
      <LogOut size={12} strokeWidth={2} />
      離開
    </button>
  );
}

function InspirationEmptyState({
  onRecord,
  onRequestExit,
}: {
  onRecord: () => void;
  onRequestExit: () => void;
}) {
  return (
    <div className="inspiration-feed-layout app-screen-gradient">
      <div className="flex justify-end px-6 pt-3">
        <AppExitButton onClick={onRequestExit} />
      </div>
      <div className="inspiration-empty-body">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-500 ring-1 ring-stone-200/70">
          <Shirt size={28} strokeWidth={1.5} />
        </div>
        <h2 className="text-base font-semibold text-stone-800">此溫度區間還沒有穿搭靈感</h2>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-stone-500">
          成為第一筆相似天氣的穿搭記錄，幫助大家找到靈感。
        </p>
        <button
          type="button"
          onClick={onRecord}
          className="mt-6 rounded-xl bg-stone-800 px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        >
          成為第一筆穿搭記錄
        </button>
      </div>
    </div>
  );
}

function FilteredEmptyState({ filter }: { filter: InspirationGenderFilter }) {
  const label = filter === "女生" ? "女生" : "男生";
  return (
    <div className="inspiration-filter-empty py-12 text-center">
      <p className="text-sm font-medium text-stone-700">目前沒有{label}穿搭靈感</p>
      <p className="mt-1 text-xs text-stone-500">試試切換「全部」或其他分類</p>
    </div>
  );
}

function filterCardsByGender(
  cards: InspirationItem[],
  filter: InspirationGenderFilter
): InspirationItem[] {
  if (filter === "all") return cards;
  return cards.filter((card) => card.gender === filter);
}

export function InspirationFeedScreen({
  cards,
  currentUserName,
  insightsLoading,
  favorites,
  favoriteBusyId,
  onToggleFavorite,
  onGoRecord,
  weather,
  insights,
  onRequestExit,
}: {
  cards: InspirationItem[];
  currentUserName: string;
  insightsLoading?: boolean;
  favorites: InspirationFavoritesState;
  favoriteBusyId: string | null;
  onToggleFavorite: (card: InspirationItem) => void;
  onGoRecord: () => void;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  onRequestExit: () => void;
}) {
  const [genderFilter, setGenderFilter] = useState<InspirationGenderFilter>("all");

  const filteredCards = useMemo(
    () => filterCardsByGender(cards, genderFilter),
    [cards, genderFilter]
  );

  if (cards.length === 0) {
    if (insightsLoading) {
      return (
        <div className="inspiration-feed-layout app-screen-gradient">
          <div className="flex justify-end px-6 pt-3">
            <AppExitButton onClick={onRequestExit} />
          </div>
          <div className="inspiration-empty-body">
            <div className="glass-card-strong flex w-full max-w-sm flex-col items-center justify-center rounded-2xl p-10 animate-pulse">
              <div className="mb-3 h-10 w-10 rounded-full bg-stone-200/80" />
              <div className="h-3 w-24 rounded bg-stone-200/80" />
            </div>
          </div>
        </div>
      );
    }
    return <InspirationEmptyState onRecord={onGoRecord} onRequestExit={onRequestExit} />;
  }

  return (
    <div className="inspiration-feed-layout inspiration-feed-layout--with-dock app-screen-gradient">
      <FeedScreenHeader
        title="今日靈感"
        weather={weather}
        insights={insights}
        onRequestExit={onRequestExit}
      />

      <InspirationGenderTabs value={genderFilter} onChange={setGenderFilter} />

      <div className="inspiration-feed-scroll app-scroll app-inset min-h-0">
        {filteredCards.length === 0 ? (
          <FilteredEmptyState filter={genderFilter} />
        ) : (
          <div className="inspiration-feed-list">
            {filteredCards.map((card) => (
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
        )}
      </div>

      <div className="inspiration-record-dock">
        <div className="app-inset">
          <BottomActionBar solo primaryLabel="我穿好了，來記錄" onPrimary={onGoRecord} />
        </div>
      </div>
    </div>
  );
}
