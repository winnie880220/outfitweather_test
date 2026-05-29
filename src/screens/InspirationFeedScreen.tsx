import { useMemo, useState } from "react";
import { Shirt } from "lucide-react";
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
import { useReelSlideHeight } from "../lib/use-reel-slide-height";
import type { WeatherData } from "../types/api";

function InspirationEmptyState({
  regionLabel,
  drilldownBackLabel,
  onBackFromDrilldown,
  onRecord,
  onRequestExit,
  weather,
  insights,
}: {
  regionLabel?: string | null;
  drilldownBackLabel?: string | null;
  onBackFromDrilldown?: () => void;
  onRecord: () => void;
  onRequestExit: () => void;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
}) {
  return (
    <div className="inspiration-feed-layout app-screen-gradient">
      <FeedScreenHeader
        title="今日靈感"
        weather={weather}
        insights={insights}
        regionLabel={regionLabel}
        drilldownBackLabel={drilldownBackLabel}
        onBackFromDrilldown={onBackFromDrilldown}
        onRequestExit={onRequestExit}
      />
      <div className="inspiration-empty-body">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-stone-500 ring-1 ring-stone-200/70">
          <Shirt size={28} strokeWidth={1.5} />
        </div>
        <h2 className="text-base font-semibold text-stone-800">
          {regionLabel ? `${regionLabel}還沒有穿搭靈感` : "此溫度區間還沒有穿搭靈感"}
        </h2>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-stone-500">
          {regionLabel
            ? "此區尚無紀錄，完成一筆穿搭後就會出現在這裡。"
            : "成為第一筆相似天氣的穿搭記錄，幫助大家找到靈感。"}
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
  regionLabel,
  drilldownBackLabel,
  onBackFromDrilldown,
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
  regionLabel?: string | null;
  drilldownBackLabel?: string | null;
  onBackFromDrilldown?: () => void;
  onRequestExit: () => void;
}) {
  const [genderFilter, setGenderFilter] = useState<InspirationGenderFilter>("all");

  const filteredCards = useMemo(
    () => filterCardsByGender(cards, genderFilter),
    [cards, genderFilter]
  );
  const reelScrollRef = useReelSlideHeight<HTMLDivElement>([filteredCards.length, genderFilter]);

  if (cards.length === 0) {
    if (insightsLoading) {
      return (
        <div className="inspiration-feed-layout app-screen-gradient">
          <FeedScreenHeader
            title="今日靈感"
            weather={weather}
            insights={insights}
            regionLabel={regionLabel}
            drilldownBackLabel={drilldownBackLabel}
            onBackFromDrilldown={onBackFromDrilldown}
            onRequestExit={onRequestExit}
          />
          <div className="inspiration-empty-body">
            <div className="glass-card-strong flex w-full max-w-sm flex-col items-center justify-center rounded-2xl p-10 animate-pulse">
              <div className="mb-3 h-10 w-10 rounded-full bg-stone-200/80" />
              <div className="h-3 w-24 rounded bg-stone-200/80" />
            </div>
          </div>
        </div>
      );
    }
    return (
      <InspirationEmptyState
        regionLabel={regionLabel}
        drilldownBackLabel={drilldownBackLabel}
        onBackFromDrilldown={onBackFromDrilldown}
        onRecord={onGoRecord}
        onRequestExit={onRequestExit}
        weather={weather}
        insights={insights}
      />
    );
  }

  return (
    <div className="inspiration-feed-layout inspiration-feed-layout--with-dock app-screen-gradient">
      <FeedScreenHeader
        title="今日靈感"
        weather={weather}
        insights={insights}
        regionLabel={regionLabel}
        drilldownBackLabel={drilldownBackLabel}
        onBackFromDrilldown={onBackFromDrilldown}
        onRequestExit={onRequestExit}
      />

      <div className="inspiration-feed-intro">
        <InspirationGenderTabs value={genderFilter} onChange={setGenderFilter} />
        <p className="inspiration-apparent-hint">
          以體感溫度提供更準確的穿搭靈感
        </p>
      </div>

      <div
        ref={reelScrollRef}
        className="inspiration-feed-scroll inspiration-feed-scroll--reels app-scroll app-inset min-h-0"
        aria-label="穿搭靈感，上下滑動切換"
      >
        {filteredCards.length === 0 ? (
          <FilteredEmptyState filter={genderFilter} />
        ) : (
          filteredCards.map((card) => (
            <div key={card.id} className="inspiration-feed-reel-slide">
              <InspirationCard
                layout="reel"
                card={card}
                currentUserName={currentUserName}
                isSaved={isInspirationFavorite(favorites, card.id)}
                favoriteBusy={favoriteBusyId === card.id}
                onToggleFavorite={() => onToggleFavorite(card)}
              />
            </div>
          ))
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
