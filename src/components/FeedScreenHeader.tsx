import { ChevronLeft, LogOut } from "lucide-react";
import type { OutfitInsights } from "../lib/api/outfit-insights";
import type { WeatherData } from "../types/api";
import { weatherInsightReferenceTemp } from "../../lib/weather-insight-temp";

function AppExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-exit-btn" aria-label="離開並返回初始頁">
      <LogOut size={12} strokeWidth={2} />
      離開
    </button>
  );
}

export function FeedScreenHeader({
  title,
  weather,
  insights,
  regionLabel,
  drilldownBackLabel,
  onBackFromDrilldown,
  onRequestExit,
}: {
  title: string;
  weather: WeatherData | null;
  insights: OutfitInsights | null;
  regionLabel?: string | null;
  drilldownBackLabel?: string | null;
  onBackFromDrilldown?: () => void;
  onRequestExit: () => void;
}) {
  const tempLabel = insights
    ? `${insights.tempMin}–${insights.tempMax}°C`
    : `${Math.round(weather ? weatherInsightReferenceTemp(weather) : 26)}°`;
  const apparentTempLabel = `體感 ${tempLabel}`;

  const badge = regionLabel
    ? `${regionLabel} · ${apparentTempLabel}`
    : `${apparentTempLabel} 相似天氣`;

  const isDrilldown = Boolean(onBackFromDrilldown && drilldownBackLabel);

  if (isDrilldown) {
    return (
      <header className="inspiration-header inspiration-feed-header inspiration-feed-header--drilldown">
        <div className="inspiration-feed-header__toolbar">
          <button
            type="button"
            onClick={onBackFromDrilldown}
            className="inspiration-drilldown-back-btn"
            aria-label={`返回${drilldownBackLabel}靈感`}
          >
            <ChevronLeft size={15} strokeWidth={2.25} aria-hidden />
            <span>返回{drilldownBackLabel}</span>
          </button>
          <AppExitButton onClick={onRequestExit} />
        </div>
        <div className="inspiration-feed-header__main">
          <h1 className="inspiration-feed-header__title">{title}</h1>
          <p className="inspiration-feed-header__region glass-pill" title={badge}>
            {badge}
          </p>
        </div>
      </header>
    );
  }

  return (
    <header className="inspiration-header inspiration-feed-header flex shrink-0 items-center justify-between gap-2 px-6">
      <span className="min-w-0 truncate text-base font-semibold text-stone-800">{title}</span>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className="glass-pill max-w-[min(14rem,46vw)] truncate rounded-full px-2.5 py-1 text-[11px] font-medium text-stone-600"
          title={badge}
        >
          {badge}
        </span>
        <AppExitButton onClick={onRequestExit} />
      </div>
    </header>
  );
}
